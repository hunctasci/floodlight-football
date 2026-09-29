import type { WorldDef } from '../types';
import { v3 } from '../types';
import { APT } from './layout';
import { ballState } from './state';

/**
 * apartment — a living room at night after the summer's football: the TV
 * (surface `tv`), a moving box for the scarf, remote and phone on the coffee
 * table, a floor lamp, the city through the window, a dark hallway. World
 * events: `ball-roll` (a ball rolls out of the hallway and settles), `phone-wake`
 * (the phone on the table lights up), `scarf-in`, `remote-down`, `room-shift`
 * (the lamp fades and cold floodlight pours through the window).
 */
export const APARTMENT_WORLD: WorldDef = {
  id: 'apartment',
  kind: '3d',
  summary: 'Night living room: TV, sofa, coffee table with phone + remote, moving box, floor lamp, window, dark hallway.',
  params: { tv: 'TV content (tv-slate | black | off; default tv-slate)', notification: 'Phone notification line when it wakes', ballGlow: 'A faint glow under the ball (key art)' },
  marks: {
    sofa: { x: APT.sofa.x - 0.25, z: APT.sofa.z - 0.3, facing: Math.PI, posture: 'sit' },
    box: { x: -1.55, z: 0.02, facing: -0.8, posture: 'stand' },
    centre: { x: -0.62, z: 0.45, facing: Math.PI, posture: 'stand' },
    table: { x: 0.15, z: 1.05, facing: 2.6, posture: 'stand' },
    hall: { x: -4.0, z: -1.3, facing: Math.PI / 2, posture: 'stand' },
    far: { x: -0.95, z: 1.3, facing: 3.0, posture: 'stand' },
  },
  props: {
    ball: { pos: APT.ballTo, size: 0.28, view: v3(0.3, 0.2, 1), summary: 'Where the ball comes to rest' },
    phone: { pos: APT.phone, size: 0.12, view: v3(0.1, 1.7, 0.35), summary: 'Phone face-up on the coffee table' },
    remote: { pos: APT.remote, size: 0.1, view: v3(0.2, 1, 0.5) },
    scarf: { pos: v3(APT.box.x, 0.42, APT.box.z), size: 0.2, view: v3(0.4, 1, 0.5), summary: 'The moving box (scarf goes in)' },
    hallway: { pos: v3(APT.hall.x, 1.0, APT.hall.z), size: 0.6, view: v3(1, 0, 0) },
  },
  lights: { lamp: APT.lamp, 'window-light': v3(APT.window.x - 0.05, APT.window.y, APT.window.z) },
  surfaces: { tv: { center: APT.tv.center, width: APT.tv.width, height: APT.tv.height, yaw: 0, content: 'tv-slate' } },
  defaultLook: 'tee',
  ambience: 'room-tone',
  effects: ['ball-roll', 'phone-wake', 'scarf-in', 'remote-down', 'room-shift'],
  lensIds: ['tv-wide', 'hall-low', 'room-wide', 'window-wide', 'poster-floor'],
  lens(id) {
    // Behind the sofa: the room in silhouette against the TV.
    if (id === 'tv-wide') return { pos: v3(0.95, 1.9, 4.7), look: v3(0.15, 1.05, -2.8), fov: 36 };
    // On the floor by the hallway: the ball's path into the lamplight.
    if (id === 'hall-low') return { pos: v3(0.35, 0.3, -0.12), look: v3(-3.6, 0.42, -1.3), fov: 44 };
    // Corner wide: TV, sofa, window, the person standing in the middle.
    if (id === 'room-wide') return { pos: v3(2.6, 1.95, 3.3), look: v3(-1.3, 0.9, -0.2), fov: 48 };
    // Toward the window: cold light pouring in.
    if (id === 'window-wide') return { pos: v3(-1.9, 1.55, 2.2), look: v3(2.9, 1.35, -0.7), fov: 48 };
    // Key art: on the floor in front of the ball, looking up past it at whoever stands over it.
    if (id === 'poster-floor') return { pos: v3(0.62, 0.4, -2.25), look: v3(-0.72, 0.92, 1.2), fov: 54 };
    return undefined;
  },
  dynamicSubjects(shot, frame, _fps, tl) {
    const b = ballState(tl, shot, frame);
    return { ball: { kind: 'ball', pos: { ...b.pos, y: 0 }, head: b.pos, facing: 0, radius: 0.28 } };
  },
};
