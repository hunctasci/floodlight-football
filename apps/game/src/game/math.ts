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
