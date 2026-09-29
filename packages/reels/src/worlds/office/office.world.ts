import type { WorldDef } from '../types';
import { v3 } from '../types';
import { CEILING_LIGHT, deskProps, OFFICE, podSeats } from './layout';

/**
 * office — open-plan office in the HNC low-poly language. Two facing desks
 * (desk-a, desk-b) whose owners' countries dress the desks automatically
 * (mini flag, mug colour), background coworkers typing, a fluorescent grid
 * that can flicker, a wall clock.
 */
const a = deskProps(1);
const b = deskProps(-1);

export const OFFICE_WORLD: WorldDef = {
  id: 'office',
  kind: '3d',
  summary: 'Open-plan office pod: two facing desks dressed with the owners’ country clues, coworkers, fluorescent lights.',
  params: {
    clock: 'Wall clock text (default "09:03")',
    extras: 'Background coworkers 0..6 (default 5)',
    screens: 'Monitor content per surface, e.g. { "desk-b-monitor": "hnc-live" } (default spreadsheet)',
    clues: 'Dress desks with owner country flag + mug (default true)',
  },
  marks: {
    'desk-a': { x: 0, z: OFFICE.seatZ, facing: Math.PI, posture: 'sit' },
    'desk-b': { x: 0, z: -OFFICE.seatZ, facing: 0, posture: 'sit' },
    aisle: { x: 1.8, z: 0.3, facing: -Math.PI / 2, posture: 'stand' },
    door: { x: 5.2, z: -2.6, facing: Math.PI / 2, posture: 'stand' },
    'coffee-machine': { x: -4.9, z: 2.2, facing: -Math.PI / 2, posture: 'stand' },
    // Background seats (coworkers sit here unless a cast member takes one).
    ...Object.fromEntries(Object.entries(podSeats()).map(([id, m]) => [id, { ...m, posture: 'sit' as const }])),
  },
  props: {
    'desk-a-flag': { pos: a.flag, size: 0.14, summary: 'desk-a owner country flag' },
    'desk-b-flag': { pos: b.flag, size: 0.14, summary: 'desk-b owner country flag (seen from desk-a side)' },
    'desk-a-mug': { pos: a.mug, size: 0.11 },
    'desk-b-mug': { pos: b.mug, size: 0.11 },
    'desk-a-keyboard': { pos: a.keyboard, size: 0.25 },
    'desk-b-keyboard': { pos: b.keyboard, size: 0.25 },
    'pod-centre': { pos: v3(0, 1.45, 0), size: 1.2, summary: 'Between the two desks (where coworkers stare)' },
    'wall-clock': { pos: v3(1.95, 2.3, OFFICE.room.back + 0.06), size: 0.3 },
  },
  lights: { 'ceiling-light': CEILING_LIGHT },
  surfaces: {
    'desk-a-monitor': { center: v3(0, OFFICE.monitorY, OFFICE.monitorZ + 0.03), width: OFFICE.monitorW - 0.06, height: OFFICE.monitorH - 0.06, yaw: 0 },
    'desk-b-monitor': { center: v3(0, OFFICE.monitorY, -OFFICE.monitorZ - 0.03), width: OFFICE.monitorW - 0.06, height: OFFICE.monitorH - 0.06, yaw: Math.PI },
  },
  defaultLook: 'office',
  ambience: 'office-tone',
  effects: ['lights-flicker', 'lights-surge', 'coworkers-look'],
  lensIds: ['wide', 'wide-reverse', 'pod-high'],
  lens(id) {
    // Establishing views of the pod (subject-free).
    if (id === 'wide') return { pos: v3(2.9, 2.25, 4.1), look: v3(-0.1, 1.05, -0.5), fov: 50 };
    if (id === 'wide-reverse') return { pos: v3(-2.7, 2.2, -4.2), look: v3(0.1, 1.05, 0.4), fov: 50 };
    if (id === 'pod-high') return { pos: v3(0.9, 2.85, 2.6), look: v3(0, 0.95, -0.2), fov: 46 };
    return undefined;
  },
  validateSet(set) {
    const out: string[] = [];
    if (set.extras !== undefined && !(Number.isInteger(set.extras) && (set.extras as number) >= 0 && (set.extras as number) <= 6)) out.push('extras must be an integer 0..6');
    if (set.clock !== undefined && typeof set.clock !== 'string') out.push('clock must be a string like "09:03"');
    return out;
  },
};
