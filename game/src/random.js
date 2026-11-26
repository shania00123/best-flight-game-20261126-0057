// Deterministic random numbers and value noise. The same seed always builds
// the same coastline, clouds and city, so a staged screenshot scene is the
// exact frame a player with that seed would see.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  }
  return {
    next,
    range(low, high) {
      return low + next() * (high - low);
    },
    pick(items) {
      return items[Math.floor(next() * items.length) % items.length];
    },
  };
}

export function hash2(x, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, z, seed) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf);
  const sz = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export function fbm(x, z, seed, octaves) {
  let total = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise(x * frequency, z * frequency, seed + i * 101) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return total / norm;
}
