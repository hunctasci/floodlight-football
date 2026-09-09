/**
 * Tiny pure timeline primitives. Direct evaluation from time only — never
 * incremental mutation — so any frame is renderable without prior frames.
 */

/** Clamp to the 0..1 range. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Linear interpolation between a and b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing (0→0, 1→1, zero slope at both ends). */
export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** Alias kept for readability at call sites describing eased motion. */
export const easeInOut = smoothstep;

/**
 * Eased progress of `time` within the [start, end] segment (seconds).
 * 0 before the segment, 1 after it, smoothstepped inside.
 */
export function segmentProgress(time: number, start: number, end: number): number {
  if (!(end > start)) return time >= end ? 1 : 0;
  return smoothstep((time - start) / (end - start));
}
