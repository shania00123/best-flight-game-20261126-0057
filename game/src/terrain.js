// The Kestrel Ridge landscape: a curved west coast, farmland plains, a city
// plateau, a lake and a mountain wall with one flyable pass. Height and land
// type are pure functions of position, so physics, rendering and the minimap
// all read the same ground.
import { TERRAIN, WORLD, clamp, smoothstep } from './config.js';
import { fbm, hash2 } from './random.js';

export const LAND = {
  WATER: 0,
  SAND: 1,
  GRASS: 2,
  FIELD: 3,
  FOREST: 4,
  ROCK: 5,
  SNOW: 6,
  CITY: 7,
  RUNWAY: 8,
};

export function coastXAt(z) {
  return -1420 + 520 * Math.sin(z * 0.00034) + 260 * Math.sin(z * 0.00105 + 1.7);
}

export function ridgeXAt(z) {
  return TERRAIN.mountainBaseX + 420 * Math.sin(z * 0.0004 + 0.6) + 150 * Math.sin(z * 0.0013);
}

function mountainHeight(x, z) {
  const ridge = ridgeXAt(z);
  const rise = smoothstep(ridge - 700, ridge + 500, x);
  if (rise <= 0) return 0;
  const passDip = 1 - 0.72 * Math.exp(-((z - TERRAIN.passZ) ** 2) / (2 * 260 * 260));
  const peaks = 300 + 240 * fbm(x * 0.0011, z * 0.0011, 77, 3) + 90 * Math.sin(z * 0.0021 + x * 0.0007);
  return rise * peaks * passDip;
}

function lakeDepth(x, z) {
  const dx = x - WORLD.lake.x;
  const dz = z - WORLD.lake.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return smoothstep(WORLD.lake.radius, WORLD.lake.radius * 0.45, dist);
}

export function runwayLocal(x, z) {
  const dx = x - WORLD.runway.x;
  const dz = z - WORLD.runway.z;
  const sin = Math.sin(WORLD.runway.heading);
  const cos = Math.cos(WORLD.runway.heading);
  return { along: dx * sin + dz * cos, across: dx * cos - dz * sin };
}

export function onRunway(x, z, margin) {
  const local = runwayLocal(x, z);
  return (
    Math.abs(local.along) <= WORLD.runway.length / 2 + margin &&
    Math.abs(local.across) <= WORLD.runway.width / 2 + margin
  );
}

export function terrainHeightAt(x, z) {
  const coast = coastXAt(z);
  if (x < coast - 60) {
    return -6 - Math.min(30, (coast - x) * 0.012);
  }
  let height = 10 + 26 * fbm(x * 0.0016, z * 0.0016, 31, 3);
  height += smoothstep(coast - 60, coast + 420, x) * 8;
  height += mountainHeight(x, z);
  const lake = lakeDepth(x, z);
  if (lake > 0) height = height * (1 - lake) + -4 * lake;
  const cityDx = x - WORLD.city.x;
  const cityDz = z - WORLD.city.z;
  const cityDist = Math.sqrt(cityDx * cityDx + cityDz * cityDz);
  const cityBlend = smoothstep(WORLD.city.radius, WORLD.city.radius * 0.55, cityDist);
  if (cityBlend > 0) height = height * (1 - cityBlend) + 17 * cityBlend;
  if (onRunway(x, z, 130)) {
    const local = runwayLocal(x, z);
    const edge = Math.max(
      Math.abs(local.along) / (WORLD.runway.length / 2 + 130),
      Math.abs(local.across) / (WORLD.runway.width / 2 + 130),
    );
    const blend = smoothstep(1, 0.55, edge);
    height = height * (1 - blend) + WORLD.runway.elevation * blend;
  }
  return height;
}

export function landTypeAt(x, z, height) {
  if (onRunway(x, z, 2)) return LAND.RUNWAY;
  if (height <= 0.4) return LAND.WATER;
  const cityDx = x - WORLD.city.x;
  const cityDz = z - WORLD.city.z;
  if (cityDx * cityDx + cityDz * cityDz < WORLD.city.radius * WORLD.city.radius * 0.72) return LAND.CITY;
  if (height < 4.5) return LAND.SAND;
  if (height > 330) return LAND.SNOW;
  if (height > 170) return LAND.ROCK;
  const field = hash2(Math.floor(x / 420), Math.floor(z / 420), 9);
  if (field > 0.72) return LAND.FIELD;
  if (fbm(x * 0.004, z * 0.004, 55, 2) > 0.62) return LAND.FOREST;
  return LAND.GRASS;
}

export function buildCityBlocks(seed) {
  const blocks = [];
  const step = 95;
  for (let gx = -5; gx <= 5; gx += 1) {
    for (let gz = -5; gz <= 5; gz += 1) {
      const x = WORLD.city.x + gx * step + (hash2(gx, gz, seed) - 0.5) * 26;
      const z = WORLD.city.z + gz * step + (hash2(gz, gx, seed + 4) - 0.5) * 26;
      const dx = x - WORLD.city.x;
      const dz = z - WORLD.city.z;
      if (dx * dx + dz * dz > WORLD.city.radius * WORLD.city.radius * 0.6) continue;
      if (hash2(gx * 3, gz * 3, seed + 8) < 0.22) continue;
      const centre = 1 - Math.min(1, Math.sqrt(dx * dx + dz * dz) / WORLD.city.radius);
      const height = 16 + centre * 58 * hash2(gx, gz, seed + 12) + 10 * hash2(gz, gx, seed + 16);
      blocks.push({ x, z, width: 30 + hash2(gx, gz, seed + 20) * 22, depth: 30 + hash2(gz, gx, seed + 24) * 22, height });
    }
  }
  return blocks;
}

export function buildClouds(random, count) {
  const clouds = [];
  for (let i = 0; i < count; i += 1) {
    clouds.push({
      x: random.range(-5200, 5200),
      y: random.range(720, 1080),
      z: random.range(-5200, 5200),
      radius: random.range(140, 320),
      puffs: 3 + Math.floor(random.next() * 3),
      seed: Math.floor(random.next() * 100000),
    });
  }
  return clouds;
}

export function groundClearanceAt(x, y, z) {
  return y - terrainHeightAt(x, z);
}

export function slopeFactorAt(x, z) {
  const step = 30;
  const east = terrainHeightAt(x + step, z) - terrainHeightAt(x - step, z);
  const north = terrainHeightAt(x, z + step) - terrainHeightAt(x, z - step);
  return clamp(Math.sqrt(east * east + north * north) / (2 * step), 0, 1.4);
}
