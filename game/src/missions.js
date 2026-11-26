// The three sorties and free flight. Each mission is plain data: where the
// aircraft starts, what it must do in order, and how the sortie is scored.
// The world module flies these definitions; nothing here touches physics.
import { WORLD } from './config.js';

export const MISSION_RINGS = 'ridge-rings';
export const MISSION_SURVEY = 'coastal-survey';
export const MISSION_CROSSWIND = 'crosswind-circuit';
export const MISSION_STORM = 'storm-ridge';
export const MISSION_DEADSTICK = 'deadstick-return';
export const MISSION_DUSK = 'dusk-final';
export const MISSION_FREE = 'free-flight';

export const ROUTE_GATES = [
  { id: 'shortcut', x: -980, y: 190, z: -40, heading: -2.2, label: 'Coast Shortcut', points: 800, note: 'low and gusty' },
  { id: 'highroad', x: 60, y: 470, z: 180, heading: -1.4, label: 'Ridge High Road', points: 500, note: 'climb in the thermal' },
];

export const RING_COURSE = [
  { x: -350, y: 210, z: 2350, heading: 0, label: 'Climb Gate' },
  { x: -1250, y: 260, z: 1500, heading: -1.2, label: 'Coast Turn' },
  { x: -700, y: 230, z: 250, heading: -2.6, label: 'Harbour Sweep' },
  { x: 420, y: 300, z: -520, heading: -1.9, label: 'City Crossing' },
  { x: 1450, y: 330, z: 820, heading: 0.4, label: 'Ridge Pass' },
  { x: 980, y: 240, z: 2350, heading: 2.4, label: 'Lake Return' },
];

export const SURVEY_POINTS = [
  { x: 420, z: -520, minAlt: 120, maxAlt: 420, label: 'City Centre' },
  { x: WORLD.lighthouse.x, z: WORLD.lighthouse.z, minAlt: 80, maxAlt: 380, label: 'Lighthouse Point' },
  { x: 1500, z: 820, minAlt: 220, maxAlt: 520, label: 'Mountain Pass' },
  { x: WORLD.lake.x, z: WORLD.lake.z, minAlt: 100, maxAlt: 420, label: 'Mirror Lake' },
];

export const MISSIONS = [
  {
    id: MISSION_RINGS,
    name: 'Ridge Rings',
    brief: 'Six rings, then choose your route home: gusty shortcut or thermal high road.',
    start: 'runway',
    parSeconds: 300,
    weather: { windBase: 3.2, gust: 1.6, thermal: 1, dusk: 0, label: 'Breeze' },
    ghost: true,
    routeChoice: true,
  },
  {
    id: MISSION_SURVEY,
    name: 'Coastal Survey',
    brief: 'Photograph four landmarks in their altitude bands against a freshening wind.',
    start: 'runway',
    parSeconds: 360,
    weather: { windBase: 4.6, gust: 2.4, thermal: 1.1, dusk: 0, label: 'Freshening' },
    ghost: false,
    routeChoice: false,
  },
  {
    id: MISSION_CROSSWIND,
    name: 'Crosswind Circuit',
    brief: 'One circuit, then a crosswind landing in the touchdown zone. Crab or drift.',
    start: 'runway',
    parSeconds: 220,
    weather: { windBase: 6.4, gust: 3.2, thermal: 0.8, dusk: 0, label: 'Crosswind' },
    ghost: false,
    routeChoice: false,
  },
  {
    id: MISSION_STORM,
    name: 'Storm Ridge',
    brief: 'The ring course in a gust front. Ride thermals, fight the ridge shake.',
    start: 'runway',
    parSeconds: 320,
    weather: { windBase: 7.8, gust: 5.2, thermal: 1.5, dusk: 0.25, label: 'Gust Front' },
    ghost: true,
    routeChoice: true,
  },
  {
    id: MISSION_DEADSTICK,
    name: 'Deadstick Return',
    brief: 'Engine out over the lake. Spend height wisely or circle a thermal home.',
    start: 'airborne',
    parSeconds: 240,
    weather: { windBase: 4.2, gust: 2, thermal: 1.6, dusk: 0, label: 'Thermal Day' },
    ghost: false,
    routeChoice: false,
  },
  {
    id: MISSION_DUSK,
    name: 'Dusk Final',
    brief: 'Last light, tight fuel, crosswind final. Beat the ghost and grease the zone.',
    start: 'runway',
    parSeconds: 300,
    weather: { windBase: 6, gust: 3.6, thermal: 0.9, dusk: 1, label: 'Dusk' },
    ghost: true,
    routeChoice: true,
  },
  {
    id: MISSION_FREE,
    name: 'Free Flight',
    brief: 'No clock and no orders. Explore the ridge and land where you like.',
    start: 'runway',
    parSeconds: 0,
    weather: { windBase: 3.5, gust: 1.8, thermal: 1.2, dusk: 0, label: 'Breeze' },
    ghost: false,
    routeChoice: false,
  },
];

export function missionById(id) {
  return MISSIONS.find((mission) => mission.id === id) || MISSIONS[0];
}

export function runwayStartPose() {
  return {
    x: WORLD.runway.x,
    y: WORLD.runway.elevation + 1.2,
    z: WORLD.runway.z - WORLD.runway.length / 2 + 90,
    heading: WORLD.runway.heading,
    pitch: 0,
    roll: 0,
    speed: 0,
  };
}

export function deadstickStartPose() {
  return {
    x: WORLD.lake.x + 250,
    y: 760,
    z: WORLD.lake.z + 420,
    heading: -2.35,
    pitch: -0.04,
    roll: 0,
    speed: 52,
  };
}

export function nextObjectiveLabel(missionId, progress) {
  if (missionId === MISSION_RINGS || missionId === MISSION_STORM || missionId === MISSION_DUSK) {
    if (progress.ringsDone === 2 && !progress.routeTaken) {
      return 'Route: Shortcut +800 / High Road +500';
    }
    if (progress.ringsDone < RING_COURSE.length) {
      return `Ring ${progress.ringsDone + 1} of ${RING_COURSE.length}: ${RING_COURSE[progress.ringsDone].label}`;
    }
    return 'All rings clear: land in the zone';
  }
  if (missionId === MISSION_CROSSWIND) {
    if (progress.ringsDone < 1) return 'Fly the circuit gate';
    return 'Crosswind final: aim for the zone';
  }
  if (missionId === MISSION_SURVEY) {
    if (progress.photosDone < SURVEY_POINTS.length) {
      const point = SURVEY_POINTS[progress.photosDone];
      return `Photo: ${point.label} ${Math.round(point.minAlt)}-${Math.round(point.maxAlt)} m`;
    }
    return 'Survey complete: land on the strip';
  }
  if (missionId === MISSION_DEADSTICK) return 'Engine out: glide home and land';
  return 'Free flight: explore, then land when ready';
}
