## Setup

Open `./config.json` and configure your event. See `./schema.json` for more info. If there are no teams in your event, put everyone as members of a single team, with whatever team name you want

## How to use

Run this command once before the event to save everyones hiscore data

```javascript
statsSetup(0);
```

After the event is over, run this command to save a new copy of everyones hiscore data

```javascript
statsSetup(1);
```

When you want to generate your images, run

```javascript
createImages();
```

Your pictures will be generated and saved in the `./images/` folder, separated by team.