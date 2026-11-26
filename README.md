# Kestrel Ridge — Coastal Flight Trials

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/shania00123/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/shania00123/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Kestrel Ridge is an original flight game that runs in a desktop browser from static files, with no network request. Fly the Kestrel K-7 over a curved west coast, farmland plains, a city, a mirror lake and a mountain wall with one flyable pass — take off from the strip, work the throttle, flaps and gear, and bring her home.

Four sorties:

- **Ridge Rings** — thread all six rings in order (Climb Gate, Coast Turn, Harbour Sweep, City Crossing, Ridge Pass, Lake Return), then land on the strip.
- **Coastal Survey** — photograph City Centre, Lighthouse Point, Mountain Pass and Mirror Lake inside their altitude bands, then land.
- **Deadstick Return** — the engine quits over the lake; glide home on stored height and land.
- **Free Flight** — no clock, no orders: explore and land where you like.

The flight model rewards discipline: bank to turn, trade speed for height, respect the stall (flaps lower it, drag raises the bill), watch fuel and damage, and flare for a smooth, centred touchdown — landings are graded from "Greased it" to a belly arrival if the gear is still up. Chase and cockpit cameras, a full HUD (compass, speed and altitude tapes, pitch ladder, minimap, target marker), dial gauges with warning lamps, and procedural engine and wind audio complete the sortie.

How to play: **arrow keys** pitch and roll, **W/S** throttle, **A/D** rudder, **mouse drag** steers, **wheel** throttle, **F** flaps, **G** gear, **B/Space** brake, **C** camera, **P** pause, **R** restart, **M** mute. On the title screen press **1–4** or click a sortie.

The game is original, written for this bounty in plain JavaScript and canvas — no libraries, no downloaded assets, no network calls. Screenshots in `screenshots/` are real renders of the game's own code, staged by `game/src/shots.js` (`?shot=cover|cockpit|survey|debrief&seed=20261126`) and rasterised by `tools/record-shots.mjs` + `tools/render-shots.py`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=r27sfaxp&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
