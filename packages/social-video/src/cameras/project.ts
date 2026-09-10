import type { SocialLens } from './social-camera';

/**
 * Pure framing math for camera presets (unit-testable, no THREE objects).
 * Used by tests to prove what a lens actually shows in the 9:16 viewport:
 * ball inside the useful frame, goal inside the frame during final-third
 * attacks, and bounded FOVs.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraAxes {
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Screen-space basis for a lens (world up is +y, like the renderer). */
export function cameraAxes(lens: SocialLens): CameraAxes {
  const forward = normalize(sub(lens.look, lens.pos));
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  return { right, up, forward };
}

/**
 * Project a world point into normalized device coordinates for the lens.
 * `aspect` is viewport width / height (0.5625 for the 1080x1920 reel).
 * Points with |ndc| <= 1 are inside the frame; forward-projected points
 * (behind the camera) return ndcX/ndcY = NaN.
 */
export function projectToNdc(lens: SocialLens, point: Vec3, aspect: number): { x: number; y: number } {
  const { right, up, forward } = cameraAxes(lens);
  const d = sub(point, lens.pos);
  const dz = dot(d, forward);
  if (dz <= 1e-6) return { x: NaN, y: NaN };
  const tanV = Math.tan((lens.fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  return {
    x: dot(d, right) / (dz * tanH),
    y: dot(d, up) / (dz * tanV),
  };
}

/** True when the point sits inside the frame with a safety margin. */
export function insideFrame(ndc: { x: number; y: number }, margin = 1): boolean {
  return Number.isFinite(ndc.x) && Number.isFinite(ndc.y)
    && Math.abs(ndc.x) < margin && Math.abs(ndc.y) < margin;
}

/** Portrait reel aspect: 1080 wide / 1920 tall. */
export const REEL_ASPECT = 1080 / 1920;
