# Auburn Command Center V2

Upload this entire folder/repository to GitHub, then import the repo into Vercel.

## Required Vercel environment variable

CFBD_API_KEY

Use the same CollegeFootballData API key from your existing Auburn project.

## Files

- index.html
- api/auburn-scoreboard.js
- api/auburn-pregame.js
- api/auburn-season.js
- api/auburn-game-center.js
- api/sec-standings.js
- api/college-scoreboard.js

No npm install or package.json is required for this version.


## Expanded Live Stats Build
Includes full team comparison, player passing/rushing/receiving tables, 3rd/4th down percentages, drive center, advanced live metrics, recent plays, and a full-screen WAR EAGLE Auburn scoring takeover.


## Game Day Viewport Upgrade
- Desktop and iPad use a fixed-screen dashboard layout with no page scrolling.
- Phone keeps natural vertical scrolling.
- LIVE STATS now uses OVERVIEW / PLAYERS / DRIVES panes.
- SEC + TOP 25 ticker advances complete matchup cards and loops seamlessly.
- Auburn accent orange is locked to #F26522.
- Auburn score events use a full-screen WAR EAGLE takeover.


## Full Live Box Score Upgrade

This build hardens the real-game experience:
- Correct ordinal formatting: 1ST, 2ND, 3RD, 4TH, 11TH, 21ST, etc.
- Broadcast-style Auburn vs opponent team comparison bars.
- Team stats include plays, yards, yards/play, pass/rush, first downs, 3rd/4th downs,
  turnovers, fumbles lost, interceptions, sacks, penalties, penalty yards,
  possession, scoring opportunities, and points per drive.
- Full Auburn player categories: passing, rushing, receiving, kicking, punting,
  returns, and defense.
- `/plays/stats` is used when available for structured player associations.
- Drive Center now includes current drive, previous drive, and recent drive history.
