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
console.log(x)
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
        // console.log(team.name);
        for (let playerIndex = 0; playerIndex < team.members.length; playerIndex++) {
            const player = team.members[playerIndex];
            // console.log(player);
            createImage(team.name, player);
        }
    }
}

async function createImage(team_name, rsn, destination = `./images/${team_name}/${rsn}.png`) {
    // statsDelta should be the result from a call to compareStats
    const statsDelta = await compareStats(team_name, rsn)

    // canvas setup
    const width = 1080
    const height = 1920
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext('2d');
    const background = await Canvas.loadImage('./resources/background.png');
    context.drawImage(background, 0, 0, canvas.width, canvas.height);

    // helper functions
    async function fillTextDropShadow(ctx, text, x, y, colorCode, shadowDistance = 5) {
        // Draw the shadow first
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x - shadowDistance, y + shadowDistance);

        // Then draw the actual text
        ctx.fillStyle = colorCode;
        ctx.fillText(text, x, y)
        // console.log('Success');
    }

    async function drawSkillElement(ctx, skill, xp, x, y) {
        const skillImage = await Canvas.loadImage(`./resources/skills/${skill}.png`)
        ctx.drawImage(skillImage, x, y)
        fillTextDropShadow(ctx, xp.toLocaleString(), x + 20, y, Colors.Green)
    }

    // title card
    let titleOrigin = { x: context.canvas.width / 2, y: 50 };
    let subtitleOrigin = { x: titleOrigin.x, y: titleOrigin.y + 100 };
    let welcome_messageOrigin = { x: titleOrigin.x, y: subtitleOrigin.y + 85 };
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '143px RuneScape-Quill';

    fillTextDropShadow(context, config.title, titleOrigin.x, titleOrigin.y, Colors.Yellow);
    fillTextDropShadow(context, config.subtitle, subtitleOrigin.x, subtitleOrigin.y, Colors.Yellow);

    context.font = '49px RuneScape-Quill';
    const welcome_message = config.welcome_message.replace('<rsn>', rsn);
    fillTextDropShadow(context, welcome_message, welcome_messageOrigin.x, welcome_messageOrigin.y, Colors.White);

    // skills card
    console.log(statsDelta["skills"]['hitpoints']['xp'].toLocaleString());
    drawSkillElement(context, 'hitpoints', statsDelta["skills"]['hitpoints']['xp'], context.canvas.width / 2, 150);

    // bosses card

    // clues card

    // exit card

    // save image
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

async function fetchOldStats(teamName, playerName) {
    // Fetch profile from JSON file stored locally
    //const profile = import(`./stats/before_event/${teamName}/${playerName}.json`)
    console.log("Reading file : ", `./stats/before_event/${teamName}/${playerName}.json`);
    var profile = JSON.parse(readFileSync(`./stats/before_event/${teamName}/${playerName}.json`, 'utf8'));

    return profile;
}

async function fetchNewStats(playerName) {
    // Fetch profile using the OSRS Hiscores API
    //const response = await fetch(`${URI}${playerName}`) // Actual API call

    // Fetch profile using the OSRS Wrapper
    const profile = await getHiscores(playerName); // Use this line with the wrapper
    console.log(profile);
    return profile;
}

async function fetchCachedStats(teamName, playerName, beforeOrAfter) {
    // Fetch profile from JSON file stored locally
    let statsFile = `./stats/${beforeOrAfter}/${teamName}/${playerName}.json`
    let profile = JSON.parse(readFileSync(statsFile), 'utf8')
    return profile
}

async function compareStats(teamName, playerName) {
    // Fetch the two profiles and compare them
    // const oldProfile = await fetchOldStats(teamName, playerName);
    // const newProfile = await fetchNewStats(playerName);
    const oldProfile = await fetchCachedStats(teamName, playerName, 'before_event');
    const newProfile = await fetchCachedStats(teamName, playerName, 'after_event')
    // Create a new object to store the differences
    const diff = {};

    // Loop through the new profile and compare to the old profile
    for (const key of Object.keys(newProfile)) {
        for (const elem of Object.keys(newProfile[key])) {
            //console.log(">>comparator.js@compareStats: (lvl 2 forloop)", "Key : ", key, "Element : ", elem);
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

// const output = await compareStats('Zulrah Zoomers', 'R elate')
// console.log(output)
// console.log(typeof output["skills"])
// const test = output["skills"]
// delete test[Object.keys(test)[0]];
// const totalXp = Object.values(test).reduce((sum, obj) => sum + obj.xp, 0);
// console.log(totalXp.toLocaleString());
createImage('Zulrah Zoomers', 'R elate', 'test1.png')


// statsSetup(true);