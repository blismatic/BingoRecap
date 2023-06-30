import { getHiscores } from 'osrs-wrapper';
import config from './config.json' assert { type: "json" };
import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { promises, existsSync, mkdirSync, readFileSync, exists } from 'fs';
import path, { join, dirname } from 'path'
import { fileURLToPath } from 'url';

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
            const stats = await getHiscores(rsn);

            // Write their data to a unique file
            const unique_path = `./${parent_folder_name}/${folder_name}/${team.name}/${rsn}.json`;
            const formatted_stats = JSON.stringify(stats, null, 4);
            await promises.writeFile(unique_path, formatted_stats);
        }
    }

}

async function createImages() {
    // if it doesn't already exist...
    // make a folder in ./images/ for each team, with the name of the folder being the name of the team
    const imagesDir = path.join(__dirname, 'images');
    if (!existsSync(imagesDir)) { mkdirSync(imagesDir, { recursive: true }); } // create the parent 'images' folder if it does not exist.
    for (const team of config.teams) {
        const teamDir = path.join(imagesDir, team.name);
        if (!existsSync(teamDir)) { mkdirSync(teamDir, { recursive: true }); } // create each teams folder if it does not exist.
    }

    // for each player, generate their own image. Generate one image for the entire team
    for (let teamIndex = 0; teamIndex < config.teams.length; teamIndex++) {
        const team = config.teams[teamIndex];

        let allPlayersStats = [];

        for (let playerIndex = 0; playerIndex < team.members.length; playerIndex++) {
            const player = team.members[playerIndex];
            const statsDelta = await compareStats(team.name, player);
            createImage(team.name, player, statsDelta);

            allPlayersStats.push(statsDelta);
        }

        createImage(team.name, team.name, combineObjects(allPlayersStats), `./images/${team.name}/${team.name}.png`);
    }
}

