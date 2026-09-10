/** Pure deterministic math helpers. All animation derives from frame/fps. */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Progress of frame within [startFrame, startFrame+durationInFrames), clamped 0..1. */
export function progress(frame: number, startFrame: number, durationInFrames: number): number {
  if (durationInFrames <= 0) return 1;
  return clamp((frame - startFrame) / durationInFrames, 0, 1);
}

export function interpolate(
  frame: number,
  inputRange: readonly [number, number],
  outputRange: readonly [number, number],
  clampOutput = true,
): number {
  const [a, b] = inputRange;
  const [c, d] = outputRange;
  const t = b === a ? 1 : (frame - a) / (b - a);
  const v = c + (d - c) * t;
  if (!clampOutput) return v;
  return c <= d ? clamp(v, c, d) : clamp(v, d, c);
}

/** Piecewise linear keyframe interpolation over absolute frames. */
export function keyframes(frame: number, keys: readonly (readonly [number, number])[]): number {
  if (keys.length === 0) throw new Error('keyframes: empty keys');
  if (keys.length === 1) return keys[0][1];
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (frame <= keys[i][0]) {
      const [f0, v0] = keys[i - 1];
      const [f1, v1] = keys[i];
      const t = f1 === f0 ? 1 : (frame - f0) / (f1 - f0);
      return v0 + (v1 - v0) * t;
    }
  }
  return keys[keys.length - 1][1];
}
