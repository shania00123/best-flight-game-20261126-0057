// Staged screenshot scenes behind ?shot=cover|cockpit|survey|debrief. Each
// scene puts the aircraft on a real flight path in the real world, then
// steps the flight model forward under a simple autopilot, so every frame
// is a moment the game itself can reach and the same seed repeats it.
import { STEP, WORLD, clamp } from './config.js';
import { bearingTo, shortestAngle } from './flight.js';
import { MISSION_RINGS, MISSION_SURVEY, RING_COURSE } from './missions.js';
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

function stageCover(world) {
  world.reset(MISSION_RINGS);
  const ring = RING_COURSE[3];
  const flight = world.flight;
  flight.x = -170;
  flight.y = ring.y - 48;
  flight.z = -240;
  flight.heading = bearingTo(flight, ring) - 0.13;
  flight.pitch = 0.03;
  flight.roll = 0.22;
  flight.speed = 56;
  flight.onGround = false;
  flight.throttle = 0.8;
  flight.gearDown = false;
  flight.gearTransit = 1;
  flight.fuel = 74;
  world.ringsDone = 3;
  world.score = 3000;
  world.breakdown = RING_COURSE.slice(0, 3).map((done, index) => ({ label: `Ring ${index + 1}: ${done.label}`, points: 1000 }));
  world.elapsed = 132;
  world.say('City Crossing ahead: thread the ring');
  const aim = { x: ring.x + 90, y: ring.y - 8, z: ring.z };
  flyFor(world, 0.7, aim, 56);
  return { view: 'chase', screen: 'play' };
}

function stageCockpit(world) {
  world.reset(MISSION_RINGS);
  const flight = world.flight;
  flight.x = WORLD.runway.x;
  flight.y = WORLD.runway.elevation + 148;
  flight.z = WORLD.runway.z - 1180;
  flight.heading = 0;
  flight.pitch = -0.045;
  flight.roll = 0;
  flight.speed = 37;
  flight.onGround = false;
  flight.throttle = 0.36;
  flight.flaps = true;
  flight.gearDown = true;
  flight.gearTransit = 0;
  flight.fuel = 58;
  world.ringsDone = RING_COURSE.length;
  world.score = 6000;
  world.elapsed = 252;
  world.say('All rings clear: land on the strip');
  const aim = { x: WORLD.runway.x, y: WORLD.runway.elevation + 112, z: WORLD.runway.z - 250 };
  flyFor(world, 0.7, aim, 37);
  return { view: 'cockpit', screen: 'play' };
}

function stageSurvey(world) {
  world.reset(MISSION_SURVEY);
  const flight = world.flight;
  flight.x = 1150;
  flight.y = 318;
  flight.z = -420;
  flight.heading = -1.2;
  flight.pitch = 0.01;
  flight.roll = -0.3;
  flight.speed = 54;
  flight.onGround = false;
  flight.throttle = 0.74;
  flight.gearDown = false;
  flight.gearTransit = 1;
  flight.fuel = 66;
  world.photosDone = 1;
  world.score = 850;
  world.breakdown = [{ label: 'Photo: City Centre', points: 850 }];
  world.elapsed = 121;
  world.say('Photo captured: City Centre (+850)');
  const aim = { x: WORLD.lighthouse.x, y: 310, z: WORLD.lighthouse.z };
  flyFor(world, 1.0, aim, 54);
  return { view: 'chase', screen: 'play' };
}

function stageDebrief(world) {
  world.reset(MISSION_RINGS);
  const flight = world.flight;
  flight.x = WORLD.runway.x;
  flight.y = WORLD.runway.elevation + 1.2;
  flight.z = WORLD.runway.z + 60;
  flight.heading = 0;
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.flaps = true;
  flight.gearDown = true;
  flight.gearTransit = 0;
  flight.onGround = true;
  flight.fuel = 44;
  flight.lastLanding = { grade: 'smooth', label: 'Greased it: smooth and centred', damage: 0, score: 1200, crashed: false };
  world.ringsDone = RING_COURSE.length;
  world.elapsed = 214;
  world.breakdown = RING_COURSE.map((ring, index) => ({ label: `Ring ${index + 1}: ${ring.label}`, points: 1000 }));
  world.score = 6000;
  world.addScore(1200, 'Landing: Greased it: smooth and centred');
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
