import { getHiscores } from 'osrs-wrapper';
import config from './config.json' assert { type: "json" };
import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { promises, existsSync, mkdirSync } from 'fs';
import path, { join, dirname } from 'path'
import { fileURLToPath } from 'url';

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

createImages();
// statsSetup(0);