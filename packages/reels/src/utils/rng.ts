/**
 * Keyed deterministic RNG.
 *
 * Every random decision derives from (seed, stable semantic key) so unrelated
 * additions never shift existing outputs. Never use Math.random() in Reel code.
 *
 * Implementation: xmur3 string hash of `${seed}:${key}` -> mulberry32 stream.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic stream for one (seed, key). */
export function rng(seed: number, key: string): () => number {
  const hash = xmur3(`${seed}:${key}`)();
  return mulberry32(hash);
}

/** Single deterministic value in [0, 1) for (seed, key). */
export function random01(seed: number, key: string): number {
  return rng(seed, key)();
}

/** Deterministic value in [min, max) for (seed, key). */
export function randomRange(seed: number, key: string, min: number, max: number): number {
  return min + (max - min) * random01(seed, key);
}

/** Deterministic pick from a list for (seed, key). */
export function pickOne<T>(seed: number, key: string, list: readonly T[]): T {
  if (list.length === 0) throw new Error('pickOne: empty list');
  return list[Math.floor(random01(seed, key) * list.length) % list.length];
}

/** Deterministic shuffle (returns a new array) for (seed, key). */
export function shuffled<T>(seed: number, key: string, list: readonly T[]): T[] {
  const out = [...list];
  const rand = rng(seed, key);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
