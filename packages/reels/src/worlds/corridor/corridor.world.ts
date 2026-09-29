import type { Mark, WorldDef } from '../types';
import { v3 } from '../types';
import { CORRIDOR } from './layout';

/**
 * corridor — late-night office corridor that becomes a stadium tunnel as you
 * walk it (see layout.ts sections). Marks every ~2.3 m along the centre line
 * face -z (toward the pitch); `mouth` is the last step before the light.
 */
const along = (z: number, facing = Math.PI): Mark => ({ x: 0, z, facing, posture: 'stand' });

export const CORRIDOR_WORLD: WorldDef = {
  id: 'corridor',
  kind: '3d',
  summary: 'One long passage: night office corridor → service corridor → stadium tunnel → the mouth onto a blinding pitch.',
  params: { glow: 'Pitch light strength at the mouth 0..2 (default 1)' },
  marks: {
    'office-a': along(9.2),
    'office-b': along(6.9),
    'office-c': along(4.6),
    'service-a': along(0.2),
    'service-b': along(-2.1),
    'tunnel-a': along(-8.2),
    'tunnel-b': along(-10.5),
    'tunnel-c': along(-16.8),
    'tunnel-d': along(-19.1),
    'tunnel-e': along(-21.4),
    mouth: along(-23.6),
    threshold: along(-25.5),
    pitch: along(-29),
  },
  props: {
    'mouth-light': { pos: v3(0, 1.5, CORRIDOR.mouthZ - 1), size: 1.2, view: v3(0, 0, 1), summary: 'The opening onto the pitch' },
    'wall-words': { pos: v3(-CORRIDOR.halfW + 0.02, 1.7, -12.8), size: 1.4, view: v3(1, 0, 0), summary: 'YOUR COUNTRY. YOUR LEAGUE. painted on the tunnel wall' },
  },
  lights: { 'pitch-light': v3(0, 1.8, CORRIDOR.mouthZ - 2), 'office-tube': v3(0, CORRIDOR.h - 0.04, 6) },
  surfaces: {},
  defaultLook: 'office',
  ambience: 'room-tone',
  lensIds: ['wide-back', 'mouth-reverse', 'poster-tunnel'],
  lens(id) {
    if (id === 'wide-back') return { pos: v3(0.6, 1.9, 12.4), look: v3(0, 1.3, 2), fov: 44 };
    // From the pitch side looking back up the tunnel at whoever stands at the mouth.
    if (id === 'mouth-reverse') return { pos: v3(0.3, 1.3, -28.2), look: v3(0, 1.35, -21), fov: 30 };
    // Key art: far behind a figure at the mouth, a silhouette against the pitch light.
    if (id === 'poster-tunnel') return { pos: v3(0.2, 1.15, -15.8), look: v3(0, 1.55, -26), fov: 40 };
    return undefined;
  },
};
