// Kestrel Ridge: shared constants for the flight model, the world and the screens.
// Every module reads its numbers from here so the aircraft, the terrain and the
// HUD can never disagree about what a knot, a metre or a warning means.

export const STEP = 1 / 60;
export const BEST_KEY = 'kestrel-ridge-best-v1';

export const WORLD = {
  seaLevel: 0,
  runway: { x: -350, z: 1400, heading: 0, length: 980, width: 46, elevation: 14 },
  city: { x: 420, z: -520, radius: 620 },
  lake: { x: 980, z: 2350, radius: 380 },
  lighthouse: { x: -1520, z: 620 },
};

export const AIRCRAFT = {
  maxSpeed: 96,
  stallSpeedClean: 27,
  stallSpeedFlaps: 21,
  rotateSpeed: 30,
  maxPitch: 0.62,
  maxRoll: 1.18,
  pitchRate: 1.05,
  rollRate: 2.3,
  thrustAccel: 15.5,
  dragBase: 0.0038,
  fuelCapacity: 100,
  gearTransitSeconds: 1.6,
};

export const CAMERA = {
  chaseBack: 17,
  chaseUp: 5.2,
  chaseLookAhead: 46,
  cockpitUp: 1.35,
  fieldOfView: 1.08,
  nearPlane: 1.6,
  farPlane: 9000,
};

export const TERRAIN = {
  gridStep: 110,
  gridExtent: 3300,
  mountainBaseX: 1500,
  passZ: 820,
};

export const SCORE = {
  ring: 1000,
  waypoint: 850,
  smoothLanding: 1200,
  firmLanding: 650,
  roughLanding: 250,
  fuelPerUnit: 6,
  secondSaved: 4,
};

export function knotsFromMetresPerSecond(speed) {
  return speed * 1.94384;
}

export function feetFromMetres(metres) {
  return metres * 3.28084;
}

export function headingDegrees(heading) {
  const deg = (heading * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
