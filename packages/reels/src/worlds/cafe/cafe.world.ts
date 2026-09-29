import type { Shot } from '../../engine/timeline/types';
import type { WorldDef } from '../types';
import { v3 } from '../types';
import { eventProgress, type SceneShots } from '../events';

/**
 * cafe — a warm, modern café at dusk: a small marble table by a tall window,
 * pendant lights, a counter with its machine and shelves behind. The espresso
 * cup is live: `cup-turn` spins it on its saucer, slow then fast (the match
 * cut into a spinning ball); `ripple` rings the crema (an impact from
 * somewhere else); `espresso-take` lifts it into the drinker's hand.
 */
export const CAFE = {
  room: { x: [-3.6, 3.6] as [number, number], z: [-3.2, 3.6] as [number, number], h: 3.1 },
  table: { x: -2.55, z: -0.72, r: 0.38, top: 0.74 },
  cup: v3(-2.52, 0.8, -0.8),
  window: { x: -3.6, z: -0.6, y: 1.65, w: 3.0, h: 2.2 },
  counter: { z: 2.9, x: [-1.2, 3.3] as [number, number], top: 1.05 },
  pendants: [v3(-2.55, 2.35, -0.72), v3(0.2, 2.35, -0.4), v3(1.9, 2.35, 1.9)],
} as const;

/** Cup yaw (rad) at a frame: `cup-turn` accelerates from a nudge to ~2 rev/s. */
export function cupYaw(tl: SceneShots | undefined, shot: Shot, frame: number, fps: number): number {
  const e = eventProgress(tl, shot, 'cup-turn', frame);
  if (!e) return 0.4;
  const dur = (e.ev.end - e.ev.start) / fps;
  // ω(p) = 0.6 + 12.4 p² rad/s → angle = dur (0.6 p + 12.4 p³ / 3); holds speed after.
  const p = e.p;
  const tail = Math.max(0, (frame - e.ev.end) / fps);
  return 0.4 + dur * (0.6 * p + (12.4 * p * p * p) / 3) + 13 * tail;
}

export const CAFE_WORLD: WorldDef = {
  id: 'cafe',
  kind: '3d',
  summary: 'Warm modern café at dusk: marble window table, live espresso cup (cup-turn / ripple / espresso-take), counter, pendants.',
  params: { tod: 'Window: day | dusk | night (default dusk)' },
  marks: {
    seat: { x: CAFE.table.x, z: CAFE.table.z + 0.78, facing: Math.PI, posture: 'sit' },
    'barista-table': { x: CAFE.table.x + 0.9, z: CAFE.table.z + 0.1, facing: -Math.PI / 2 - 0.3, posture: 'stand' },
    'barista-away': { x: 0.6, z: 1.6, facing: 0.6, posture: 'stand' },
    counter: { x: 1.2, z: 2.2, facing: Math.PI, posture: 'stand' },
    'guest-a': { x: 1.2, z: -1.5, facing: -2.4, posture: 'sit' },
  },
  props: {
    espresso: { pos: CAFE.cup, size: 0.08, view: v3(0.25, 0.35, 1), summary: 'The espresso on its saucer' },
    window: { pos: v3(CAFE.window.x + 0.05, CAFE.window.y, CAFE.window.z), size: 1.2, view: v3(1, 0, 0) },
  },
  lights: { pendant: CAFE.pendants[0], 'window-light': v3(CAFE.window.x, 1.8, CAFE.window.z) },
  surfaces: {},
  defaultLook: 'office-casual',
  ambience: 'room-tone',
  effects: ['cup-turn', 'ripple', 'espresso-take'],
  lensIds: ['cup-top', 'cup-top-wide', 'cup-side', 'window-two', 'room'],
  lens(id) {
    // Straight down onto the cup (offset a hair toward -x so "up" is defined; matches ball-overhead).
    if (id === 'cup-top') return { pos: v3(CAFE.cup.x, CAFE.cup.y + 0.58, CAFE.cup.z), look: v3(CAFE.cup.x - 0.03, CAFE.cup.y, CAFE.cup.z), fov: 40 };
    if (id === 'cup-top-wide') return { pos: v3(CAFE.cup.x, CAFE.cup.y + 1.05, CAFE.cup.z), look: v3(CAFE.cup.x - 0.05, CAFE.cup.y, CAFE.cup.z), fov: 40 };
    // Table height, the cup large, the drinker's hand and chest soft behind.
    if (id === 'cup-side') return { pos: v3(CAFE.cup.x + 0.18, CAFE.cup.y + 0.14, CAFE.cup.z - 0.55), look: v3(CAFE.cup.x - 0.02, CAFE.cup.y + 0.08, CAFE.cup.z + 0.3), fov: 34 };
    // Across the table from outside the window line: the drinker lit by the window.
    if (id === 'window-two') return { pos: v3(-3.2, 1.45, -2.45), look: v3(-2.45, 1.12, 0.05), fov: 42 };
    if (id === 'room') return { pos: v3(2.6, 1.9, -2.6), look: v3(-1.5, 1.0, 0.8), fov: 50 };
    return undefined;
  },
};
