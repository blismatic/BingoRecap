import { getHiscores } from 'osrs-wrapper';
import config from './config.json' assert { type: "json" };
import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { promises, existsSync, mkdirSync, readFileSync } from 'fs';
import path, { join, dirname } from 'path'
import { fileURLToPath } from 'url';
import { profile } from 'console';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let x = join(__dirname, 'resources', 'RuneScape-Fonts', 'ttf', 'RuneScape-Quill.ttf')
GlobalFonts.registerFromPath(x, 'RuneScape-Quill')

const Colors = {
    Yellow: '#ffde00',
    White: '#ffffff',
    Green: '#3ad212',
    Orange: '#ffae00',
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

function createImages() {
    // if it doesn't already exist...
    // make a folder in ./results/ for each team, with the name of the folder being the name of the team

    // for each
    // createImage('R elate', 'Zulrah Zoomers');
    for (let teamIndex = 0; teamIndex < config.teams.length; teamIndex++) {
        const team = config.teams[teamIndex];
        for (let playerIndex = 0; playerIndex < team.members.length; playerIndex++) {
            const player = team.members[playerIndex];
            createImage(team.name, player);
        }
    }
}

async function createImage(team_name, rsn, destination = `./images/${team_name}/${rsn}.png`) {
    const statsDelta = await compareStats2(team_name, rsn)

    // ===== canvas setup =====
    const width = 1080;
    // const height = 1920;
    const height = 2500;
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext('2d');
    const background = await Canvas.loadImage('./resources/background.png');
    // context.drawImage(background, 0, 0, canvas.width, canvas.height);

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

    async function drawSkillElement(ctx, skill, xp, x, y, scale = 1) {
        const fontSize = 60 * scale;
        ctx.font = `${fontSize}px RuneScape-Quill`;
        ctx.textAlign = 'left';
        const skillImage = await Canvas.loadImage(`./resources/skills/${skill}.png`);
        ctx.drawImage(skillImage, x, y, skillImage.width * scale, skillImage.height * scale);
        const textOrigin = { x: x + (skillImage.width * scale) + 10, y: y + (skillImage.height / 2) * scale };
        fillTextDropShadow(ctx, `+${convertToOsrsNumber(xp)} xp`, textOrigin.x, textOrigin.y, Colors.Green);
    }

    async function drawBossElement(ctx, boss, kc, x, y, scale = 1) {
        const fontSize = 60 * scale;
        ctx.font = `${fontSize}px RuneScape-Quill`;
        ctx.textAlign = 'left';
        try {
            const bossImage = await Canvas.loadImage(`./resources/bosses/${boss}.png`);
            ctx.drawImage(bossImage, x, y, bossImage.width * scale, bossImage.height * scale);
            const textOrigin = { x: x + (bossImage.width * scale) + 10, y: y + (bossImage.height / 2) * scale };
            fillTextDropShadow(ctx, `+${convertToOsrsNumber(kc)} kc`, textOrigin.x, textOrigin.y, Colors.Green);
        } catch (err) {
            console.log(`./resources/bosses/${boss}.png does not exist.`);
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

    // ===== skills card =====
    // Skills title
    context.font = '116px RuneScape-Quill';
    let skillsTitleOrigin = { x: titleOrigin.x, y: welcome_messageOrigin.y + 100 };
    fillTextDropShadow(context, 'Skills', skillsTitleOrigin.x, skillsTitleOrigin.y, Colors.White);

    let yPos = skillsTitleOrigin.y + 100;
    const skills = statsDelta["skills"];

    // Skills subtitle
    // await drawSkillElement(context, 'overall', skills['overall']["xp"], (context.canvas.width / 2) - 200, yPos);
    context.font = '60px RuneScape-Quill';
    fillTextDropShadow(context, `Total XP Gained: ${skills['overall']["xp"].toLocaleString()}`, context.canvas.width / 2, yPos, Colors.Orange);
    yPos -= 50;
    delete skills[Object.keys(skills)[0]];

    // loop through the skills and make a skillElement for any that have gained xp
    const filteredSkills = {};
    for (let key in skills) {
        if (skills.hasOwnProperty(key) && skills[key]["xp"] > 0) {
            filteredSkills[key] = skills[key];
        }
    }

    let count = 0;
    for (let skill in filteredSkills) {
        const xp = skills[skill]["xp"];

        let xPos = 150;
        let xOffset = 270
        if (count % 3 == 0) {
            yPos += 100;
        } else if (count % 3 == 1) {
            xPos += xOffset;
        } else if (count % 3 == 2) {
            xPos += xOffset * 2;
        }
        count++;

        await drawSkillElement(context, skill, xp, xPos, yPos, 0.7);
    }

    // ===== bosses card =====
    const bosses = statsDelta["bosses"];
    // loop through the bosses and make a skillElement for any that have gained kill count
    // create a new object 'filteredBosses' that only includes the bosses that have seen an increase in kill count
    const filteredBosses = {};
    for (let key in bosses) {
        if (bosses.hasOwnProperty(key) && bosses[key]["kills"] > 0) {
            filteredBosses[key] = bosses[key];
            // console.log('But I am here. ' + key + " " + bosses[key]["kills"]);
        } else {
            // console.log('I am here. ' + key + " " + bosses[key]["kills"]);
        }
    }
    // Bosses title
    context.textAlign = 'center';
    context.font = '116px RuneScape-Quill';
    yPos += 150;
    let bossesTitleOrigin = { x: titleOrigin.x, y: yPos };
    fillTextDropShadow(context, 'Bosses', bossesTitleOrigin.x, bossesTitleOrigin.y, Colors.White);

    // Bosses subtitle
    context.font = '60px RuneScape-Quill';
    yPos += 100;
    const totalBosses = Object.values(filteredBosses).reduce((sum, boss) => {
        const kills = parseInt(boss.kills, 10);
        return sum + (isNaN(kills) ? 0 : kills);
    }, 0);
    // console.log(filteredBosses);
    // console.log(totalBosses.toLocaleString());
    // console.log(totalBosses);
    fillTextDropShadow(context, `Total Bosses Killed: ${totalBosses.toLocaleString()}`, context.canvas.width / 2, yPos, Colors.Orange);

    // for each boss in filteredBosses, create a skillElement object for them
    yPos -= 50;
    count = 0;
    for (let boss in filteredBosses) {
        const killCount = bosses[boss]["kills"];

        let xPos = 150;
        let xOffset = 200
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

        await drawBossElement(context, boss, killCount, xPos, yPos, 0.7);
    }

    // ===== clues card =====

    // ===== exit card =====

    // save image
    // canvas.height = yPos;
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

    // Create a new object to store the differences
    const diff = {};

    // Loop through the new profile and compare to the old profile
    for (const key of Object.keys(newProfile)) {
        for (const elem of Object.keys(newProfile[key])) {
            // console.log(">>comparator.js@compareStats: (lvl 2 forloop)", "Key : ", key, "Element : ", elem);
            diff[key] = oldProfile[key]; //Setting up the output object
            for (const nestedKey in oldProfile[key][elem]) {
                diff[key][elem] = oldProfile[key][elem]; //Setting up the output object
                //console.log(">>comparator.js@compareStats: (lvl 3 forloop) ","Nested key : ", nestedKey);

                if (oldProfile[key][elem][nestedKey] !== newProfile[key][elem][nestedKey]) {
                    //Value is different, add the difference to the diff object
                    diff[key][elem][nestedKey] = newProfile[key][elem][nestedKey] - oldProfile[key][elem][nestedKey];
                } else {
                    //Value is the same, add it to the diff object with a value of 0
                    diff[key][elem][nestedKey] = 0;
                }
            }
        }
    }
    // Return the diff object
    return diff;
}

async function compareStats2(teamName, playerName) {
    // Fetch the two profiles and compare them
    const oldProfile = await fetchCachedStats(teamName, playerName, 'before_event');
    const newProfile = await fetchCachedStats(teamName, playerName, 'after_event');

    function getObjectDifference(oldObj, newObj) {
        // Look at each category in new object. This should be "skills, minigames, and bosses"
        for (let category in newObj) {
            for (let section in newObj[category]) {

                // If there exists a category with the same name in old object...
                if (Object.keys(oldObj[category]).includes(section)) {
                    // console.log('I am here.');

                    // Look at each subKey (for the "skills" category, this is "rank, level, and xp")
                    for (let subKey in newObj[category][section]) {
                        // Subtract the oldObjects value for this subKey from the current value
                        newObj[category][section][subKey] -= oldObj[category][section][subKey];
                    }
                }
            }
        }
        // console.log('-----------------------');
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

// const output = await compareStats2('Zulrah Zoomers', 'R elate');
// console.log(output);
// console.log(typeof output["skills"])
// const test = output["bosses"]
// delete test[Object.keys(test)[0]];
// const totalBosses = Object.values(test).reduce((sum, obj) => sum + obj.kills, 0);
// console.log(totalBosses.toLocaleString());

createImage('Zulrah Zoomers', 'R elate', 'test1.png')
// createImage('Bandos Boomers', 'philistine1', 'test1.png');

// console.log(convertToOsrsNumber(92882));

// const stats = await getHiscores('R elate');
// console.log(stats);

// statsSetup(true);

const oldProfile = {
    "skills": {
        "attack": { "rank": 103411, "level": 99, "xp": 17012567 },
        "defence": { "rank": 69520, "level": 99, "xp": 16847737 },
        "strength": { "rank": 12961, "level": 99, "xp": 57847661 }
    },
    "bosses": {
        "abyssalSire": { "rank": 39744, "kills": 533 },
        "alchemicalHydra": { "rank": 64022, "kills": 763 },
        "barrowsChests": { "rank": 222248, "kills": 201 }
    }
};

const newProfile = {
    "skills": {
        "attack": { "rank": 105373, "level": 99, "xp": 17163175 },
        "defence": { "rank": 63609, "level": 99, "xp": 17488901 },
        "strength": { "rank": 12014, "level": 99, "xp": 62828787 }
    },
    "bosses": {
        "abyssalSire": { "rank": 41724, "kills": 533 },
        "alchemicalHydra": { "rank": 62696, "kills": 830 },
        "artio": { "rank": 25278, "kills": 64 },
        "barrowsChests": { "rank": 196144, "kills": 241 }
    }
};

function getObjectDifference(oldObj, newObj) {
    // Look at each category in new object. This should be "skills, minigames, and bosses"
    for (let category in newObj) {
        for (let section in newObj[category]) {

            // If there exists a category with the same name in old object...
            if (Object.keys(oldObj[category]).includes(section)) {
                console.log('I am here.');

                // Look at each subKey (for the "skills" category, this is "rank, level, and xp")
                for (let subKey in newObj[category][section]) {
                    // Subtract the oldObjects value for this subKey from the current value
                    newObj[category][section][subKey] -= oldObj[category][section][subKey];
                }
            }
        }
    }
    // console.log('-----------------------');
    return newObj;
}

console.log(await compareStats('Zulrah Zoomers', 'R elate'));
console.log('-----------------------------------------------------------');
console.log(await compareStats2('Zulrah Zoomers', 'R elate'));