import type { TeamId, Vec } from '../types';

/**
 * Pure 2D helpers for the deterministic simulation.
 * Relocated verbatim from engine.ts — expressions and evaluation order are
 * unchanged, so hashes and RNG streams are unaffected. No THREE.js here.
 */
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const length = (x: number, z: number) => Math.hypot(x, z);
export const distance = (a: Vec, b: Vec) => length(a.x - b.x, a.z - b.z);
export const direction = (x: number, z: number): Vec => {
  const d = length(x, z);
  return d > 0.001 ? { x: x / d, z: z / d } : { x: 0, z: 0 };
};
export const other = (t: TeamId) => (1 - t) as TeamId;
/** 2D distance from point p to segment a→b (swept contact for fast balls). */
export const segDist = (a: Vec, b: Vec, p: Vec): number => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const u = len2 > 1e-9 ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / len2, 0, 1) : 0;
  return length(p.x - (a.x + u * dx), p.z - (a.z + u * dz));
};
