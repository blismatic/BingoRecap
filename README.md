## Prerequisites

This project runs on Node.js, which you can download [here](https://nodejs.org/en). 

Before anything else, run this command to make sure you have all the required dependencies

```bash
npm install
```

## Setting up the config file

Open `./config.json` with your favorite text editor and configure your event. See `./schema.json` for more info. If there are no teams in your event, put everyone as members of a single team, with whatever team name you want

## Setting up the spreadsheet file

*This step is completely optional, the script can still run without providing a spreadsheet.*

If provided a properly formatted spreadsheet, the recap images can include a "drops" section that will show all of the drops each player got throughout the event. In order for this work, the spreadsheet must be formatted according to the following:
   
|       |       | Team1   | Team1   | Team2   | Team2   | Team3   |
| ----- | ----- | ------- | ------- | ------- | ------- | ------- |
| Item  | Price | PlayerA | PlayerB | PlayerC | PlayerD | PlayerE |
| itemA | 500   | 1       | 4       | 5       | 0       | 1       |
| itemB | 400   | 0       | 1       | 0       | 3       | 1       |
| itemC | 0     | 2       | 0       | 1       | 2       | 2       |

- For drops that do not have an inherit value (pets, jars, etc) you can leave the "Price" column blank or input "0".
- The name in the "Item" column must match exactly with the filename (excluding extension) of the item's image in the `./resources/items/` folder, otherwise the script will crash.
  - For example, if I have the item "Magma mutagen" in my spreadsheet, there *must* exist the file `./resources/items/Magma mutagen.png`
- In the "Price" column, simply type the gp value of the item (do not include commas or any text before or after the number).
- An example spreadsheet has been included for you, but as long as your spreadsheet is properly formatted, it can come from anywhere. 
  - To generate a blank spreadsheet based on the `./config.json` file, use `npm run generateSpreadsheet`.
- Because I don't have the time to include every single item thumbnail in the `./resources/items/` folder, I will leave that up to you to include based on the specific drops that are part of your event.
  - For best results, make sure the item thumbnail dimensions are 100x100 pixels.
- Make sure that the team names and player names in the spreadsheet match exactly with the team and player names found in the `./config.json` file.

## How to use

Run this command once before the event to save everyones hiscore data in `./stats/before_event/`

```bash
node . before
```

After the event is over, run this command to save a new copy of everyones hiscore data in `./stats/after_event/` and generate images

```bash
node . after [spreadsheet]
```

Your pictures will be generated and saved in the `./images/` folder, separated by team.

If you want to generate the images but not re-query the hiscores api, run

```bash
node . images [spreadsheet]
```

This can be useful if you want to play around with how the `createImage` function works and want to see the changes after each call.

##### Disclaimer

*Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. This content is not endorsed by or affiliated with Jagex.*

##### Developer notes (ignore this)

Run `npm outdated` and `npm update` to update the `package-lock.json` file, and then run `npm update --save` to update the `package.json` file. Both of these *should* be committed to version control.

Run `npm version <major/minor/patch>` to update and commit a new version.

For finding runelite cache sprite ID's: visit [here](https://github.com/runelite/runelite/blob/master/runelite-api/src/main/java/net/runelite/api/SpriteID.java)

For downloading runelite cache dump: visit [here](https://github.com/abextm/osrs-cache/releases) (download the `.tar.gz`)

For upscaling and centering those sprites: `ffmpeg -i "<in-file>" -vf "scale=w=100:h=100:force_original_aspect_ratio=decrease:flags=neighbor,pad=100:100:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -frames:v 1 -update 1 "<out-file>"`

Batch upscaling + renaming sprite ID's: `node utility.js -i <inputPath> -o <outputPath>`

When adding support for new bosses / skills / minigames, make sure to update the `subcategories` object in `./mvp.mjs`