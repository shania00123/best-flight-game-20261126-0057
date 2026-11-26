# Kestrel Ridge — Coastal Flight Trials

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/shania00123/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/shania00123/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Kestrel Ridge is an original flight game that runs in a desktop browser from static files, with no network request. Fly the Kestrel K-7 over a curved west coast, farmland plains, a city, a mirror lake and a mountain wall with one flyable pass — take off from the strip, work the throttle, flaps and gear, and bring her home through real weather, against a ghost rival, on the fuel you chose.

Seven sorties, escalating weather:

- **Ridge Rings** — six rings, a route choice after ring 2 (gusty Coast Shortcut +800 or thermal Ridge High Road +500), racing the par ghost, then land in the gold touchdown zone.
- **Coastal Survey** — photograph City Centre, Lighthouse Point, Mountain Pass and Mirror Lake inside their altitude bands against a freshening wind, then land.
- **Crosswind Circuit** — one circuit gate, then a crosswind final: crab into wind and put it in the touchdown zone.
- **Storm Ridge** — the ring course in a gust front with ridge shake; ride the thermals or fight them.
- **Deadstick Return** — the engine quits over the lake; spend stored height wisely or circle a thermal for free climb, then land.
- **Dusk Final** — last light, tight fuel, crosswind final and the ghost to beat.
- **Free Flight** — no clock, no orders: explore and land where you like.

Every sortie is a decision: pick a fuel load (**L** on the title screen — light climbs fast but forbids detours, full is heavy with a higher stall), read the wind and gust panel, watch the bingo-fuel number (fuel needed to get home) before you commit to a detour, chase or refuse the thermals, and fly the glidepath lights to a touchdown-zone landing graded from "Greased it in the zone" to a belly arrival if the gear is still up. Chase and cockpit cameras, a full HUD (compass, speed and altitude tapes, pitch ladder, minimap with thermals and the ghost, wind/gust/bingo panel, glidepath indicator), dial gauges with warning lamps, and procedural engine and wind audio complete the sortie.

How to play: **arrow keys** pitch and roll, **W/S** throttle, **A/D** rudder, **mouse drag** steers, **wheel** throttle, **F** flaps, **G** gear, **B/Space** brake, **C** camera, **P** pause, **R** restart, **M** mute. On the title screen press **1–7** or click a sortie, and **L** to change the fuel load.

The game is original, written for this bounty in plain JavaScript and canvas — no libraries, no downloaded assets, no network calls. Screenshots in `screenshots/` are real renders of the game's own code, staged by `game/src/shots.js` (`?shot=cover|cockpit|survey|debrief&seed=20261126`) and rasterised by `tools/record-shots.mjs` + `tools/render-shots.py`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r27sfaxp&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
