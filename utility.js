import { readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import exec from 'child_process';
import path from 'node:path';
import yargs from 'yargs';


// const inputDir = './resources/bosses';
// const outputDir = './resources/bosses';
const argv = yargs
    .option('input', {
        alias: 'i',
        description: 'Path to the input directory',
        type: 'string',
        demandOption: true,
        coerce: (arg) => {
            // Resolve the path to an absolute path
            const inPath = path.resolve(arg);

            // Check if the path exists and is a directory
            if (!existsSync(inPath)) {
                throw new Error(`The directory at path ${inPath} does not exist.`);
            }

            if (!statSync(inPath).isDirectory()) {
                throw new Error(`${inPath} is not a valid directory.`);
            }
            return inPath;
        }
    })
    .option('output', {
        alias: 'o',
        description: "Path to the output directory",
        type: 'string',
        demandOption: true,
        coerce: (arg) => {
            const outPath = path.resolve(arg);
            if (!existsSync(outPath)) {
                mkdirSync(outPath)
            }
            return outPath;
        }
    })
    .help()
    .argv;

// This hashmap relates the runelite sprite id to the 'osrs-wrapper' name for a given hiscore entity
const spriteToNameMap = {
    4276: "abyssalSire",
    4289: "alchemicalHydra",
    5639: "amoxliatl",
    5638: "araxxor",
    5622: "artio",
    4267: "barrowsChests",
    4262: "bryophyta",
    5622: "callisto",
    5623: "calvarion",
    4280: "cerberus",
    4288: "chambersOfXeric",
    4296: "chambersOfXericChallengeMode",
    5621: "chaosElemental",
    5625: "chaosFanatic",
    4284: "commanderZilyana",
    4287: "corporealBeast",
    5626: "crazyArchaeologist",
    4294: "dagannothPrime",
    4293: "dagannothRex",
    4292: "dagannothSupreme",
    5627: "derangedArchaeologist",
    5632: "dukeSucellus",
    4282: "generalGraardor",
    4263: "giantMole",
    4264: "grotesqueGuardians",
    4271: "hespori",
    4270: "kalphiteQueen",
    4274: "kingBlackDragon",
    4275: "kraken",
    4285: "kreearra",
    4283: "krilTsutsaroth",
    5637: "lunarChests",
    4260: "mimic",
    4291: "nex",
    4286: "nightmare",
    4286: "phosanisNightmare",
    4261: "obor",
    4299: "phantomMuspah",
    4269: "sarachnis",
    5628: "scorpia",
    5635: "scurrius",
    4272: "skotizo",
    5636: "solHeredit",
    5624: "spindel",
    4265: "tempoross",
    4278: "gauntlet",
    4295: "corruptedGauntlet",
    5640: "hueycoatl",
    5633: "leviathan",
    6345: "royalTitans",
    5631: "whisperer",
    4290: "theatreOfBlood",
    4290: "theatreOfBloodHardMode",
    4277: "thermonuclearSmokeDevil",
    4297: "tombsOfAmascut",
    4298: "tombsOfAmascutExpertMode",
    5630: "tzKalZuk",
    5629: "tzTokJad",
    5634: "vardorvis",
    5624: "venenatis",
    5623: "vetion",
    4281: "vorkath",
    4266: "wintertodt",
    4273: "zalcano",
    4279: "zulrah"
}

readdirSync(argv.input).forEach(file => {
    if (path.extname(file).toLowerCase() !== '.png') {
        return;
    } else if (!Object.keys(spriteToNameMap).includes(path.basename)) {
        return;
    }

    const inputPath = path.join(argv.input, file);
    const outputPath = path.join(argv.output, spriteToNameMap[path.basename]);

    const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w=100:h=100:force_original_aspect_ratio=decrease:flags=neighbor,pad=100:100:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -frames:v 1 -update 1 "${outputPath}"`;

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error processing ${file}:`, error.message);
        } else {
            console.log(`Resized ${file}`);
        }
    });
});