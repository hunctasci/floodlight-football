/**
 * Apartment layout (world + renderer share it): a living room at night. TV
 * wall at the back (z = BACK), sofa facing it, coffee table, a moving box,
 * floor lamp, a window onto the city on the right, a dark hallway on the left
 * (where a ball has no reason to come from).
 */
import { v3 } from '../types';

export const APT = {
  room: { x: [-3.2, 3.2] as [number, number], z: [-3.4, 3.4] as [number, number], h: 2.7 },
  tv: { center: v3(0.2, 1.22, -3.34), width: 1.46, height: 0.82 },
  sofa: { x: 0.35, z: 1.75, w: 2.2 },
  table: { x: 0.85, z: 0.55, w: 1.1, d: 0.6, top: 0.4 },
  box: { x: -2.15, z: 0.55 },
  lamp: v3(-1.4, 1.62, 1.55),
  window: { x: 3.2, z: -0.7, y: 1.5, w: 1.6, h: 1.5 },
  hall: { x: -3.2, z: -1.3, w: 1.0, h: 2.1 },
  ballFrom: v3(-3.9, 0.25, -1.3),
  ballTo: v3(-0.62, 0.25, -0.38),
  phone: v3(0.62, 0.41, 0.5),
  remote: v3(1.12, 0.415, 0.62),
} as const;
