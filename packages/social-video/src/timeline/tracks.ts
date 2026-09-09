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
