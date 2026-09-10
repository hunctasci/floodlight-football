/** Deterministic mix helpers: normalized volumes, ducking, no clipping. */

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/** Music duck under a foreground impact: dips by depthDb across [start,end). */
export function duckVolume(base: number, time: number, start: number, end: number, depthDb: number): number {
  if (time < start || time >= end) return base;
  return base * dbToGain(-depthDb);
}

/** Clamp a mix bus so overlapping cues never clip. */
export function normalizeMix(volumes: number[]): number[] {
  const sum = volumes.reduce((a, b) => a + b, 0);
  if (sum <= 1) return volumes;
  return volumes.map((v) => v / sum);
}

export const MIX_DEFAULTS = {
  crowd: 0.8,
  ambience: 0.35,
  foreground: 0.9,
  music: 0.25,
} as const;
