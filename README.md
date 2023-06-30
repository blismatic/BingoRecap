## Prerequisites

This project runs on Node.js, which you can download [here](https://nodejs.org/en)
Before anything else, run this command to make sure you have all the required dependencies

```bash
npm install
```

## Setting up the config file

Open `./config.json` with your favorite text editor and configure your event. See `./schema.json` for more info. If there are no teams in your event, put everyone as members of a single team, with whatever team name you want

## How to use

Run this command once before the event to save everyones hiscore data in `./stats/before_event/`

```bash
node . before
```

After the event is over, run this command to save a new copy of everyones hiscore data in `./stats/after_event/` and generate images

```bash
node . after
```

Your pictures will be generated and saved in the `./images/` folder, separated by team.

If you want to generate the images but not re-query the hiscores api, run

```bash
node . images
```