async function createImage(team_name, rsn, statsDelta, destination = `./images/${team_name}/${rsn}.png`) {
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
        // console.log('Success');
    }

    function shrinkFont(ctx, message, baseSize, padding, alignment, font = 'RuneScape-Quill') {
        // const exitMessage = config["exit_message"];
        ctx.textAlign = alignment;
        ctx.font = `${baseSize}px ${font}`;

        while (ctx.measureText(message).width > canvas.width - padding) {
            ctx.font = `${baseSize -= 5}px ${font}`;
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
                    // console.log('i am here 0');
                } else if (count % numColumns == i) {
                    // console.log('i am here ' + i);
                    xPos2 += xOffset * i;
                }
            }
            count++;
            // await drawBossElement(ctx, item.name, item[key], xPos2, yPos, scale);
            await drawElement(ctx, folder, item.name, item[key], xPos2, yPos, scale);
        }
    }

    async function drawElement(ctx, folder, itemName, itemKey, x, y, scale = 1) {
        const possibleFolders = ['bosses', 'clues', 'skills'];
        if (!possibleFolders.includes(folder)) {
            console.log(`Sorry, I can\'t accept ${folder} as a folder name...`);
        }

        // For bosses and clues, the suffix appeneded to the number should be kc. Otherwise, xp.
        let suffix = (folder == 'skills') ? 'xp' : 'kc';

        const fontSize = 60 * scale;
        ctx.font = `${fontSize}px RuneScape-Quill`;
        ctx.textAlign = 'left';
        try {
            const image = await Canvas.loadImage(`./resources/${folder}/${itemName}.png`);
            ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
            const textOrigin = { x: x + (image.width * scale) + 10, y: y + (image.height / 2) * scale };
            fillTextDropShadow(ctx, `+${convertToOsrsNumber(itemKey)} ${suffix}`, textOrigin.x, textOrigin.y, Colors.Green);
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

    let titleOrigin = { x: context.canvas.width / 2, y: 50 };
    fillTextDropShadow(context, config.title, titleOrigin.x, titleOrigin.y, Colors.Yellow);

    let subtitleOrigin = { x: titleOrigin.x, y: titleOrigin.y + 100 };
    fillTextDropShadow(context, config.subtitle, subtitleOrigin.x, subtitleOrigin.y, Colors.Yellow);

    context.font = '49px RuneScape-Quill';
    let welcome_messageOrigin = { x: titleOrigin.x, y: subtitleOrigin.y + 85 };
    const welcome_message = config.welcome_message.replace('<rsn>', rsn);
    fillTextDropShadow(context, welcome_message, welcome_messageOrigin.x, welcome_messageOrigin.y, Colors.White);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), welcome_messageOrigin.y + 40);

    // ===== skills card =====
    // Skills title
    context.font = '116px RuneScape-Quill';
    let skillsTitleOrigin = { x: titleOrigin.x, y: welcome_messageOrigin.y + 100 };
    fillTextDropShadow(context, 'Skills', skillsTitleOrigin.x, skillsTitleOrigin.y, Colors.White);

    yPos = skillsTitleOrigin.y + 100;
    const skills = statsDelta["skills"];
    const sortedSkills = sortSection(skills, 'xp')
    sortedSkills.shift(); // Remove the "overall" xp, since this will be calculated later

    // Skills subtitle
    context.font = '60px RuneScape-Quill';
    const totalXp = sortedSkills.reduce((sum, skill) => {
        return sum + Number(skill.xp);
    }, 0);
    fillTextDropShadow(context, `Total XP Gained: ${totalXp.toLocaleString()}`, context.canvas.width / 2, yPos, Colors.Orange);

    yPos -= 50;
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

        await drawElement(context, 'skills', skill.name, skill.xp, xPos, yPos, 0.7);
    }
    // await printElements(context, 'skills', sortedSkills, 'xp', 3, 150, 270, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos + 90);

    // ===== bosses card =====
    const bosses = statsDelta["bosses"];
    const sortedBosses = sortSection(bosses, 'kills');

    // Bosses title
    context.textAlign = 'center';
    context.font = '116px RuneScape-Quill';
    let bossesTitleOrigin = { x: titleOrigin.x, y: yPos += 150 };
    fillTextDropShadow(context, 'Bosses', bossesTitleOrigin.x, bossesTitleOrigin.y, Colors.White);

    // Bosses subtitle
    context.font = '60px RuneScape-Quill';
    const totalBosses = sortedBosses.reduce((sum, boss) => {
        return sum + Number(boss.kills);
    }, 0);
    fillTextDropShadow(context, `Total Bosses Killed: ${totalBosses.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

    // for each boss that has seen an increase in kill count, create a bossElement object for them
    yPos -= 50;
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

        await drawElement(context, 'bosses', boss.name, boss.kills, xPos, yPos, 0.7);
    }
    // await printElements(context, 'bosses', sortedBosses, 'kills', 4, 150, 200, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos + 90);

    // ===== clues card =====
    const minigames = statsDelta["minigames"];
    const sortedClues = sortSection(minigames, 'score', ["clueScrollsBeginner", "clueScrollsEasy", "clueScrollsMedium", "clueScrollsHard", "clueScrollsElite", "clueScrollsMaster"]);

    // Clues title
    context.textAlign = 'center';
    context.font = '116px RuneScape-Quill';
    let cluesTitleOrigin = { x: titleOrigin.x, y: yPos += 150 };
    fillTextDropShadow(context, 'Clues', cluesTitleOrigin.x, cluesTitleOrigin.y, Colors.White);

    // Clues subtitle
    context.font = '60px RuneScape-Quill';
    const totalClues = sortedClues.reduce((sum, clueType) => {
        return sum + Number(clueType.score);
    }, 0);
    fillTextDropShadow(context, `Total Caskets Opened: ${totalClues.toLocaleString()}`, context.canvas.width / 2, yPos += 100, Colors.Orange);

    // for each clue type that has seen an increase in score, create a clueElement object for them
    yPos -= 50;
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

        await drawElement(context, 'clues', clueType.name, clueType.score, xPos, yPos, 0.7);
    }
    // await printElements(context, 'clues', sortedClues, 'score', 3, 200, 250, 100, 0.7);

    context.drawImage(dividerImg, (canvas.width / 2) - (dividerImg.width / 2), yPos + 100);

    // ===== exit card =====
    const exitMessage = config["exit_message"];
    context.textAlign = 'center';
    context.font = shrinkFont(context, exitMessage, 100, 150, 'center', 'RuneScape-Quill');
    let exitTitleOrigin = { x: titleOrigin.x, y: yPos += 150 };
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
    // await promises.writeFile(`./images/${team_name}/${rsn}.png`, pngData);
    await promises.writeFile(destination, pngData)
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
                        if (oldObj[category][section][subKey] == '-1') { continue; }

                        // Subtract the oldObjects value for this subKey from the current value
                        newObj[category][section][subKey] -= oldObj[category][section][subKey];

                        // Turn it back into a string to stay consistent with the results from calling the osrs-wrapper api
                        newObj[category][section][subKey] = '' + newObj[category][section][subKey];
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
    } else {
        return (number / 1000000).toFixed(number < 100000000 ? 2 : 1) + 'm';
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

// const statsDelta = await compareStats('Zulrah Zoomers', 'DaMan2600');
// createImage('Zulrah Zoomers', 'DaMan2600', statsDelta, 'test1.png');
createImages()

// statsSetup(true);