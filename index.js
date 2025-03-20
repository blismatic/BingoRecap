import { getHiscores } from 'osrs-wrapper';
import config from './config.json' assert { type: "json" };
import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { promises, existsSync, mkdirSync, readFileSync } from 'fs';
import path, { join, dirname } from 'path'
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import cliProgress from 'cli-progress';
import xlsx from 'node-xlsx';
import { getAllMVPs } from './mvp.mjs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let x = join(__dirname, 'resources', 'RuneScape-Fonts', 'ttf', 'RuneScape-Quill.ttf')
GlobalFonts.registerFromPath(x, 'RuneScape-Quill')

const Colors = {
    Yellow: '#ffde00',
    White: '#ffffff',
    Green: '#3ad212',
    Orange: '#ffae00',
    Gray: '#c2c2c2',
}

async function statsSetup(isAfterEvent) {
    // make sure all the folders are setup correctly
    const parent_folder_name = 'stats';
    const folder_name = isAfterEvent ? 'after_event' : 'before_event'; // if you want the stats to be saved in ./stats/after_event/ then call statsSetup('true');
    const unique_path = `./${parent_folder_name}/${folder_name}`;

    // Make sure the base 'stats' folder exists
    if (!existsSync('./stats')) {
        mkdirSync('./stats')
    }

    try {
        if (!existsSync(unique_path)) {
            mkdirSync(unique_path);
        }
    } catch (err) {
        console.error(err);
    }

    // make sure each team has their own folder
    for (let teamIndex = 0; teamIndex < config.teams.length; teamIndex++) {
        const team = config.teams[teamIndex];
        console.log(team.name);
        const unique_path = `./${parent_folder_name}/${folder_name}/${team.name}`;
        try {
            if (!existsSync(unique_path)) {
                mkdirSync(unique_path);
            }
        } catch (err) {
            console.error(err);
        }

        // Query each member of the team's hiscore data
        for (let memberIndex = 0; memberIndex < team.members.length; memberIndex++) {
            const rsn = team.members[memberIndex];
            let stats = null
            try {
                stats = await getHiscores(rsn);
            } catch (err) {
                console.error(`could not find the user ${rsn} on the hiscores. perhaps they changed their name. ${err}`)
                continue
            }

            // Write their data to a unique file
            const unique_path = `./${parent_folder_name}/${folder_name}/${team.name}/${rsn}.json`;
            const formatted_stats = JSON.stringify(stats, null, 4);
            await promises.writeFile(unique_path, formatted_stats);
        }
    }

}

async function createImages(spreadsheet = undefined) {
    let spreadsheetData = ''
    if (spreadsheet !== undefined) {
        spreadsheetData = parseXlsxToJSON(spreadsheet);
    }

    // Calculate mvp info
    const mvpInfo = getAllMVPs()

    // if it doesn't already exist...
    // make a folder in ./images/ for each team, with the name of the folder being the name of the team
    const imagesDir = path.join(__dirname, 'images');
    if (!existsSync(imagesDir)) { mkdirSync(imagesDir, { recursive: true }); } // create the parent 'images' folder if it does not exist.
    for (const team of config.teams) {
        const teamDir = path.join(imagesDir, team.name);
        if (!existsSync(teamDir)) { mkdirSync(teamDir, { recursive: true }); } // create each teams folder if it does not exist.
    }
    const entireEventDir = path.join(__dirname, 'images', 'Entire Event');
    if (!existsSync(entireEventDir)) { mkdirSync(entireEventDir, { recursive: true }); } // create the the 'images/Entire Event' folder if it does not exist

    // for each player, generate their own image. Generate one image for the entire team as well.
    // const bar1 = new cliProgress.SingleBar({ stopOnComplete: true }, cliProgress.Presets.shades_classic);
    const maxCount = config["teams"].length + config["teams"].reduce((total, team) => total + team["members"].length, 0);
    let counter = 0;
    // bar1.start(maxCount, counter);

    let entireEventStats = []

    for (let teamIndex = 0; teamIndex < config.teams.length; teamIndex++) {
        const team = config.teams[teamIndex];
        if (spreadsheet) {
            var teamSpreadsheetData = spreadsheetData['teams'][spreadsheetData['teams'].findIndex(t => t.name === team.name)];
        }

        let allPlayersStats = [];

        for (let playerIndex = 0; playerIndex < team.members.length; playerIndex++) {
            const player = team.members[playerIndex];
            const statsDelta = await compareStats(team.name, player);
            if (spreadsheet) {
                var playerDrops = teamSpreadsheetData['members'][teamSpreadsheetData['members'].findIndex(p => p.playerName === player)]['drops'];
            }
            createImage(team.name, player, statsDelta, mvpInfo, playerDrops);
            allPlayersStats.push(statsDelta);
            entireEventStats.push(statsDelta);
            // bar1.update(++counter);
        }

        if (spreadsheet) {
            var teamDrops = teamSpreadsheetData['totalDrops'];
        }

        createImage(team.name, team.name, combineObjects(allPlayersStats), mvpInfo, teamDrops, `./images/Entire Event/${team.name}.png`);
        // bar1.update(++counter);
    }

    createImage('Entire Event', 'Entire Event', combineObjects(entireEventStats), mvpInfo, playerDrops, './images/Entire Event/Entire Event.png');
    // bar1.stop();
}

