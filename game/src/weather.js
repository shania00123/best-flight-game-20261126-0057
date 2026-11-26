// Weather the pilot must route around: a wind field that strengthens with
// altitude and near the ridge, moving gust fronts that shove the wings, and
// thermal columns that pay height to a glider patient enough to circle.
// Every sortie carries a weather profile, so the same course flies
// differently as the campaign escalates.
import { WORLD, clamp } from './config.js';

export const THERMALS = [
  { x: 240, z: 1180, radius: 260, top: 780, label: 'Farmland Thermal' },
  { x: 1180, z: 1560, radius: 300, top: 860, label: 'Lake Thermal' },
  { x: -760, z: -180, radius: 240, top: 720, label: 'Harbour Thermal' },
];

export function weatherProfileFor(mission) {
  return mission.weather || { windBase: 3, gust: 1.2, thermal: 1, dusk: 0, label: 'Calm' };
}

export function windAt(state, elapsed, profile) {
  const altitudeFactor = clamp(state.y / 620, 0.35, 1.6);
  const ridgeFactor = clamp((state.x - 700) / 1400, 0, 0.8);
  const coastFactor = clamp((-900 - state.x) / 1600, 0, 0.5);
  const frontPhase = Math.sin(elapsed * 0.11 + state.z * 0.00045);
  const base = profile.windBase * altitudeFactor * (1 + ridgeFactor + coastFactor * 0.5);
  const gustPulse = Math.max(0, Math.sin(elapsed * 0.7 + state.x * 0.0011 + state.z * 0.0007)) ** 3;
  const gust = profile.gust * gustPulse * (0.6 + frontPhase * 0.4);
  const direction = -0.72 + Math.sin(elapsed * 0.05 + state.y * 0.001) * 0.18;
  return {
    x: Math.sin(direction) * (base + gust),
    z: Math.cos(direction) * (base * 0.55 + gust * 0.4) - 1.2,
    speed: base + gust,
    gust,
    direction,
  };
}

export function gustRollAt(state, elapsed, profile) {
  if (state.onGround) return 0;
  const front = Math.sin(elapsed * 1.7 + state.x * 0.004 + state.z * 0.003);
  const ridgeShake = clamp((state.x - 900) / 1200, 0, 1) * Math.sin(elapsed * 3.1 + state.z * 0.01);
  return (front * 0.35 + ridgeShake * 0.3) * profile.gust * 0.16;
}

export function thermalLiftAt(state, profile) {
  if (state.onGround) return 0;
  let lift = 0;
  for (const thermal of THERMALS) {
    const dx = state.x - thermal.x;
    const dz = state.z - thermal.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > thermal.radius || state.y > thermal.top) continue;
    const core = 1 - dist / thermal.radius;
    const heightFade = clamp(1 - state.y / thermal.top, 0, 1);
    lift += (1.2 + core * 3.4) * heightFade * profile.thermal;
  }
  return lift;
}

export function nearestThermal(state) {
  let best = null;
  let bestDist = Infinity;
  for (const thermal of THERMALS) {
    const dx = state.x - thermal.x;
    const dz = state.z - thermal.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = thermal;
    }
  }
  return { thermal: best, distance: bestDist };
}

export function crosswindOnFinal(state, wind) {
  const runwayHeading = WORLD.runway.heading;
  const rel = wind.direction - runwayHeading;
  return Math.abs(Math.sin(rel)) * wind.speed;
}

export function weatherBrief(profile) {
  const knots = Math.round(profile.windBase * 1.94384);
  const gustKnots = Math.round((profile.windBase + profile.gust) * 1.94384);
  return `${profile.label}: wind ${knots} kt gusting ${gustKnots}, thermals ${profile.thermal >= 1.4 ? 'strong' : 'usable'}`;
}
