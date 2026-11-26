// The three sorties and free flight. Each mission is plain data: where the
// aircraft starts, what it must do in order, and how the sortie is scored.
// The world module flies these definitions; nothing here touches physics.
import { WORLD } from './config.js';

export const MISSION_RINGS = 'ridge-rings';
export const MISSION_SURVEY = 'coastal-survey';
export const MISSION_DEADSTICK = 'deadstick-return';
export const MISSION_FREE = 'free-flight';

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
    brief: 'Take off, thread all six rings in order, then land back on the strip.',
    start: 'runway',
    parSeconds: 300,
  },
  {
    id: MISSION_SURVEY,
    name: 'Coastal Survey',
    brief: 'Photograph four landmarks inside their altitude bands, then land.',
    start: 'runway',
    parSeconds: 360,
  },
  {
    id: MISSION_DEADSTICK,
    name: 'Deadstick Return',
    brief: 'The engine quits over the lake. Glide home and land on the strip.',
    start: 'airborne',
    parSeconds: 240,
  },
  {
    id: MISSION_FREE,
    name: 'Free Flight',
    brief: 'No clock and no orders. Explore the ridge and land where you like.',
    start: 'runway',
    parSeconds: 0,
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
  if (missionId === MISSION_RINGS) {
    if (progress.ringsDone < RING_COURSE.length) {
      return `Ring ${progress.ringsDone + 1} of ${RING_COURSE.length}: ${RING_COURSE[progress.ringsDone].label}`;
    }
    return 'All rings clear: land on the strip';
  }
  if (missionId === MISSION_SURVEY) {
    if (progress.photosDone < SURVEY_POINTS.length) {
      const point = SURVEY_POINTS[progress.photosDone];
      return `Photo: ${point.label} ${Math.round(point.minAlt)}-${Math.round(point.maxAlt)} m`;
    }
    return 'Survey complete: land on the strip';
  }
  if (missionId === MISSION_DEADSTICK) return 'Engine out: glide to the strip and land';
  return 'Free flight: explore, then land when ready';
}
