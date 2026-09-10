import { lerp, smoothstep } from './math';

/**
 * Minimal reusable choreography primitives for scripted action scenes.
 * Everything evaluates directly from time — never incremental mutation —
 * so any frame renders without prior frames. Deliberately small: just
 * enough machinery for attack/save/miss/dribble/counter scenes.
 */

export interface Vec2 { x: number; z: number }
export interface Vec3 { x: number; y: number; z: number }

/** One staged waypoint: where the actor is at `time` seconds. */
export interface ActorKeyframe {
  time: number;
  x: number;
  z: number;
}

/**
 * Evaluate an actor track at `time`: smoothstep interpolation between the
 * surrounding keyframes, clamped to the first/last key outside the range.
 * Eases to a full stop at every key — use for moves that SHOULD settle
 * (keeper dive landing, shooter plant, celebration holds). For transit runs
 * that pass through waypoints, prefer `evaluateTrackCR`.
 * Keys must be sorted by ascending time.
 */
export function evaluateTrack(keys: readonly ActorKeyframe[], time: number): Vec2 {
  if (keys.length === 0) return { x: 0, z: 0 };
  if (time <= keys[0].time) return { x: keys[0].x, z: keys[0].z };
  const last = keys[keys.length - 1];
  if (time >= last.time) return { x: last.x, z: last.z };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      const e = span > 0 ? smoothstep((time - a.time) / span) : 1;
      return { x: lerp(a.x, b.x, e), z: lerp(a.z, b.z, e) };
    }
  }
  return { x: last.x, z: last.z };
}

/**
 * Evaluate an actor track at `time`: Catmull-Rom interpolation through the
 * surrounding keyframes, clamped to the first/last key outside the range.
 * Unlike the eased `evaluateTrack`, velocity stays continuous through
 * interior waypoints (no stop-and-go at every key) — use this for transit
 * runs (winger carry, midfield jog, defender tracking). Endpoints duplicate
 * their neighbour, so holds before/after the move stay perfectly still.
 * Keys must be sorted by ascending time.
 */
export function evaluateTrackCR(keys: readonly ActorKeyframe[], time: number): Vec2 {
  if (keys.length === 0) return { x: 0, z: 0 };
  if (time <= keys[0].time) return { x: keys[0].x, z: keys[0].z };
  const last = keys[keys.length - 1];
  if (time >= last.time) return { x: last.x, z: last.z };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (time >= a.time && time <= b.time) {
      const p0 = keys[Math.max(0, i - 1)], p3 = keys[Math.min(keys.length - 1, i + 2)];
      const span = b.time - a.time;
      const u = span > 0 ? (time - a.time) / span : 1;
      const cr = (v0: number, v1: number, v2: number, v3: number): number => {
        const u2 = u * u, u3 = u2 * u;
        return 0.5 * (2 * v1 + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 + (-v0 + 3 * v1 - 3 * v2 + v3) * u3);
      };
      return { x: cr(p0.x, a.x, b.x, p3.x), z: cr(p0.z, a.z, b.z, p3.z) };
    }
  }
  return { x: last.x, z: last.z };
}

/** Normalized facing from `a` toward `b` (players orienting to ball/goal/foe). */
export function facingBetween(a: Vec2, b: Vec2): { facingX: number; facingZ: number } {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return { facingX: dx / len, facingZ: dz / len };
}

/**
 * Ground pass: straight-line interpolation with a small hop arc so the ball
 * reads as kicked, not sliding. `p` is 0..1 progress along the pass.
 */
export function groundPass(from: Vec3, to: Vec3, p: number, lift = 0.35): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(from.x, to.x, c),
    y: lerp(from.y, to.y, c) + Math.sin(c * Math.PI) * lift,
    z: lerp(from.z, to.z, c),
  };
}

/**
 * Lofted ball (crosses, clearances): higher symmetric arc between two spots.
 */
export function loftedPass(from: Vec3, to: Vec3, p: number, apex = 2.2): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(from.x, to.x, c),
    y: lerp(from.y, to.y, c) + Math.sin(c * Math.PI) * apex,
    z: lerp(from.z, to.z, c),
  };
}

/**
 * Velocity-gated trail strength: only the fastest ~5–10% of ball motion gets
 * the full trail (suggests motion, never a laser). Scenes sample ball speed
 * by finite difference of their pure ball function and map it through this.
 * `ref` is the scene's reference top speed (m/s) for normalization.
 */
export function velocityTrailGate(speed: number, ref = 28): number {
  const p = Math.min(1, Math.max(0, speed / ref));
  if (p > 0.9) return 1;
  if (p > 0.7) return 0.75;
  if (p > 0.45) return 0.45;
  return 0.2;
}

/** Finite-difference ball speed (m/s) for a pure ball-at-time function. */
export function ballSpeedAt(ballAt: (t: number) => Vec3, t: number, dt = 1 / 60): number {
  const a = ballAt(Math.max(0, t - dt));
  const b = ballAt(t + dt);
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return d / (2 * dt);
}

/**
 * Driven shot: constant horizontal pace (fast, direct) with a slight rise
 * and dip over the flight. `to` carries the target height (e.g. corner
 * placement); apex adds the rising shape on top.
 */
export function shotArc(from: Vec3, to: Vec3, p: number, apex = 1.0): Vec3 {
  const c = Math.min(1, Math.max(0, p));
  return {
    x: lerp(from.x, to.x, c),
    y: lerp(from.y, to.y, c) + Math.sin(c * Math.PI) * apex,
    z: lerp(from.z, to.z, c),
  };
}