async function createImage(team_name, rsn, statsDelta, mvpInfo = null, drops = null, destination = `./images/${team_name}/${rsn}.png`) {
    // console.log(mvpInfo);

    // ===== canvas setup =====
    const width = 1080;
    const height = 15000; // This is extremely large on purpose. It will be trimmed to the correct height at the end.
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext('2d');
    let yPos = 0;

    let background = await Canvas.loadImage('./resources/decoration/background.png');
    const pattern = context.createPattern(background, 'repeat-y');
    context.fillStyle = pattern;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const dividerImg = await Canvas.loadImage('./resources/decoration/divider.png');

    // ===== helper functions =====
    async function fillTextDropShadow(ctx, text, x, y, colorCode, shadowDistance = 5) {
        // Draw the shadow first
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x - shadowDistance, y + shadowDistance);

        // Then draw the actual text
        ctx.fillStyle = colorCode;
        ctx.fillText(text, x, y)
    }

    function shrinkFont(ctx, message, baseSize, padding, alignment, font = 'RuneScape-Quill') {
        ctx.textAlign = alignment;
        ctx.font = `${baseSize}px ${font}`;

        while (ctx.measureText(message).width > canvas.width - padding) {
            ctx.font = `${baseSize -= 1}px ${font}`;
        }

        return ctx.font;
    }

    function sortSection(section, subKeyToSortBy, sectionKeysToInclude) {
        if (sectionKeysToInclude === undefined) {
            sectionKeysToInclude = Object.keys(section);
        }

        // Make a new object that only contains elements where the keyToSortBy is greater than 0.
        const filteredSection = {};
        for (let key in section) {
            if (section.hasOwnProperty(key) && section[key][subKeyToSortBy] > 0 && sectionKeysToInclude.includes(key)) {
                filteredSection[key] = section[key];
            }
        }

        // Turn the new object into an array, and sort it by keyToSortBy in descending order.
        let array = Object.entries(filteredSection).map(([key, value]) => ({ name: key, ...value }));
        array.sort((a, b) => Number(b[subKeyToSortBy]) - Number(a[subKeyToSortBy]));

        // Return the sorted array.
        return array;
    }

    async function printElements(ctx, folder, sortedThing, key, numColumns, xPos, xOffset, yOffset, scale) {
        let count = 0;
        for (let item of sortedThing) {
            let xPos2 = xPos;
            for (let i = 1; i < numColumns; i++) {
                if (count % numColumns == 0) {
                    yPos += yOffset;
                } else if (count % numColumns == i) {
                    xPos2 += xOffset * i;
                }
            }
            count++;
            // await drawBossElement(ctx, item.name, item[key], xPos2, yPos, scale);
            await drawElement(ctx, folder, item.name, item[key], xPos2, yPos, scale);
        }
    }

    async function drawElement(ctx, folder, itemName, itemKey, x, y, scale = 1, mvpStatus = null) {
        const possibleFolders = ['bosses', 'clues', 'skills', 'items'];
        if (!possibleFolders.includes(folder)) {
            console.log(`Sorry, I can\'t accept ${folder} as a folder name...`);
        }

        // For bosses and clues, the suffix appeneded to the number should be kc. Otherwise, xp.
        // let suffix = (folder == 'skills') ? 'xp' : 'kc';
        let prefix = '+';
        let suffix = '';
        if (folder == 'skills') {
            suffix = 'xp';
        } else if (folder == 'items') {
            prefix = 'x';
            suffix = '';
        } else if (folder == 'bosses' || folder == 'clues') {
            suffix = 'kc';
        } else {
            console.log('Something went horribly wrong');
        }

        const fontSize = 60 * scale;
        ctx.font = `${fontSize}px RuneScape-Quill`;
        ctx.textAlign = 'left';
        try {
            const image = await Canvas.loadImage(`./resources/${folder}/${itemName}.png`);
            ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
            if (mvpStatus != null) {
                let mvp_image;
                if (mvpStatus == "team") {
                    mvp_image = await Canvas.loadImage(`./resources/decoration/mvp-team.png`);
                } else if (mvpStatus == "event") {
                    mvp_image = await Canvas.loadImage(`./resources/decoration/mvp-event.png`);
                }
                ctx.drawImage(mvp_image, x + 40, y - 15, image.width * scale * 0.5, image.height * scale * 0.5);
                // x + 40, y - 20
            }
            const textOrigin = { x: x + (image.width * scale) + 10, y: y + (image.height / 2) * scale };
            fillTextDropShadow(ctx, `${prefix}${convertToOsrsNumber(itemKey)} ${suffix}`, textOrigin.x, textOrigin.y, Colors.Green);
        } catch (err) {
            console.log(`./resources/${folder}/${itemName}.png probably does not exist.`);
            console.log(err);
            process.exit(1)
        }
    }

    // ===== title card =====
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '143px RuneScape-Quill';

    let titleOrigin = { x: context.canvas.width / 2, y: yPos += 50 };
    context.font = shrinkFont(context, config.title, 143, 150, 'center', 'RuneScape-Quill');
    fillTextDropShadow(context, config.title, titleOrigin.x, titleOrigin.y, Colors.Yellow);

    let subtitleOrigin = { x: titleOrigin.x, y: yPos += 100 };
    context.font = shrinkFont(context, config.subtitle, 125, 150, 'center', 'RuneScape-Quill');
    fillTextDropShadow(context, config.subtitle, subtitleOrigin.x, subtitleOrigin.y, Colors.Yellow);

    context.font = '49px RuneScape-Quill';
    let welcome_messageOrigin = { x: titleOrigin.x, y: yPos += 85 };
    let welcome_message = config.welcome_message.replace(/<rsn>/g, rsn);
    welcome_message = welcome_message.replace(/<team_name>/g, team_name);

    context.font = shrinkFont(context, welcome_message, 49, 100, 'center', 'RuneScape-Quill');
    fillTextDropShadow(context, welcome_message, welcome_messageOrigin.x, welcome_messageOrigin.y, Colors.White);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos += 40);

    // ===== skills card =====
    // Skills title
    context.font = '116px RuneScape-Quill';
    let skillsTitleOrigin = { x: titleOrigin.x, y: yPos += 75 };
    fillTextDropShadow(context, 'Skills', skillsTitleOrigin.x, skillsTitleOrigin.y, Colors.White);

    const skills = statsDelta["skills"];
    const sortedSkills = sortSection(skills, 'xp')
    sortedSkills.shift(); // Remove the "overall" xp, since this will be calculated differently

    // Skills subtitle
    context.font = '60px RuneScape-Quill';
    const totalXp = sortedSkills.reduce((sum, skill) => {
        return sum + Number(skill.xp);
    }, 0);
    fillTextDropShadow(context, `Total XP Gained: ${totalXp.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

    yPos -= 50; // This is necessary otherwise the following elements get pushed further down
    let count = 0;
    for (let skill of sortedSkills) {
        const xp = skill.xp;

        let xPos = 150;
        let xOffset = 270;
        if (count % 3 == 0) {
            yPos += 100;
        } else if (count % 3 == 1) {
            xPos += xOffset;
        } else if (count % 3 == 2) {
            xPos += xOffset * 2;
        }
        count++;

        // Conditionally add in the mvp status, if one exists.
        let mvpStatus = null;
        if (mvpInfo != null && mvpInfo['skills'][skill.name].includes(rsn)) {
            if (mvpInfo['skills'][skill.name][0] === rsn) {
                mvpStatus = 'event'
            } else {
                mvpStatus = 'team';
            }
            // console.log(`${mvpStatus}, ${rsn}, ${skill.name}`)
        }

        await drawElement(context, 'skills', skill.name, skill.xp, xPos, yPos, 0.7, mvpStatus);
    }
    // await printElements(context, 'skills', sortedSkills, 'xp', 3, 150, 270, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos += 90);

    // ===== bosses card =====
    const bosses = statsDelta["bosses"];
    const sortedBosses = sortSection(bosses, 'kills');

    // Bosses title
    context.textAlign = 'center';
    context.font = '116px RuneScape-Quill';
    let bossesTitleOrigin = { x: titleOrigin.x, y: yPos += 60 };
    fillTextDropShadow(context, 'Bosses', bossesTitleOrigin.x, bossesTitleOrigin.y, Colors.White);

    // Bosses subtitle
    context.font = '60px RuneScape-Quill';
    const totalBosses = sortedBosses.reduce((sum, boss) => {
        return sum + Number(boss.kills);
    }, 0);
    fillTextDropShadow(context, `Total Bosses Killed: ${totalBosses.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

    // for each boss that has seen an increase in kill count, create a bossElement object for them
    yPos -= 50; // This is necessary otherwise the following elements get pushed further down
    count = 0;
    for (let boss of sortedBosses) {
        let xPos = 150;
        let xOffset = 200;
        if (count % 4 == 0) {
            yPos += 100;
        } else if (count % 4 == 1) {
            xPos += xOffset;
        } else if (count % 4 == 2) {
            xPos += xOffset * 2;
        } else if (count % 4 == 3) {
            xPos += xOffset * 3;
        }
        count++;

        // Conditionally add in the mvp status, if one exists.
        let mvpStatus = null;
        if (mvpInfo != null && mvpInfo['bosses'][boss.name].includes(rsn)) {
            if (mvpInfo['bosses'][boss.name][0] === rsn) {
                mvpStatus = 'event'
            } else {
                mvpStatus = 'team';
            }
        }

        await drawElement(context, 'bosses', boss.name, boss.kills, xPos, yPos, 0.7, mvpStatus);
    }
    // await printElements(context, 'bosses', sortedBosses, 'kills', 4, 150, 200, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos += 90);

    // ===== clues card =====
    const minigames = statsDelta["minigames"];
    const sortedClues = sortSection(minigames, 'score', ["clueScrollsBeginner", "clueScrollsEasy", "clueScrollsMedium", "clueScrollsHard", "clueScrollsElite", "clueScrollsMaster"]);

    // Clues title
    context.textAlign = 'center';
    context.font = '116px RuneScape-Quill';
    let cluesTitleOrigin = { x: titleOrigin.x, y: yPos += 60 };
    fillTextDropShadow(context, 'Clues', cluesTitleOrigin.x, cluesTitleOrigin.y, Colors.White);

    // Clues subtitle
    context.font = '60px RuneScape-Quill';
    const totalClues = sortedClues.reduce((sum, clueType) => {
        return sum + Number(clueType.score);
    }, 0);
    fillTextDropShadow(context, `Total Caskets Opened: ${totalClues.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

    // for each clue type that has seen an increase in score, create a clueElement object for them
    yPos -= 50; // This is necessary otherwise the following elements get pushed further down
    count = 0;
    for (let clueType of sortedClues) {
        let xPos = 200;
        let xOffset = 250;
        if (count % 3 == 0) {
            yPos += 100;
        } else if (count % 3 == 1) {
            xPos += xOffset;
        } else if (count % 3 == 2) {
            xPos += xOffset * 2;
        }
        count++;

        // Conditionally add in the mvp status, if one exists.
        let mvpStatus = null;
        if (mvpInfo != null && mvpInfo['minigames'][clueType.name].includes(rsn)) {
            if (mvpInfo['minigames'][clueType.name][0] === rsn) {
                mvpStatus = 'event'
            } else {
                mvpStatus = 'team';
            }
            // console.log(`${mvpStatus}, ${rsn}, ${skill.name}`)
        }

        await drawElement(context, 'clues', clueType.name, clueType.score, xPos, yPos, 0.7, mvpStatus);
    }
    // await printElements(context, 'clues', sortedClues, 'score', 3, 200, 250, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos += 100);

    // ===== drops card =====
    if (drops != null) {
        console.log('here1')
        console.log(`drops = ${drops}, type = ${typeof drops}`)
        console.log('here2')
        drops.sort((a, b) => b.number - a.number);
        // Drops title
        context.textAlign = 'center';
        context.font = '116px RuneScape-Quill';
        let dropsTitleOrigin = { x: titleOrigin.x, y: yPos += 60 };
        fillTextDropShadow(context, 'Drops', dropsTitleOrigin.x, dropsTitleOrigin.y, Colors.White);

        // Drops subtitle
        context.font = '60px RuneScape-Quill';
        const totalDrops = drops.reduce((total, drop) => {
            return total + Number(drop.number);
        }, 0);
        fillTextDropShadow(context, `Total Drops received: ${totalDrops.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

        // for each drop, create a drawElement object for them
        yPos -= 50; // This is necessary otherwise the following elements get pushed further down
        count = 0;
        for (let drop of drops) {
            let xPos = 150;
            let xOffset = 200;
            if (count % 4 == 0) {
                yPos += 100;
            } else if (count % 4 == 1) {
                xPos += xOffset;
            } else if (count % 4 == 2) {
                xPos += xOffset * 2;
            } else if (count % 4 == 3) {
                xPos += xOffset * 3;
            }
            count++;

            await drawElement(context, 'items', drop.itemName, drop.number, xPos, yPos, 0.7);
        }

        // Drops sub subtitle
        context.textAlign = 'center';
        context.font = '50px RuneScape-Quill';
        const totalGp = drops.reduce((sum, drop) => {
            return sum + Number(drop.gp);
        }, 0);
        fillTextDropShadow(context, `Estimated GP earned: ${convertToOsrsNumber(totalGp)}`, context.canvas.width / 2, yPos += 110, Colors.Yellow);

        context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos += 50);
    }


    // ===== exit card =====
    let exitMessage = config["exit_message"];
    exitMessage = exitMessage.replace(/<rsn>/g, rsn);
    exitMessage = exitMessage.replace(/<team_name>/g, team_name);

    context.textAlign = 'center';
    context.font = shrinkFont(context, exitMessage, 100, 150, 'center', 'RuneScape-Quill');
    let exitTitleOrigin = { x: titleOrigin.x, y: yPos += 50 };
    fillTextDropShadow(context, exitMessage, exitTitleOrigin.x, exitTitleOrigin.y, Colors.Yellow);

    const watermarkMessage = 'Generated using https://github.com/blismatic/BingoRecap, message "l.ove" on Discord with any questions'
    context.font = shrinkFont(context, watermarkMessage, 100, 200, 'center', 'RuneScape-Quill');
    context.globalAlpha = 0.3;
    fillTextDropShadow(context, watermarkMessage, exitTitleOrigin.x, yPos += 80, Colors.Gray);

    // ===== save image =====
    // Adjust the height of the image to make it end at the correct spot.
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    canvas.height = yPos += 30;
    context.putImageData(imageData, 0, 0);

    // actually do the saving
    const pngData = await canvas.encode('png');
    try {
        if (!existsSync(`./images/${team_name}`)) {
            mkdirSync(`./images/${team_name}`);
        }
    } catch (err) {
        console.error(err);
    }
    await promises.writeFile(destination, pngData);
}

async function fetchCachedStats(teamName, playerName, beforeOrAfter) {
    // Fetch profile from JSON file stored locally
    let statsFile = `./stats/${beforeOrAfter}/${teamName}/${playerName}.json`
    let profile = JSON.parse(readFileSync(statsFile), 'utf8')
    return profile
}

async function compareStats(teamName, playerName) {
    // Fetch the two profiles and compare them
    const oldProfile = await fetchCachedStats(teamName, playerName, 'before_event');
    const newProfile = await fetchCachedStats(teamName, playerName, 'after_event');

    function getObjectDifference(oldObj, newObj) {
        // Look at each category in new object. This should be "skills, minigames, and bosses"
        for (let category in newObj) {
            for (let section in newObj[category]) {

                // If there exists a section (attack, defence, cerberus, callisto, clueScrollsEasy, clueScrollsMedium) with the same name in old object...
                if (Object.keys(oldObj[category]).includes(section)) {
                    // Look at each subKey (for the "skills" section, this is "rank, level, and xp")
                    for (let subKey in newObj[category][section]) {
                        // If the value of the subKey is '-1' in the oldObject (meaning that the player never killed the boss), dont actually subtract it, since subtracting a negative would create a positive
                        if (oldObj[category][section][subKey] == -1) {
                            continue;
                        }

                        // Subtract the oldObjects value for this subKey from the current value
                        newObj[category][section][subKey] -= oldObj[category][section][subKey];
                    }
                }

                // For any sections that are -1, just set them to 0.
                // - - This will catch any cases where the section is new (i.e. DT2 bosses came out)
                // - - - or when the user wasn't ranked in this section at all
                for (let subKey in newObj[category][section]) {
                    if (newObj[category][section][subKey] == -1) {
                        newObj[category][section][subKey] = 0;
                    }
                }
            }
        }
        return newObj;
    }

    return getObjectDifference(oldProfile, newProfile);
}

function convertToOsrsNumber(number) {
    if (number < 100000) {
        return number.toLocaleString();
    } else if (number < 1000000) {
        return (number / 1000).toFixed(number < 100000 ? 2 : 1) + 'k';
    } else if (number < 1000000000) {
        return (number / 1000000).toFixed(number < 100000000 ? 2 : 1) + 'm';
    } else if (number < 1000000000000) {
        return (number / 1000000000).toFixed(number < 100000000000 ? 2 : 1) + 'b';
    } else {
        return (number / 1000000000000).toFixed(number < 100000000000000 ? 2 : 1) + 't';
    }
}

function combineObjects(objects) {
    let result = {};

    objects.forEach(object => {
        for (let mainKey in object) { // mainKey will be "skills", "minigames", "bosses"
            if (!result[mainKey]) {
                result[mainKey] = {};
            }
            for (let subKey in object[mainKey]) { // subKey will be "attack", "defence", "clueScrollsEasy", "callisto", "cerberus", etc...
                if (!result[mainKey][subKey]) {
                    result[mainKey][subKey] = {};
                }
                for (let innerKey in object[mainKey][subKey]) { // innerKey will be "rank", "level", "xp", "score", "kills"
                    if (!result[mainKey][subKey][innerKey]) {
                        result[mainKey][subKey][innerKey] = 0;
                    }
                    result[mainKey][subKey][innerKey] += Number(object[mainKey][subKey][innerKey]);
                }
            }
        }
    });

    return result;
}

function validateConfigFile() {
    const schemaData = readFileSync('schema.json');
    const configData = readFileSync('config.json');

    const schema = JSON.parse(schemaData);
    const config = JSON.parse(configData);

    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    const isValid = validate(config);

    if (!isValid) {
        console.error('Invalid config file:', ajv.errorsText(validate.errors));
        process.exit(1);
    }
}

function parseXlsxToJSON(file) {
    const workSheetsFromFile = xlsx.parse(`${__dirname}/${file}`);
    const rawArray = workSheetsFromFile[0]['data'];

    const teams = {};
    const playerNames = rawArray[1].slice(2);
    const possibleItems = [];

    rawArray[0].slice(2).forEach((team, i) => {
        if (!team) return;
        if (!teams[team]) {
            teams[team] = {
                name: team,
                members: []
            };
        }

        const player = {
            playerName: playerNames[i],
            drops: [],
        };

        for (let j = 2; j < rawArray.length; j++) {
            const drop = {
                itemName: rawArray[j][0],
                number: rawArray[j][i + 2],
                gp: rawArray[j][1] * rawArray[j][i + 2]
            };

            if ((!isNaN(drop.number)) && (drop.number > 0)) {
                player.drops.push(drop);
            }

            if (i == 0) {
                const item = {
                    name: rawArray[j][0],
                    price: rawArray[j][1]
                };

                possibleItems.push(item);
            }
        }

        teams[team].members.push(player);
    });

    let myTeams = Object.values(teams);
    myTeams.forEach((team) => {
        const sums = {};

        team.members.forEach((member) => {
            member.drops.forEach((drop) => {
                if (!sums[drop.itemName]) {
                    sums[drop.itemName] = { itemName: drop.itemName, number: 0, gp: 0 };
                }

                sums[drop.itemName].number += drop.number;
                sums[drop.itemName].gp += drop.gp;
            });
        });

        team.totalDrops = Object.values(sums);
    });

    const myObj = { teams: Object.values(teams), possibleItems: possibleItems };
    return myObj;
}

// ----------------------------------------------------
// Validate the config file
validateConfigFile();

// Make sure at most 2 arguments were provided
if ((2 >= process.argv.length) || (process.argv.length > 4)) {
    console.error('Sorry, expected either one or two arguments <\'before\'/\'after\'/\'images\'> <spreadsheet>');
    process.exit(1);
}

// Make sure the first argument provided was either 'before', 'after', or 'images'
if (!['before', 'after', 'images'].includes(process.argv[2])) {
    console.error('Sorry, first argument must be either \'before\', \'after\', or \'images\'');
    process.exit(1);
}

// Make sure the second argument, if provided, ends in '.xlsx'
if ((process.argv.length == 4) && (!process.argv[3].endsWith('.xlsx'))) {
    console.error('Sorry, the name of the provided spreadsheet must end in \'.xlsx\'');
    process.exit(1);
}
let isSpreadsheetProvided = process.argv.length == 4 ? true : false;
let spreadsheetName = process.argv[3]

// Run specific commands based on which argument was provided
if (process.argv[2] == 'before') {
    console.log('Grabbing everyone\'s stats...');
    await statsSetup(0);
} else if (process.argv[2] == 'after') {
    console.log('Grabbing everyone\'s stats again...');
    await statsSetup(1);
    console.log('Generating images...');

    if (isSpreadsheetProvided) {
        createImages(spreadsheetName);
    } else {
        createImages();
    }
} else if (process.argv[2] == 'images') {
    console.log('Generating images...');
    if (isSpreadsheetProvided) {
        createImages(spreadsheetName);
    } else {
        createImages();
    }
} else {
    console.error('Something went wrong...');
}