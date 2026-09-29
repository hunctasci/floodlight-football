import type { Shot } from '../../engine/timeline/types';
import type { WorldDef } from '../types';
import { v3 } from '../types';
import { eventProgress, smooth01, type SceneShots } from '../events';

/**
 * rooftop — a stone terrace above an original city at first light: layered
 * blocks, hills, a strait with a suspension bridge, a tall pole flying a
 * large flag (`set.flag`, geometric construction). `dawn` (world event)
 * carries the sky from blue hour to a red sunrise.
 */
export const ROOF = {
  parapetZ: -2.2,
  pole: v3(-2.3, 0, -2.9),
  poleH: 7.2,
  flag: { w: 3.3, h: 2.2 },
} as const;

export function dawnLevel(tl: SceneShots | undefined, shot: Shot, frame: number): number {
  const base = typeof shot.set.dawn === 'number' ? (shot.set.dawn as number) : 0;
  const e = eventProgress(tl, shot, 'dawn', frame);
  return e ? base + (1 - base) * smooth01(e.p) : base;
}

export const ROOFTOP_WORLD: WorldDef = {
  id: 'rooftop',
  kind: '3d',
  summary: 'Stone terrace over an original city at dawn; a tall pole flying a large flag; the sky reddens with `dawn`.',
  params: { flag: 'Country of the flag on the pole (default TR)', dawn: 'Start of the dawn 0..1 (default 0)' },
  marks: {
    edge: { x: 0.2, z: ROOF.parapetZ + 0.75, facing: Math.PI, posture: 'stand' },
    back: { x: 0.4, z: 1.6, facing: Math.PI, posture: 'stand' },
  },
  props: {
    flag: { pos: v3(ROOF.pole.x + ROOF.flag.w / 2, ROOF.poleH - ROOF.flag.h / 2, ROOF.pole.z), size: 1.6, view: v3(0.3, -0.6, 1), summary: 'The flag on the pole' },
    horizon: { pos: v3(0, 8, -120), size: 20, view: v3(0, 0, 1) },
  },
  lights: { sun: v3(-12, 6, -150) },
  surfaces: {},
  defaultLook: 'kit',
  ambience: 'room-tone',
  effects: ['dawn'],
  lensIds: ['behind-wide', 'flag-low', 'profile', 'high-wide'],
  lens(id) {
    if (id === 'behind-wide') return { pos: v3(1.5, 2.35, 5.6), look: v3(-0.9, 3.5, -12), fov: 50 };
    if (id === 'flag-low') return { pos: v3(ROOF.pole.x + 0.9, 1.2, ROOF.pole.z + 3.4), look: v3(ROOF.pole.x + 1.6, ROOF.poleH - 1.0, ROOF.pole.z), fov: 44 };
    if (id === 'profile') return { pos: v3(1.95, 1.78, -2.05), look: v3(0.2, 1.72, -1.72), fov: 32 };
    if (id === 'high-wide') return { pos: v3(2.4, 3.6, 4.2), look: v3(-0.8, 1.2, -6), fov: 52 };
    return undefined;
  },
};
