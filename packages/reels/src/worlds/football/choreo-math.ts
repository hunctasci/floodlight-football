/** Shared deterministic helpers for football choreographies (pure). */
export type V2 = { x: number; z: number };
export type V3 = { x: number; y: number; z: number };

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t: number): number => Math.pow(clamp01(t), 3);
export const mix2 = (a: V2, b: V2, t: number): V2 => ({ x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) });
export const faceTo = (from: V2, to: V2): number => Math.atan2(to.x - from.x, to.z - from.z);
export const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Distance fraction of an accelerate / cruise / decelerate walk or run (continuous speed). */
export function travel(u: number, accel = 0.25, decel = 0.25): number {
  const x = clamp01(u);
  const total = 1 - accel / 2 - decel / 2;
  let f: number;
  if (x < accel) f = (x * x) / (2 * accel);
  else if (x < 1 - decel) f = accel / 2 + (x - accel);
  else {
    const w = 1 - x;
    f = total - (w * w) / (2 * decel);
  }
  return f / total;
}

const H = 1 / 120;

export function speedOf(path: (t: number) => V2, t: number): number {
  const a = path(t - H);
  const b = path(t + H);
  return Math.hypot(b.x - a.x, b.z - a.z) / (2 * H);
}

/**
 * Game-pose clock with an integrated cadence (the game's run swing is
 * sin(clock*(8+1.5*speed))); `cadence` < 1 slows the stride for walking.
 */
export function gait(path: (t: number) => V2, t0: number, t: number, cadence = 1): number {
  const speed = speedOf(path, t);
  let phase = 0;
  const steps = Math.max(1, Math.ceil((t - t0) * 60));
  const dt = (t - t0) / steps;
  for (let i = 0; i < steps; i++) phase += (8 + 1.5 * speedOf(path, t0 + (i + 0.5) * dt)) * cadence * dt;
  return phase / (8 + 1.5 * speed);
}

/** Seeded-free blink: eyes shut for 0.11s at each listed time. */
export function blink(t: number, times: readonly number[]): number {
  for (const b of times) {
    const d = t - b;
    if (d >= 0 && d < 0.11) return 0.12 + 0.88 * Math.abs(d / 0.055 - 1);
  }
  return 1;
}
