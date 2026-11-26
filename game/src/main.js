// Boot and the main loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints the scene, the aircraft and
// the HUD. Screens: title, play, paused and debrief.
//
// ?seed=N fixes the world. ?shot=cover|cockpit|survey|debrief (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { PHASE_COMPLETE, PHASE_FAILED, createWorld } from './world.js';
import {
  ACTION_CAMERA,
  ACTION_CONFIRM,
  ACTION_FLAPS,
  ACTION_GEAR,
  ACTION_MENU,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { VIEW_CHASE, createCamera, toggleView } from './camera.js';
import { drawScene } from './render.js';
import { drawAircraftShadow, drawChaseAircraft, drawCockpit } from './aircraft.js';
import { drawDebriefPanel, drawHud, drawPauseOverlay, drawTitleScreen, titleMissionAt } from './hud.js';
import { createAudio } from './audio.js';
import { EVENT_CRASHED, EVENT_LANDED, EVENT_PHOTO, EVENT_RING } from './flight.js';
import { MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_DEBRIEF = 'debrief';
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const world = createWorld(createRandom(seed));
const camera = createCamera(VIEW_CHASE);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function paint(screen, best) {
  const width = canvas.width;
  const height = canvas.height;
  camera.update(world.flight, width, height);
  drawScene(ctx, camera, world, width, height);
  if (camera.view === VIEW_CHASE) {
    drawAircraftShadow(ctx, camera, world.flight);
    drawChaseAircraft(ctx, camera, world.flight, world.elapsed);
  } else {
    drawCockpit(ctx, world.flight, width, height);
  }
  drawHud(ctx, world, camera, width, height);
  if (screen === SCREEN_TITLE) drawTitleScreen(ctx, world, width, height, best);
  if (screen === SCREEN_PAUSED) drawPauseOverlay(ctx, width, height);
  if (screen === SCREEN_DEBRIEF) drawDebriefPanel(ctx, world, width, height, best);
}

function runShot(name) {
  canvas.width = 1280;
  canvas.height = 720;
  const scene = stageShot(name, world);
  camera.view = scene.view;
  let painted = 0;
  function frame() {
    paint(scene.screen === 'debrief' ? SCREEN_DEBRIEF : SCREEN_PLAY, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(frame);
    else window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function announce(message) {
    status.textContent = message;
  }

  function startSortie(missionId) {
    world.reset(missionId);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`${world.mission.name}. ${world.mission.brief}`);
  }

  function finishSortie() {
    screen = SCREEN_DEBRIEF;
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    announce(world.phase === PHASE_COMPLETE ? `Sortie complete. Score ${world.score}.` : 'Sortie failed.');
  }

  function handleActions() {
    const actions = input.takeActions();
    const choice = input.takeMissionChoice();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (choice !== null && MISSIONS[choice]) startSortie(MISSIONS[choice].id);
      else if (click) {
        const missionId = titleMissionAt(canvas.width, canvas.height, click.x, click.y);
        if (missionId) startSortie(missionId);
      }
      return;
    }
    if (actions & ACTION_MENU) {
      screen = SCREEN_TITLE;
      announce('Choose a sortie.');
      return;
    }
    if (actions & ACTION_RESTART) {
      startSortie(world.mission.id);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Flying.');
      }
      return;
    }
    if (screen === SCREEN_DEBRIEF) {
      if (actions & ACTION_CONFIRM) startSortie(world.mission.id);
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_CAMERA) {
      toggleView(camera);
      announce(camera.view === VIEW_CHASE ? 'Chase view.' : 'Cockpit view.');
    }
    if (actions & ACTION_FLAPS) {
      world.flight.flaps = !world.flight.flaps;
      world.say(world.flight.flaps ? 'Flaps down: slower stall, more drag' : 'Flaps up');
    }
    if (actions & ACTION_GEAR) {
      world.flight.gearDown = !world.flight.gearDown;
      world.say(world.flight.gearDown ? 'Gear down' : 'Gear up: cleaner and faster');
    }
  }

  function step() {
    const events = world.step(input.controls());
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_PHOTO) audio.photo();
    if (events & EVENT_LANDED) audio.touchdown(world.flight.damage > 10);
    if (events & EVENT_CRASHED) audio.crash();
    if (world.phase === PHASE_COMPLETE || world.phase === PHASE_FAILED) finishSortie();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
      audio.update(world.flight, STEP);
    } else {
      accumulator = 0;
    }
    paint(screen, best);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
