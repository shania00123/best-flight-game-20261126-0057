// The flight model: throttle, pitch, bank, rudder, flaps, gear, stall, fuel
// and landing judgement. One fixed step moves the aircraft and reports what
// happened, so the game loop and the screenshot autopilot fly identical rules.
import { AIRCRAFT, clamp } from './config.js';
import { onRunway, runwayLocal, slopeFactorAt, terrainHeightAt } from './terrain.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_PHOTO = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_STALL = 16;
export const EVENT_ENGINE_OUT = 32;

export function createFlightState(pose) {
  return {
    x: pose.x,
    y: pose.y,
    z: pose.z,
    heading: pose.heading,
    pitch: pose.pitch,
    roll: pose.roll,
    speed: pose.speed,
    verticalSpeed: 0,
    throttle: pose.speed > 0 ? 0.62 : 0,
    fuel: AIRCRAFT.fuelCapacity,
    damage: 0,
    flaps: false,
    gearDown: true,
    gearTransit: 0,
    onGround: pose.speed === 0,
    stalled: false,
    engineOut: false,
    braking: false,
    wind: { x: 2.4, z: -1.1 },
    lastLanding: null,
  };
}

export function forwardVector(state) {
  const cosP = Math.cos(state.pitch);
  return {
    x: Math.sin(state.heading) * cosP,
    y: Math.sin(state.pitch),
    z: Math.cos(state.heading) * cosP,
  };
}

export function stallSpeedFor(state) {
  return state.flaps ? AIRCRAFT.stallSpeedFlaps : AIRCRAFT.stallSpeedClean;
}

export function stepFlight(state, controls, dt) {
  let events = EVENT_NONE;
  const gearTarget = state.gearDown ? 0 : 1;
  if (state.gearTransit !== gearTarget) {
    const dir = gearTarget > state.gearTransit ? 1 : -1;
    state.gearTransit = clamp(state.gearTransit + dir * (dt / AIRCRAFT.gearTransitSeconds), 0, 1);
  }
  if (!state.engineOut && state.fuel > 0) {
    state.throttle = clamp(state.throttle + controls.throttle * dt * 0.55, 0, 1);
  } else {
    state.throttle = 0;
  }
  state.braking = controls.brake === true;
  state.wind.x = 2.2 + Math.sin(state.z * 0.0004) * 1.3;
  state.wind.z = -1.0 + Math.cos(state.x * 0.0005) * 0.8;

  if (state.onGround) {
    stepGroundRoll(state, controls, dt);
    burnFuel(state, dt);
    return events;
  }

  state.pitch = clamp(state.pitch + controls.pitch * AIRCRAFT.pitchRate * dt, -AIRCRAFT.maxPitch, AIRCRAFT.maxPitch);
  if (controls.roll !== 0) {
    state.roll = clamp(state.roll + controls.roll * AIRCRAFT.rollRate * dt, -AIRCRAFT.maxRoll, AIRCRAFT.maxRoll);
  } else {
    state.roll += (0 - state.roll) * Math.min(1, dt * 0.35);
  }
  const stallSpeed = stallSpeedFor(state);
  const wasStalled = state.stalled;
  state.stalled = state.speed < stallSpeed;
  if (state.stalled) {
    state.pitch += (-0.38 - state.pitch) * Math.min(1, dt * 2.2);
    if (!wasStalled) events |= EVENT_STALL;
  }
  const turnRate = (9.81 * Math.tan(state.roll)) / Math.max(state.speed, 24);
  state.heading += (turnRate + controls.yaw * 0.22) * dt;

  const gearDrag = state.gearTransit < 0.5 ? 0.0011 : 0;
  const flapDrag = state.flaps ? 0.0016 : 0;
  const drag = (AIRCRAFT.dragBase + gearDrag + flapDrag) * state.speed * state.speed;
  const thrust = state.engineOut || state.fuel <= 0 ? 0 : state.throttle * AIRCRAFT.thrustAccel;
  const gravity = -9.81 * Math.sin(state.pitch) * 0.82;
  state.speed = clamp(state.speed + (thrust - drag + gravity) * dt, 0, AIRCRAFT.maxSpeed);

  const forward = forwardVector(state);
  let vy = forward.y * state.speed;
  if (state.stalled) vy -= (stallSpeed - state.speed) * 0.42;
  if (state.flaps && !state.stalled) vy += 0.7;
  state.verticalSpeed = vy;
  state.x += (forward.x * state.speed + state.wind.x) * dt;
  state.z += (forward.z * state.speed + state.wind.z) * dt;
  state.y += vy * dt;

  const ground = terrainHeightAt(state.x, state.z);
  if (state.y <= ground + 1.2) {
    state.y = ground + 1.2;
    events |= settleOnGround(state);
  }
  burnFuel(state, dt);
  return events;
}

