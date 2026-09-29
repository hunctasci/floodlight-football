import type { WorldDef } from '../types';
import { v3 } from '../types';
import { BREAK } from './layout';
import { cupState } from './state';

/**
 * breakroom — the office kitchen. One coffee machine, one last cup, two
 * people who both want it. The cup is a live prop (`cup-slide`, `cup-tip`,
 * `cup-take`); the machine display is a screen (`machine-display`: ready,
 * rematch, round-2, out-of-cups, broken); blinds close (`blinds-close`);
 * fluorescent tubes flicker like the office (`lights-flicker`, `lights-surge`)
 * and, with `set.flickerLook`, each dark flicker frame shows the cast in that
 * look (the office workers' football selves).
 */
const inward = 0.62;

export const BREAKROOM_WORLD: WorldDef = {
  id: 'breakroom',
  kind: '3d',
  summary: 'Office kitchen: coffee machine with a display, the last cup (live prop), blinds, a door to the hall, flickering tubes.',
  params: {
    display: 'Machine display content (machine-ready | machine-rematch | machine-round-2 | machine-out | machine-broken; default machine-ready)',
    cup: 'Is the last cup on the counter (default true)',
    cleared: 'Fragile things moved off the counter (mugs, plant, jar) (default false)',
    blinds: 'Blinds 0 open .. 1 closed at scene start (default 0)',
    broken: 'The machine has a football in it (default false)',
    flickerLook: 'Look the cast flashes into on dark flicker frames (e.g. "kit")',
    sign: 'Notice-board lines, e.g. ["PLEASE WASH", "YOUR MUG"]',
    tod: 'Window view: day | dusk | night (default day)',
  },
  marks: {
    // Side-on across the cup (a standoff): the counter-side arm reaches it.
    'cup-left': { x: -0.6, z: -2.3, facing: Math.PI / 2, posture: 'stand' },
    'cup-right': { x: 0.6, z: -2.3, facing: -Math.PI / 2, posture: 'stand' },
    'counter-left': { x: -0.64, z: -2.2, facing: Math.PI - inward, posture: 'stand' },
    'counter-right': { x: 0.64, z: -2.2, facing: Math.PI + inward, posture: 'stand' },
    'face-left': { x: -0.64, z: -2.1, facing: Math.PI / 2, posture: 'stand' },
    'face-right': { x: 0.64, z: -2.1, facing: -Math.PI / 2, posture: 'stand' },
    'enter-left': { x: -3.1, z: -1.0, facing: Math.PI / 2, posture: 'stand' },
    'enter-right': { x: 3.1, z: -1.0, facing: -Math.PI / 2, posture: 'stand' },
    'walk-left': { x: -1.55, z: -2.0, facing: Math.PI / 2, posture: 'stand' },
    'walk-right': { x: 1.55, z: -2.0, facing: -Math.PI / 2, posture: 'stand' },
    'table-a': { x: -2.4, z: 0.2, facing: 2.5, posture: 'stand' },
    'table-b': { x: -1.5, z: 0.9, facing: 2.9, posture: 'stand' },
    fridge: { x: -3.2, z: -2.0, facing: Math.PI, posture: 'stand' },
    window: { x: 3.55, z: -1.1, facing: Math.PI / 2, posture: 'stand' },
    drawer: { x: -1.75, z: -2.2, facing: Math.PI, posture: 'stand' },
    'back-right': { x: 2.2, z: 0.9, facing: -2.6, posture: 'stand' },
    door: { x: -3.75, z: 1.3, facing: -Math.PI / 2, posture: 'stand' },
    hall: { x: -5.6, z: 1.3, facing: -Math.PI / 2, posture: 'stand' },
    peek: { x: -4.35, z: 1.25, facing: Math.PI / 2, posture: 'stand' },
    'exit-front': { x: 1.2, z: 4.6, facing: 0, posture: 'stand' },
  },
  props: {
    cup: { pos: BREAK.cup, size: 0.14, view: v3(0, 0.1, 1), summary: 'The last cup (live: cup-slide / cup-tip / cup-take)' },
    machine: { pos: v3(0, 1.3, -2.86), size: 0.36, view: v3(0, 0, 1), summary: 'Coffee machine front' },
    'counter-edge': { pos: v3(0, BREAK.counterTop, BREAK.counterFront), size: 0.3, view: v3(0, 0.2, 1) },
    'floor-spot': { pos: BREAK.floorSpot, size: 0.12, view: v3(0, 0.35, 1), summary: 'Where a falling cup lands' },
    sign: { pos: v3(-4.17, 1.65, -1.4), size: 0.3, view: v3(1, 0, 0) },
    blinds: { pos: v3(BREAK.window.x - 0.05, BREAK.window.y, BREAK.window.z), size: 0.7, view: v3(-1, 0, 0) },
    'drawer-front': { pos: v3(-1.75, 0.8, BREAK.counterFront), size: 0.2, view: v3(0, 0.2, 1) },
  },
  lights: { tube: BREAK.tubes[0], 'tube-back': BREAK.tubes[1] },
  surfaces: { 'machine-display': { center: BREAK.display.center, width: BREAK.display.width, height: BREAK.display.height, yaw: 0, content: 'machine-ready' } },
  defaultLook: 'office',
  ambience: 'office-tone',
  effects: ['lights-flicker', 'lights-surge', 'cup-slide', 'cup-tip', 'cup-take', 'blinds-close', 'machine-brew', 'drawer-close'],
  lensIds: ['wide', 'counter-low', 'machine-pov', 'door-wide', 'high', 'floor-low', 'symmetry', 'cup-overhead', 'exit-view', 'cup-pov', 'standoff-left', 'standoff-right', 'window-side', 'drawer-side', 'sign-close', 'machine-mid', 'poster-symmetry', 'cup-gap'],
  lens(id) {
    if (id === 'wide') return { pos: v3(0.35, 1.75, 2.9), look: v3(0, 1.1, -2.6), fov: 46 };
    if (id === 'counter-low') return { pos: v3(0.04, 1.08, -1.95), look: v3(0, 1.12, -2.95), fov: 38 };
    if (id === 'machine-pov') return { pos: v3(0, 1.5, -2.78), look: v3(0, 1.62, -1.6), fov: 52 };
    if (id === 'door-wide') return { pos: v3(-3.2, 1.8, 3.4), look: v3(0.2, 1.1, -2.2), fov: 44 };
    // Overhead insert: the cup on the counter, both reaching arms, the tops of two heads.
    if (id === 'cup-overhead') return { pos: v3(0, 2.62, -2.42), look: v3(0, 0.9, -2.8), fov: 64 };
    // From the far corner past the pair: whoever leaves through the door reads.
    if (id === 'exit-view') return { pos: v3(2.3, 1.85, -2.7), look: v3(-3.2, 1.1, 1.05), fov: 50 };
    // Low on the floor in front of the pair: a falling cup drops between their legs.
    if (id === 'floor-low') return { pos: v3(0.22, 0.24, -1.15), look: v3(0, 0.5, -2.62), fov: 42 };
    // Dead-centre symmetrical frame of the machine, counter and both cup marks.
    if (id === 'symmetry') return { pos: v3(0, 1.55, 2.5), look: v3(0, 1.25, -2.8), fov: 54 };
    // The cup's point of view: above the counter beside the machine, looking down at
    // the cup, both reaching hands, both faces bent over it.
    if (id === 'cup-pov') return { pos: v3(0.36, 2.02, -3.08), look: v3(-0.06, 1.04, -2.6), fov: 52 };
    // Standoff singles: past the far shoulder onto whoever stands at cup-left / cup-right.
    if (id === 'standoff-left') return { pos: v3(2.75, 1.92, -0.25), look: v3(-0.5, 1.55, -2.3), fov: 31 };
    if (id === 'standoff-right') return { pos: v3(-2.75, 1.92, -0.25), look: v3(0.5, 1.55, -2.3), fov: 31 };
    // Between the two standing bodies at counter height: the cup, both reaching hands, bodies as dark frames.
    if (id === 'cup-gap') return { pos: v3(0, 1.14, -1.72), look: v3(0, 1.04, -2.8), fov: 32 };
    // Key art: tighter centred frame of the standoff over the cup.
    if (id === 'poster-symmetry') return { pos: v3(0, 1.62, 0.55), look: v3(0, 1.36, -2.8), fov: 46 };
    // Whoever works the blinds at `window`, from behind their left shoulder.
    if (id === 'window-side') return { pos: v3(1.75, 1.75, 0.55), look: v3(3.95, 1.45, -1.25), fov: 44 };
    // The counter drawer at `drawer`, from the room side.
    if (id === 'drawer-side') return { pos: v3(-0.35, 1.95, -1.25), look: v3(-1.8, 0.85, -2.65), fov: 46 };
    // The machine at mid distance: whatever is on / in it plus both heads at the frame edges.
    if (id === 'machine-mid') return { pos: v3(0, 1.5, -0.95), look: v3(0, 1.3, -2.9), fov: 42 };
    // The notice board on the left wall.
    if (id === 'sign-close') return { pos: v3(-3.05, 1.68, -1.25), look: v3(-4.17, 1.62, -1.35), fov: 40 };
    if (id === 'high') return { pos: v3(1.6, 2.7, 0.6), look: v3(-0.1, 0.95, -2.5), fov: 44 };
    return undefined;
  },
  dynamicSubjects(shot, frame, fps, tl) {
    const c = cupState(tl, shot, frame, fps);
    return { cup: { kind: 'prop', pos: c.pos, head: c.pos, facing: 0, radius: 0.1 } };
  },
};
