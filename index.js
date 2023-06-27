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
            createImage(player, team.name);
        }
    }
}

async function createImage(rsn, team_name, stats_pre, stats_post) {
    // subtract stats_pre from stats_post to get stats_delta

    // canvas setup
    const canvas = Canvas.createCanvas(700, 250);
    const context = canvas.getContext('2d');
    const background = await Canvas.loadImage('./resources/background.png');
    context.drawImage(background, 0, 0, canvas.width, canvas.height);

    // title card
    // context.font = '60px Arial';
    context.font = '60px RuneScape-Quill'
    context.fillStyle = '#ffffff';
    context.fillText(rsn, 10, 50);

    // skills card

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
    await promises.writeFile(`./images/${team_name}/${rsn}.png`, pngData);
}

async function fetchOldStats(teamName, playerName) {
    // Fetch profile from JSON file stored locally
    //const profile = import(`./stats/before_event/${teamName}/${playerName}.json`)
    console.log("Reading file : " , `./stats/before_event/${teamName}/${playerName}.json`);
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

async function compareStats(teamName, playerName) {
    // Fetch the two profiles and compare them
    const oldProfile = await fetchOldStats(teamName, playerName);
    const newProfile = await fetchNewStats(playerName);
    // Create a new object to store the differences
    const diff = {};

    // Loop through the new profile and compare to the old profile
    for (const key of Object.keys(newProfile)) {
        for(const elem of Object.keys(newProfile[key])){
            //console.log(">>comparator.js@compareStats: (lvl 2 forloop)", "Key : ", key, "Element : ", elem);
            diff[key] = oldProfile[key]; //Setting up the output object
            for(const nestedKey in oldProfile[key][elem]){
                diff[key][elem] = oldProfile[key][elem]; //Setting up the output object
                //console.log(">>comparator.js@compareStats: (lvl 3 forloop) ","Nested key : ", nestedKey);

                if(oldProfile[key][elem][nestedKey] !== newProfile[key][elem][nestedKey]){
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

const output = await compareStats('Zulrah Zoomers' , 'R elate')
console.log(output)
// createImages();
//statsSetup(0);
createImages();
// statsSetup(0);
