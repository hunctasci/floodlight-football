/**
 * Office layout — single source for the world definition (marks, props,
 * lights) AND the renderer (desks, monitors, chairs), so a mark can never
 * drift away from its chair.
 *
 * A face-to-face desk pod at the origin: desk-a (+z side, facing -z) and
 * desk-b (-z side, facing +z), monitors back to back between them, low enough
 * that seated heads clear them. Portrait coverage stages the two in depth
 * across the pod (over-shoulder, depth two-shot).
 */
import { v3, type Vec3 } from '../types';

export const OFFICE = {
  room: { halfX: 6.0, back: -6.2, front: 5.8, ceiling: 3.0 },
  // HNC torsos are 0.48 m wide cylinders: the seat sits well behind the desk edge.
  seatZ: 1.3,
  deskZ: 0.42,
  deskTop: 0.74,
  deskW: 1.5,
  deskD: 0.66,
  monitorZ: 0.14,
  monitorY: 0.98,
  monitorW: 0.62,
  monitorH: 0.36,
  seatTop: 0.49,
  /** Background pods (x, z) with seated extras. */
  pods: [
    [-3.4, -0.3],
    [3.4, -0.3],
    [0, -4.0],
  ] as const,
  /** Fluorescent panel grid (x, z) on the ceiling. */
  panels: [
    [-3.4, -3.6],
    [0, -3.6],
    [3.4, -3.6],
    [-3.4, 0],
    [0, 0],
    [3.4, 0],
    [-3.4, 3.4],
    [0, 3.4],
    [3.4, 3.4],
  ] as const,
} as const;

/** Desk side +1 (desk-a, +z) / -1 (desk-b, -z). */
export type DeskSide = 1 | -1;

export const DESKS: Record<'desk-a' | 'desk-b', DeskSide> = { 'desk-a': 1, 'desk-b': -1 };

/** Clue props on a desk: flag near the edge, mug opposite. */
export function deskProps(s: DeskSide): { flag: Vec3; mug: Vec3; keyboard: Vec3 } {
  return {
    flag: v3(-0.6 * s, OFFICE.deskTop + 0.2, s * 0.6),
    mug: v3(0.56 * s, OFFICE.deskTop + 0.07, s * 0.62),
    keyboard: v3(0, OFFICE.deskTop + 0.02, s * 0.6),
  };
}

/** Background pod seats: `<pod>-a` on the pod's +z side facing -z, `-b` opposite. */
export const POD_NAMES = ['pod-left', 'pod-right', 'pod-back'] as const;

export function podSeats(): Record<string, { x: number; z: number; facing: number }> {
  const out: Record<string, { x: number; z: number; facing: number }> = {};
  OFFICE.pods.forEach(([px, pz], i) => {
    out[`${POD_NAMES[i]}-a`] = { x: px, z: pz + OFFICE.seatZ, facing: Math.PI };
    out[`${POD_NAMES[i]}-b`] = { x: px, z: pz - OFFICE.seatZ, facing: 0 };
  });
  return out;
}

export const CEILING_LIGHT = v3(0, OFFICE.room.ceiling - 0.05, 0);
