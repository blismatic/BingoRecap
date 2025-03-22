import { readFileSync, readdirSync } from 'node:fs';
import path from 'path'

// Function to get the MVP (best player) for a specific category and subcategory across all teams
const getSpecificMVPs = (category, subcategory) => {
    const teamNames = readdirSync(path.join('stats', 'before_event'));
    let mvps = [];

    teamNames.forEach(teamName => {
        const players = readdirSync(path.join('stats', 'before_event', teamName));
        let bestPlayer = null;
        let bestDifference = -Infinity;

        players.forEach(playerFileName => {
            const playerName = playerFileName.slice(0, -5); // Remove the `.json` suffix
            const statsDifferences = compareStats(teamName, playerName);

            const datapointsMap = {
                "skills": "xp",
                "minigames": "score",
                "bosses": "kills"
            }
            // console.log(statsDifferences);
            // console.log(`${playerName}, ${category}, ${subcategory}, ${datapointsMap[category]}`)
            // console.log(`statsDifferences[${category}][${subcategory}][${datapointsMap[category]}]`);
            // console.log(statsDifferences[category]['dagannothPrime']['kills'])
            if (!(Object.keys(statsDifferences[category]).includes(subcategory))) {
                return; // Skip this iteration of the inner forEach loop
            }
            let specificDifference = statsDifferences[category][subcategory][datapointsMap[category]];

            // Check if this player has the best difference for this particular thing out of the whole team, so far.
            if (specificDifference > bestDifference) {
                bestDifference = specificDifference;
                bestPlayer = playerName;
            }
        });

        if (bestPlayer && bestDifference > 0) {
            mvps.push({ name: bestPlayer, difference: bestDifference });
        }
    });

    // Sort players by the largest difference, descending
    mvps.sort((a, b) => b.difference - a.difference);

    // Return the sorted player names, by difference
    return mvps.map(player => player.name);

}

// const getTeamMVPs <--- maybe make *this* into a function instead?

const getAllMVPs = () => {
    const categories = ['skills', 'minigames', 'bosses'];
    const subcategories = {
        skills: ['overall', 'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic', 'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting', 'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming', 'runecrafting', 'hunter', 'construction'],
        minigames: ['leaguePoints', 'deadmanPoints', 'bountyHunter', 'bountyHunterRogues', 'bountyHunterLegacy', 'bountyHunterRoguesLegacy', 'clueScrollsAll', 'clueScrollsBeginner', 'clueScrollsEasy', 'clueScrollsMedium', 'clueScrollsHard', 'clueScrollsElite', 'clueScrollsMaster', 'lms', 'pvpArena', 'soulWarsZeal', 'riftsClosed', 'colosseumGlory'],
        bosses: ['abyssalSire', 'alchemicalHydra', 'amoxliatl', 'araxxor', 'artio', 'barrowsChests', 'bryophyta', 'callisto', 'calvarion', 'cerberus', 'chambersOfXeric', 'chambersOfXericChallengeMode', 'chaosElemental', 'chaosFanatic', 'commanderZilyana', 'corporealBeast', 'crazyArchaeologist', 'dagannothPrime', 'dagannothRex', 'dagannothSupreme', 'derangedArchaeologist', 'dukeSucellus', 'generalGraardor', 'giantMole', 'grotesqueGuardians', 'hespori', 'kalphiteQueen', 'kingBlackDragon', 'kraken', 'krilTsutsaroth', 'lunarChests', 'mimic', 'nex', 'nightmare', 'phosanisNightmare', 'obor', 'phantomMuspah', 'sarachnis', 'scorpia', 'scurrius', 'skotizo', 'solHeredit', 'spindel', 'tempoross', 'gauntlet', 'corruptedGauntlet', 'hueycoatl', 'leviathan', 'royalTitans', 'whisperer', 'theatreOfBlood', 'theatreOfBloodHardMode', 'thermonuclearSmokeDevil', 'tombsOfAmascut', 'tombsOfAmascutExpertMode', 'tzKalZuk', 'tzTokJad', 'vardorvis', 'venenatis', 'vetion', 'vorkath', 'wintertodt', 'zalcano', 'zulrah']
    };

    const allMVPs = {};

    categories.forEach(category => {
        allMVPs[category] = {};
        subcategories[category].forEach(subcategory => {
            const mvpList = getSpecificMVPs(category, subcategory);
            allMVPs[category][subcategory] = mvpList;
        });
    });

    return allMVPs;
}

const fetchCachedStats = (teamName, playerName, beforeOrAfter) => {
    // Fetch profile from JSON file stored locally
    const statsPath = `./stats/${beforeOrAfter}/${teamName}/${playerName}.json`;
    const profile = JSON.parse(readFileSync(statsPath), 'utf8');
    return profile;
}

const compareStats = (teamName, playerName) => {
    // Fetch the two profiles and compare them
    const oldProfile = fetchCachedStats(teamName, playerName, 'before_event');
    const newProfile = fetchCachedStats(teamName, playerName, 'after_event');

    // Look at each category in the new profile. This shouldbe "skills", "minigames", and "bosses"
    for (const category in newProfile) {
        // and then look at each subcategory. This should be things like "attack", "defence", "clueScrollsEasy", "abyssalSire", etc
        for (const subcategory in newProfile[category]) {
            // If there exists a section with the same name in the oldProfile...
            if (Object.keys(oldProfile[category]).includes(subcategory)) {
                // Look at each datapoint in the new profile (rank / level / xp / score / kills)
                for (const datapoint in newProfile[category][subcategory]) {
                    // If the value of that datapoint is -1 in the oldProfile (meaning that the player never had that thing tracked originally), dont actually subtract it, since subtracting a negative would create an erroneous positive value.
                    if (oldProfile[category][subcategory][datapoint] === -1) {
                        continue;
                    }

                    // Subtract the oldProfiles value for this particular datapoint from the newProfiles value
                    newProfile[category][subcategory][datapoint] -= oldProfile[category][subcategory][datapoint];
                }
            }

            // For any datapoints that are -1, just set them to 0.
            // - - This will catch any cases where the subcategory is new, and therefore wasn't also found in the oldProfile
            // - - or when the user wasn't ranked in this section at all
            for (const datapoint in newProfile[category][subcategory]) {
                if (newProfile[category][subcategory][datapoint] === -1) {
                    newProfile[category][subcategory][datapoint] = 0;
                }
            }
        }
    }

    return newProfile;
}

export { getSpecificMVPs, getAllMVPs, fetchCachedStats, compareStats }