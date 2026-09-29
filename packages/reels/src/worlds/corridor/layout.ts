/**
 * Corridor layout — one straight passage along -z that changes what it is as
 * you walk it: office corridor → service corridor → stadium tunnel → the
 * mouth onto the pitch. Section boundaries are pillars (cut points).
 */
import { v3, type Vec3 } from '../types';

export const CORRIDOR = {
  halfW: 1.35,
  h: 2.75,
  /** z ranges (start > end, walking toward -z). */
  office: [12, 2] as const,
  service: [2, -7] as const,
  tunnel: [-7, -24] as const,
  mouthZ: -24.6,
  pitchZ: -31,
} as const;

export type Section = 'office' | 'service' | 'tunnel' | 'pitch';

export function sectionAt(z: number): Section {
  if (z > CORRIDOR.office[1]) return 'office';
  if (z > CORRIDOR.service[1]) return 'service';
  if (z > CORRIDOR.mouthZ) return 'tunnel';
  return 'pitch';
}

/** Ceiling light positions per section (the renderer lights only the nearest few). */
export const CORRIDOR_LIGHTS: { pos: Vec3; section: Section; on: boolean }[] = [
  ...[11, 8.5, 6, 3.5].map((z, i) => ({ pos: v3(0, CORRIDOR.h - 0.04, z), section: 'office' as Section, on: i !== 1 })),
  ...[0.5, -2.5, -5.5].map((z) => ({ pos: v3(0, CORRIDOR.h - 0.08, z), section: 'service' as Section, on: true })),
  ...[-8.5, -11.5, -14.5, -17.5, -20.5, -23].map((z) => ({ pos: v3(0, CORRIDOR.h - 0.1, z), section: 'tunnel' as Section, on: true })),
];

export const PILLARS = [CORRIDOR.office[1], CORRIDOR.service[1], -15.5];
