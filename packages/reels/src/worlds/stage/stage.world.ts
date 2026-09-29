import type { WorldDef } from '../types';
import { v3 } from '../types';

/**
 * stage — an abstract graphic world: a seamless cyclorama and one giant
 * object. `set.object: 'phone'` stands a monolith-sized phone on the floor,
 * its screen showing `set.chat` in the HNC chat skin. Marks behind the screen
 * plane are INSIDE the phone: walking a cast member out of them makes them
 * step out through the glass.
 */
export const STAGE = { phone: { w: 2.7, h: 5.4, d: 0.34 }, screenInset: 0.12 } as const;

export const STAGE_WORLD: WorldDef = {
  id: 'stage',
  kind: '3d',
  summary: 'Abstract cyclorama with one giant object (a phone whose chat people step out of).',
  params: {
    object: 'phone (default)',
    chat: 'Messages on the giant screen: [{ from: cast id, say }] (newest last)',
    me: 'Cast id whose messages are on the right',
    title: 'Chat title',
    tone: 'Cyclorama colour: navy | red | gold (default navy)',
  },
  marks: {
    'in-left': { x: -0.62, z: -0.6, facing: 0, posture: 'stand' },
    'in-right': { x: 0.62, z: -0.6, facing: 0, posture: 'stand' },
    'out-left': { x: -0.78, z: 1.35, facing: Math.PI / 2, posture: 'stand' },
    'out-right': { x: 0.78, z: 1.35, facing: -Math.PI / 2, posture: 'stand' },
  },
  props: {
    screen: { pos: v3(0, STAGE.phone.h * 0.5, 0.02), size: 2.2, view: v3(0, 0, 1), summary: 'The giant phone screen' },
    'screen-bubble': { pos: v3(0.66, 1.0, 0.02), size: 0.5, view: v3(0, 0, 1), summary: 'Where the newest message sits' },
  },
  lights: { 'screen-light': v3(0, 2.7, 0.5) },
  surfaces: {},
  defaultLook: 'hoodie',
  ambience: 'room-tone',
  lensIds: ['bubble-close', 'reveal', 'reveal-low', 'poster'],
  lens(id) {
    // Inside the newest bubble (the zoom-through lands here), then pull out.
    // Painted newest (short, mine) bubble centre on the giant screen: ≈ (0.66, 1.0).
    if (id === 'bubble-close') return { pos: v3(0.66, 1.0, 0.75), look: v3(0.66, 1.0, 0), fov: 34 };
    if (id === 'reveal') return { pos: v3(2.2, 2.3, 8.2), look: v3(0, 2.2, 0), fov: 44 };
    if (id === 'reveal-low') return { pos: v3(1.3, 0.55, 5.6), look: v3(0, 1.9, 0.4), fov: 50 };
    if (id === 'poster') return { pos: v3(3.3, 3.1, 7.8), look: v3(0.2, 2.25, 0.2), fov: 46 };
    return undefined;
  },
};