function stepGroundRoll(state, controls, dt) {
  state.pitch = 0;
  state.roll = 0;
  state.verticalSpeed = 0;
  const thrust = state.engineOut || state.fuel <= 0 ? 0 : state.throttle * 11;
  const rolling = state.braking ? 7.5 : 0.7;
  state.speed = clamp(state.speed + (thrust - rolling - state.speed * 0.012) * dt, 0, AIRCRAFT.maxSpeed);
  if (state.speed > 3) {
    state.heading += controls.yaw * 0.3 * dt * Math.min(1, state.speed / 18);
  }
  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;
  state.y = terrainHeightAt(state.x, state.z) + 1.2;
  if (controls.pitch > 0.25 && state.speed >= AIRCRAFT.rotateSpeed) {
    state.onGround = false;
    state.pitch = 0.16;
    state.y += 1.5;
  }
}

function burnFuel(state, dt) {
  if (state.engineOut) return;
  const burn = (0.22 + state.throttle * 0.85) * dt * 0.62;
  state.fuel = clamp(state.fuel - burn, 0, AIRCRAFT.fuelCapacity);
}

export function gradeLanding(state) {
  const descent = -state.verticalSpeed;
  const local = runwayLocal(state.x, state.z);
  const runwayDiff = Math.abs(shortestAngle(state.heading));
  const aligned = runwayDiff < 0.32 || Math.abs(shortestAngle(state.heading - Math.PI)) < 0.32;
  const centred = Math.abs(local.across) < 20;
  const onStrip = onRunway(state.x, state.z, 4);
  const slope = slopeFactorAt(state.x, state.z);
  if (!state.gearDown || state.gearTransit > 0.4) {
    return { grade: 'belly', label: 'Belly landing: gear was up', damage: 46, score: 120, crashed: descent > 5.5 };
  }
  if (descent > 7.5 || slope > 0.85) {
    return { grade: 'crash', label: `Hard impact at ${descent.toFixed(1)} m/s descent`, damage: 100, score: 0, crashed: true };
  }
  if (!onStrip) {
    if (descent > 4.2 || state.speed > 52) {
      return { grade: 'crash', label: 'Off-strip arrival too fast to survive', damage: 100, score: 0, crashed: true };
    }
    return { grade: 'field', label: 'Field landing away from the strip', damage: 28, score: 180, crashed: false };
  }
  if (descent <= 1.6 && aligned && centred) {
    return { grade: 'smooth', label: 'Greased it: smooth and centred', damage: 0, score: 1200, crashed: false };
  }
  if (descent <= 3.4 && aligned) {
    return { grade: 'firm', label: 'Firm arrival, safely down', damage: 6, score: 650, crashed: false };
  }
  return { grade: 'rough', label: 'Rough arrival: check the gear legs', damage: 18, score: 250, crashed: false };
}

function settleOnGround(state) {
  const verdict = gradeLanding(state);
  state.lastLanding = verdict;
  state.damage = clamp(state.damage + verdict.damage, 0, 100);
  state.onGround = true;
  state.pitch = 0;
  state.roll = 0;
  if (verdict.crashed || state.damage >= 100) {
    state.speed = 0;
    return EVENT_CRASHED;
  }
  return EVENT_LANDED;
}

export function shortestAngle(angle) {
  let wrapped = angle % (Math.PI * 2);
  if (wrapped > Math.PI) wrapped -= Math.PI * 2;
  if (wrapped < -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

export function distanceTo(state, target) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const dy = (target.y ?? state.y) - state.y;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function bearingTo(state, target) {
  return Math.atan2(target.x - state.x, target.z - state.z);
}
