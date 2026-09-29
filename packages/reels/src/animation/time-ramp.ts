/**
 * Semantic time ramps (speed ramps) for football moments.
 *
 * A shot can map its own playback onto a window of a longer choreography
 * ("moment clock"): `from`..`to` seconds of moment time across the shot,
 * reshaped by a ramp. Consecutive shots that share from/to boundaries play
 * one continuous action across cuts; a ramp slows anticipation and snaps
 * back to speed on impact. Pure functions of shot-local frame — no state.
 */

export const TIME_RAMP_IDS = ['linear', 'anticipation-snap'] as const;
export type TimeRampId = (typeof TIME_RAMP_IDS)[number];

/**
 * (shot progress u, moment progress p) keys, both 0..1, strictly increasing.
 * anticipation-snap: ~1.1x approach -> ~0.42x hold on the wind-up -> ~1.15x
 * snap through contact (tuned for a 1.3s shot covering 1.0s of moment).
 */
const RAMP_KEYS: Record<TimeRampId, readonly (readonly [number, number])[]> = {
  linear: [
    [0, 0],
    [1, 1],
  ],
  'anticipation-snap': [
    [0, 0],
    [0.169, 0.242],
    [0.677, 0.519],
    [1, 1],
  ],
};

export function isTimeRampId(v: string): v is TimeRampId {
  return (TIME_RAMP_IDS as readonly string[]).includes(v);
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolation through the ramp keys:
 * smooth speed changes, never runs time backwards.
 */
export function remapProgress(id: TimeRampId, u: number): number {
  const keys = RAMP_KEYS[id];
  const x = Math.min(1, Math.max(0, u));
  const n = keys.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let k = 0;
  while (k < n - 2 && x > keys[k + 1][0]) k++;
  const [x0, y0] = keys[k];
  const [x1, y1] = keys[k + 1];
  const h = x1 - x0;
  const t = (x - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * m[k] +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * m[k + 1]
  );
}

/** Inverse ramp by bisection (monotone): shot progress that reaches p. */
export function remapInverse(id: TimeRampId, p: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (remapProgress(id, mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface MomentClockSpec {
  /** Moment time (seconds) at the first frame of the shot. */
  from: number;
  /** Moment time (seconds) at the end of the shot. */
  to: number;
  /** Natural length of the whole choreography (seconds). */
  length: number;
  ramp?: TimeRampId;
}

/**
 * Moment time for a shot-local frame. Frame `durationInFrames` (= frame 0 of
 * the next shot) lands exactly on `to`, so shots sharing a boundary are seamless.
 */
export function momentTimeAt(clock: MomentClockSpec, localFrame: number, durationInFrames: number): number {
  const u = Math.min(1, Math.max(0, localFrame / Math.max(1, durationInFrames)));
  return clock.from + (clock.to - clock.from) * remapProgress(clock.ramp ?? 'linear', u);
}

/** Shot-local frame at which the clock reaches moment time t (for effect/audio sync). */
export function frameAtMomentTime(clock: MomentClockSpec, t: number, durationInFrames: number): number {
  const p = (t - clock.from) / (clock.to - clock.from);
  return Math.round(remapInverse(clock.ramp ?? 'linear', p) * durationInFrames);
}
