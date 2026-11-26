// Staged screenshot scenes behind ?shot=cover|cockpit|survey|debrief. Each
// scene puts the aircraft on a real flight path in the real world, then
// steps the flight model forward under a simple autopilot, so every frame
// is a moment the game itself can reach and the same seed repeats it.
// The cover stages the rival's signature moment: a large ring dead ahead,
// the par ghost racing it, weather and route readouts live on the HUD.
import { STEP, WORLD, clamp } from './config.js';
import { bearingTo, shortestAngle } from './flight.js';
import { MISSION_CROSSWIND, MISSION_DEADSTICK, MISSION_RINGS, RING_COURSE } from './missions.js';
import { PHASE_COMPLETE } from './world.js';

export const SHOT_COVER = 'cover';
export const SHOT_COCKPIT = 'cockpit';
export const SHOT_SURVEY = 'survey';
export const SHOT_DEBRIEF = 'debrief';

function autopilotControls(state, aim, targetSpeed) {
  const headingError = shortestAngle(bearingTo(state, aim) - state.heading);
  const altitudeError = aim.y - state.y;
  return {
    pitch: clamp(altitudeError * 0.006 - state.verticalSpeed * 0.03, -0.4, 0.4),
    roll: clamp(headingError * 1.1 - state.roll * 0.3, -1, 1),
    yaw: 0,
    throttle: clamp((targetSpeed - state.speed) * 0.08 + (state.throttle < 0.5 ? 0.4 : 0), -1, 1),
    brake: false,
  };
}

function flyFor(world, seconds, aim, targetSpeed) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(autopilotControls(world.flight, aim, targetSpeed));
  }
}

function stageGhostNear(world, point, heading) {
  world.ghost = {
    label: 'PAR GHOST',
    totalTime: 300,
    samples: [
      { t: 0, x: point.x - Math.sin(heading) * 260, y: point.y - 6, z: point.z - Math.cos(heading) * 260, heading, pitch: 0.01, roll: 0.18, speed: 56, ring: 5 },
      { t: 400, x: point.x + Math.sin(heading) * 420, y: point.y + 4, z: point.z + Math.cos(heading) * 420, heading, pitch: 0.01, roll: 0.18, speed: 56, ring: 5 },
    ],
  };
}

function stageCover(world) {
  world.reset(MISSION_RINGS, 'normal');
  const ring = RING_COURSE[4];
  const flight = world.flight;
  const dirX = Math.sin(ring.heading);
  const dirZ = Math.cos(ring.heading);
  flight.x = ring.x - dirX * 230;
  flight.y = ring.y - 10;
  flight.z = ring.z - dirZ * 230;
  flight.heading = ring.heading;
  flight.pitch = -0.01;
  flight.roll = 0.14;
  flight.speed = 57;
  flight.onGround = false;
  flight.throttle = 0.82;
  flight.gearDown = false;
  flight.gearTransit = 1;
  flight.fuel = 58;
  world.ringsDone = 4;
  world.routeTaken = 'shortcut';
  world.score = 4800;
  world.breakdown = [
    { label: 'Ring 1: Climb Gate', points: 1000 },
    { label: 'Ring 2: Coast Turn', points: 1000 },
    { label: 'Route: Coast Shortcut (low and gusty)', points: 800 },
    { label: 'Ring 3: Harbour Sweep', points: 1000 },
    { label: 'Ring 4: City Crossing', points: 1000 },
  ];
  world.elapsed = 142;
  world.say('Ridge Pass ahead: beat the ghost through the ring');
  const perpX = Math.cos(ring.heading);
  const perpZ = -Math.sin(ring.heading);
  stageGhostNear(world, { x: ring.x - dirX * 30 - perpX * 62, y: ring.y - 16, z: ring.z - dirZ * 30 - perpZ * 62 }, ring.heading);
  flyFor(world, 0.55, ring, 57);
  return { view: 'chase', screen: 'play' };
}

function stageCockpit(world) {
  world.reset(MISSION_CROSSWIND, 'normal');
  const flight = world.flight;
  flight.x = WORLD.runway.x + 60;
  flight.y = WORLD.runway.elevation + 92;
  flight.z = WORLD.runway.z - 980;
  flight.heading = -0.09;
  flight.pitch = -0.05;
  flight.roll = -0.07;
  flight.speed = 36;
  flight.onGround = false;
  flight.throttle = 0.34;
  flight.flaps = true;
  flight.gearDown = true;
  flight.gearTransit = 0;
  flight.fuel = 47;
  world.ringsDone = 1;
  world.score = 700;
  world.breakdown = [{ label: 'Circuit gate: downwind leg', points: 700 }];
  world.elapsed = 168;
  world.say('Crosswind final: crab into wind, aim for the gold zone');
  const aim = { x: WORLD.runway.x, y: WORLD.runway.elevation + 46, z: WORLD.runway.z - 220 };
  flyFor(world, 0.7, aim, 36);
  return { view: 'cockpit', screen: 'play' };
}

function stageSurvey(world) {
  world.reset(MISSION_DEADSTICK, 'normal');
  const flight = world.flight;
  flight.x = 1080;
  flight.y = 430;
  flight.z = 1420;
  flight.heading = -2.2;
  flight.pitch = -0.02;
  flight.roll = -0.34;
  flight.speed = 44;
  flight.onGround = false;
  flight.throttle = 0;
  flight.engineOut = true;
  flight.gearDown = false;
  flight.gearTransit = 1;
  flight.fuel = 38;
  world.elapsed = 96;
  world.score = 300;
  world.breakdown = [{ label: 'Thermal climb: free height', points: 300 }];
  world.thermalAwarded = true;
  world.say('Engine out: circling the lake thermal for free height');
  const aim = { x: 1180, y: 470, z: 1560 };
  flyFor(world, 1.0, aim, 44);
  return { view: 'chase', screen: 'play' };
}

function stageDebrief(world) {
  world.reset(MISSION_RINGS, 'normal');
  const flight = world.flight;
  flight.x = WORLD.runway.x + 4;
  flight.y = WORLD.runway.elevation + 1.2;
  flight.z = WORLD.runway.z - 120;
  flight.heading = 0;
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.flaps = true;
  flight.gearDown = true;
  flight.gearTransit = 0;
  flight.onGround = true;
  flight.fuel = 41;
  flight.lastLanding = { grade: 'smooth', label: 'Greased it in the zone (210 m)', damage: 0, score: 1800, crashed: false };
  world.ringsDone = RING_COURSE.length;
  world.routeTaken = 'shortcut';
  world.elapsed = 196;
  world.breakdown = RING_COURSE.map((ring, index) => ({ label: `Ring ${index + 1}: ${ring.label}`, points: 1000 }));
  world.breakdown.splice(2, 0, { label: 'Route: Coast Shortcut (low and gusty)', points: 800 });
  world.score = 6800;
  world.addScore(750, 'Beat the par ghost home');
  world.addScore(1800, 'Landing: Greased it in the zone (210 m)');
  world.ghost = null;
  world.finishSortie(true);
  world.phase = PHASE_COMPLETE;
  world.message = '';
  world.messageUntil = 0;
  return { view: 'cockpit', screen: 'debrief' };
}

export function stageShot(name, world) {
  if (name === SHOT_COCKPIT) return stageCockpit(world);
  if (name === SHOT_SURVEY) return stageSurvey(world);
  if (name === SHOT_DEBRIEF) return stageDebrief(world);
  return stageCover(world);
}
