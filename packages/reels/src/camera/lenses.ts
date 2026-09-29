/**
 * Generic subject-relative lenses — portrait (9:16) camera grammar that works
 * in any 3D world, because every lens is built from subjects (heads, props,
 * lights), never world coordinates.
 *
 * Portrait is ~29° wide at fov 50, so two-person framings stack in depth
 * (over-shoulder, depth two-shot) instead of side by side. Close framings put
 * the eyes in the upper third (look point below the head).
 *
 * Distances are calibrated to HNC proportions, not human ones: the head is a
 * 0.64 m icosahedron on a ~2 m figure, so a "close-up" frames ~1.2 m.
 */
import type { Lens, Subject, Vec3 } from '../worlds/types';
import { add, flat, forward, norm, scale, side, sub, up, yawOf } from './vec';

export interface LensInput {
  on?: Subject;
  at?: Subject;
  /** +1 / -1: which side of the subject the camera sits on. */
  side: number;
}

type Builder = (i: LensInput) => Lens;

const need = (s: Subject | undefined, lens: string, role: string): Subject => {
  if (!s) throw new Error(`Lens "${lens}" needs a ${role} subject`);
  return s;
};

/** Where a subject "faces" for framing: props/lights face their view vector. */
function frontOf(s: Subject): Vec3 {
  return forward(s.facing);
}

/** Look point that puts `head` at ~40% from the top for a lens at `dist`. */
function eyeLine(head: Vec3, dist: number, fov: number, frac = 0.1): Vec3 {
  const frameH = 2 * dist * Math.tan((fov * Math.PI) / 360);
  return add(head, up(-frac * frameH));
}

const close: Builder = (i) => {
  const s = need(i.on, 'close', 'on');
  const d = 2.3;
  const fov = 30;
  const f = frontOf(s);
  const pos = add(add(add(s.head, scale(f, d)), scale(side(s.facing), i.side * 0.75)), up(0.04));
  return { pos, look: eyeLine(s.head, d, fov, 0.12), fov };
};

const medium: Builder = (i) => {
  const s = need(i.on, 'medium', 'on');
  const d = 3.3;
  const fov = 36;
  const pos = add(add(add(s.head, scale(frontOf(s), d)), scale(side(s.facing), i.side * 0.9)), up(-0.05));
  return { pos, look: add(s.head, up(-0.45)), fov };
};

const full: Builder = (i) => {
  const s = need(i.on, 'full', 'on');
  const d = 5.4;
  const fov = 38;
  const pos = add(add(add(s.pos, scale(frontOf(s), d)), scale(side(s.facing), i.side * 0.9)), up(1.25));
  return { pos, look: add(s.pos, up(Math.max(0.6, (s.head.y - s.pos.y) * 0.55))), fov };
};

/** Behind `on`'s shoulder looking at `at` (who faces the lens). */
const overShoulder: Builder = (i) => {
  const a = need(i.on, 'over-shoulder', 'on');
  const b = need(i.at, 'over-shoulder', 'at');
  const dir = norm(flat(sub(b.head, a.head)));
  const right = side(yawOf(dir));
  // Foreground head ~a quarter of the frame edge (HNC heads are big).
  const pos = add(add(add(a.head, scale(dir, -1.6)), scale(right, i.side * 0.78)), up(0.22));
  return { pos, look: add(b.head, up(-0.2)), fov: 34 };
};

/** Depth two-shot: `on` in the near third, `at` further back, both faces readable. */
const twoShot: Builder = (i) => {
  const a = need(i.on, 'two-shot', 'on');
  const b = need(i.at, 'two-shot', 'at');
  const dir = norm(flat(sub(b.pos, a.pos)));
  const right = side(yawOf(dir));
  const top = Math.max(a.head.y, b.head.y);
  const pos = add(add(add(flat(a.pos), scale(dir, -1.7)), scale(right, i.side * 1.45)), up(top + 0.3));
  const look = add(add(scale(a.head, 0.4), scale(b.head, 0.6)), up(-0.3));
  return { pos, look, fov: 44 };
};

/**
 * Tight insert on a prop. With `at`, the camera sits on the line from `at`
 * through the prop: the prop in the foreground, its owner soft behind it.
 */
const macro: Builder = (i) => {
  const s = need(i.on, 'macro', 'on');
  const size = Math.max(0.08, s.radius);
  const dist = Math.max(0.6, size * 4.5);
  if (i.at) {
    const away = norm(add(flat(sub(s.head, i.at.head)), up(0.05)));
    const pos = add(add(s.head, scale(away, dist * 1.6)), scale(side(yawOf(away)), i.side * 0.14));
    return { pos, look: add(s.head, scale(sub(i.at.head, s.head), 0.46)), fov: 44 };
  }
  // Near-horizontal so whatever stands behind the prop stays in frame.
  const view = norm(add(frontOf(s), up(0.14)));
  const pos = add(add(s.head, scale(view, dist)), scale(side(s.facing), i.side * 0.12));
  return { pos, look: add(s.head, up(0.03)), fov: 28 };
};

const lowAngle: Builder = (i) => {
  const s = need(i.on, 'low-angle', 'on');
  const pos = add(add(add(s.pos, scale(frontOf(s), 2.5)), scale(side(s.facing), i.side * 0.7)), up(0.45));
  return { pos, look: add(s.head, up(0.12)), fov: 44 };
};

/** Under a light/prop looking up at it (or from `at`'s head up to `on`). */
const lookUp: Builder = (i) => {
  const s = need(i.on, 'look-up', 'on');
  if (i.at) {
    const pos = add(i.at.head, up(0.15));
    return { pos, look: s.head, fov: 44 };
  }
  const pos = add(add(s.head, up(-1.35)), scale(frontOf(s), 0.9));
  return { pos, look: s.head, fov: 46 };
};

const topDown: Builder = (i) => {
  const s = need(i.on, 'top-down', 'on');
  const pos = add(add(s.pos, up(6)), scale(frontOf(s), 0.6));
  return { pos, look: s.pos, fov: 40 };
};

export const GENERIC_LENSES: Record<string, Builder> = {
  close,
  medium,
  full,
  'over-shoulder': overShoulder,
  'two-shot': twoShot,
  macro,
  'low-angle': lowAngle,
  'look-up': lookUp,
  'top-down': topDown,
};

export const GENERIC_LENS_IDS = Object.keys(GENERIC_LENSES);

/** Which generic lenses need which subjects (validation + docs). */
export const LENS_SUBJECTS: Record<string, { on: boolean; at: boolean }> = {
  close: { on: true, at: false },
  medium: { on: true, at: false },
  full: { on: true, at: false },
  'over-shoulder': { on: true, at: true },
  'two-shot': { on: true, at: true },
  macro: { on: true, at: false },
  'low-angle': { on: true, at: false },
  'look-up': { on: true, at: false },
  'top-down': { on: true, at: false },
};
