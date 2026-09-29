import type { WorldDef } from '../types';
import { v3 } from '../types';
import { SCREEN_CONTENT_IDS } from '../screens';
import { STUDIO } from './layout';

/**
 * studio — HNC sports-news set: anchor desk, two anchor chairs, a wall screen
 * (`studio-screen`) that shows HNC content (World Table, breaking slate, live
 * match bug) with true occlusion, and gold/blue LED pillars.
 */
export const STUDIO_WORLD: WorldDef = {
  id: 'studio',
  kind: '3d',
  summary: 'Sports-news studio: anchor desk, two anchor seats, wall screen with HNC content.',
  params: {
    screen: `Wall screen content (${SCREEN_CONTENT_IDS.join(', ')}; default "hnc-news")`,
    home: 'Country shown on country-aware screens (default: first cast member)',
    away: 'Rival country for country-aware screens',
  },
  marks: {
    'anchor-left': { x: -STUDIO.anchorX, z: STUDIO.anchorZ, facing: 0, posture: 'sit' },
    'anchor-right': { x: STUDIO.anchorX, z: STUDIO.anchorZ, facing: 0, posture: 'sit' },
    'exit-right': { x: 3.6, z: -0.9, facing: Math.PI / 2, posture: 'stand' },
    'exit-left': { x: -3.6, z: -0.9, facing: -Math.PI / 2, posture: 'stand' },
    presenter: { x: -1.9, z: 0.5, facing: 0.35, posture: 'stand' },
  },
  props: {
    'mug-left': { pos: v3(-0.34, STUDIO.deskTop + 0.08, STUDIO.deskZ - 0.08), size: 0.11 },
    'mug-right': { pos: v3(0.36, STUDIO.deskTop + 0.08, STUDIO.deskZ - 0.08), size: 0.11 },
    'desk-logo': { pos: v3(0, 0.46, STUDIO.deskZ + STUDIO.deskD / 2 + 0.02), size: 0.45 },
  },
  lights: { 'key-light': v3(0, 3.6, 2.2), 'rig-left': v3(-2.2, 3.7, 0.5), 'rig-right': v3(2.2, 3.7, 0.5) },
  surfaces: {
    'studio-screen': { ...STUDIO.screen, yaw: 0, content: 'hnc-news' },
  },
  defaultLook: 'suit',
  ambience: 'studio-tone',
  lensIds: ['wide', 'desk', 'screen', 'jib'],
  lens(id) {
    if (id === 'wide') return { pos: v3(0.3, 1.85, 4.5), look: v3(0, 1.55, -0.9), fov: 44 };
    if (id === 'desk') return { pos: v3(0, 1.38, 3.3), look: v3(0, 1.3, -0.5), fov: 42 };
    if (id === 'screen') return { pos: v3(0, 2.28, 1.35), look: v3(0, 2.28, STUDIO.screen.center.z), fov: 50 };
    if (id === 'jib') return { pos: v3(-3.1, 3.5, 3.9), look: v3(0, 1.15, -0.7), fov: 44 };
    return undefined;
  },
  validateSet(set) {
    return set.screen !== undefined && !SCREEN_CONTENT_IDS.includes(String(set.screen)) ? [`unknown screen content "${String(set.screen)}"`] : [];
  },
};
