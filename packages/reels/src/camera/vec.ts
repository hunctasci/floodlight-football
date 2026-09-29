/** Tiny pure vector helpers for lens math (no THREE objects per frame). */
import type { Lens, Vec3 } from '../worlds/types';

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return scale(a, 1 / l);
};
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const up = (k: number): Vec3 => ({ x: 0, y: k, z: 0 });
/** Horizontal unit vector a character with yaw `f` faces (0 → +z). */
export const forward = (f: number): Vec3 => ({ x: Math.sin(f), y: 0, z: Math.cos(f) });
/** Horizontal unit vector 90° clockwise from forward (screen-left of a subject facing the lens). */
export const side = (f: number): Vec3 => ({ x: Math.cos(f), y: 0, z: -Math.sin(f) });
export const flat = (a: Vec3): Vec3 => ({ x: a.x, y: 0, z: a.z });
export const yawOf = (d: Vec3): number => Math.atan2(d.x, d.z);

/** Rotate p around a vertical axis through c by angle (rad). */
export function orbit(p: Vec3, c: Vec3, angle: number): Vec3 {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  return { x: c.x + dx * cs + dz * sn, y: p.y, z: c.z - dx * sn + dz * cs };
}

/** Spherical blend of two directions (unit vectors). */
export function slerpDir(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const w = Math.acos(dot);
  if (w < 1e-4) return norm(mix(a, b, t));
  const s = Math.sin(w);
  return norm(add(scale(a, Math.sin((1 - t) * w) / s), scale(b, Math.sin(t * w) / s)));
}

export function mixLens(a: Lens, b: Lens, t: number): Lens {
  return { pos: mix(a.pos, b.pos, t), look: mix(a.look, b.look, t), fov: a.fov + (b.fov - a.fov) * t };
}

export const finiteLens = (l: Lens): boolean =>
  [l.pos.x, l.pos.y, l.pos.z, l.look.x, l.look.y, l.look.z, l.fov].every(Number.isFinite) && l.fov > 1 && l.fov < 170;
