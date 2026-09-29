/**
 * Breakroom layout — single source for the world definition and its
 * renderer. An office kitchen: counter along the back wall (z = BACK), the
 * coffee machine dead centre, the last cup on the counter edge in front of
 * it, window + blinds on the right wall, door to the hall on the left.
 */
import { v3 } from '../types';

export const BREAK = {
  room: { x: [-4.2, 4.2] as [number, number], z: [-3.4, 4.2] as [number, number], h: 2.9 },
  counterTop: 0.92,
  counterFront: -2.74,
  counterX: 2.6,
  machine: { x: 0, z: -3.12, w: 0.62, h: 0.74, d: 0.52 },
  cup: v3(0, 1.02, -2.8),
  display: { center: v3(0, 1.5, -2.855), width: 0.28, height: 0.13 },
  window: { x: 4.2, z: -1.1, y: 1.6, w: 2.2, h: 1.4 },
  door: { x: -4.2, z: 1.3, w: 1.05, h: 2.1 },
  tubes: [v3(0, 2.86, -2.2), v3(0, 2.86, 0.8), v3(-2.8, 2.86, -0.6), v3(2.8, 2.86, -0.6)],
  floorSpot: v3(0.03, 0.06, -2.52),
} as const;

/** Cup landing spot + where each side's hand meets it. */
export const CUP_SLIDE = 0.26;
