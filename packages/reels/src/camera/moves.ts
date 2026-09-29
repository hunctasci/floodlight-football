/**
 * Camera movement modifiers layered on any lens. Each is a pure function of
 * shot progress `u` (0..1) / seconds `t`, so stills and video agree.
 *
 *   push-in / pull-out      dolly toward / away from the look point
 *   drift-left / -right     slow lateral truck through the base framing
 *   orbit-left / -right     arc around the look point
 *   rise / descend          crane
 *   snap-zoom               meme punch-in in the first ~0.12s
 *   crash-zoom              violent push in the last 30%
 *   handheld                seeded operator wobble
 *   tilt-to:<subject>       rotate the look toward a subject over the shot
 *   tilt-from:<subject>     start looking at a subject, settle on the framing
 */
import { applyEasing, isEasingId } from '../animation/easing';
import { rng } from '../utils/rng';
import type { Lens, Subject } from '../worlds/types';
import { add, mix, norm, orbit, scale, side, slerpDir, sub, yawOf } from './vec';

export const MOVE_IDS = [
  'static',
  'push-in',
  'pull-out',
  'drift-left',
  'drift-right',
  'orbit-left',
  'orbit-right',
  'rise',
  'descend',
  'snap-zoom',
  'crash-zoom',
  'handheld',
  'tilt-to',
  'tilt-from',
] as const;

export interface MoveContext {
  u: number;
  t: number;
  amount: number;
  ease: string;
  seed: number;
  key: string;
  subject: (id: string) => Subject | undefined;
}

export function parseMove(m: string): { id: string; arg?: string } {
  const i = m.indexOf(':');
  return i < 0 ? { id: m } : { id: m.slice(0, i), arg: m.slice(i + 1) };
}

export function isMoveId(m: string): boolean {
  return (MOVE_IDS as readonly string[]).includes(parseMove(m).id);
}

function wobble(seed: number, key: string, t: number, hz: [number, number]): number {
  const r = rng(seed, key);
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  return Math.sin(t * Math.PI * 2 * hz[0] + p1) * 0.62 + Math.sin(t * Math.PI * 2 * hz[1] + p2) * 0.38;
}

function aimAt(lens: Lens, target: Subject, w: number): Lens {
  const base = norm(sub(lens.look, lens.pos));
  const toTarget = norm(sub(target.head, lens.pos));
  const dir = slerpDir(base, toTarget, w);
  const dist = Math.hypot(lens.look.x - lens.pos.x, lens.look.y - lens.pos.y, lens.look.z - lens.pos.z);
  return { ...lens, look: add(lens.pos, scale(dir, dist)) };
}

export function applyMoves(base: Lens, moves: readonly string[], c: MoveContext): Lens {
  let lens = base;
  const e = applyEasing(isEasingId(c.ease) ? c.ease : 'ease-in-out', c.u);
  const k = c.amount;
  for (const raw of moves) {
    const { id, arg } = parseMove(raw);
    const toLook = sub(lens.look, lens.pos);
    const right = side(yawOf(toLook));
    switch (id) {
      case 'push-in':
        lens = { ...lens, pos: mix(lens.pos, lens.look, 0.26 * k * e) };
        break;
      case 'pull-out':
        lens = { ...lens, pos: mix(lens.pos, lens.look, 0.26 * k * (1 - e)) };
        break;
      case 'drift-left':
      case 'drift-right': {
        const s = (id === 'drift-left' ? 1 : -1) * 0.36 * k * (c.u - 0.5);
        lens = { ...lens, pos: add(lens.pos, scale(right, s)), look: add(lens.look, scale(right, s * 0.35)) };
        break;
      }
      case 'orbit-left':
      case 'orbit-right': {
        const a = (id === 'orbit-left' ? -1 : 1) * ((14 * Math.PI) / 180) * k * (e - 0.5);
        lens = { ...lens, pos: orbit(lens.pos, lens.look, a) };
        break;
      }
      case 'rise':
      case 'descend': {
        const d = (id === 'rise' ? 1 : -1) * 0.5 * k * (e - 0.5);
        lens = { ...lens, pos: { ...lens.pos, y: lens.pos.y + d } };
        break;
      }
      case 'snap-zoom': {
        const s = applyEasing('back-out', Math.min(1, c.t / 0.12));
        lens = { ...lens, fov: lens.fov * (1 - 0.36 * k * s) };
        break;
      }
      case 'crash-zoom': {
        const s = applyEasing('ease-in', Math.max(0, (c.u - 0.7) / 0.3));
        lens = { ...lens, pos: mix(lens.pos, lens.look, 0.45 * k * s), fov: lens.fov * (1 - 0.22 * k * s) };
        break;
      }
      case 'handheld': {
        const n = (axis: string, hz: [number, number]) => wobble(c.seed, `${c.key}:hh:${axis}`, c.t, hz);
        const p = { x: n('px', [0.7, 1.9]) * 0.014 * k, y: n('py', [0.9, 2.3]) * 0.011 * k, z: n('pz', [0.5, 1.4]) * 0.01 * k };
        const l = { x: n('lx', [0.6, 1.7]) * 0.022 * k, y: n('ly', [0.8, 2.1]) * 0.016 * k, z: 0 };
        lens = { ...lens, pos: add(lens.pos, p), look: add(lens.look, l) };
        break;
      }
      case 'tilt-to':
      case 'tilt-from': {
        const target = arg ? c.subject(arg) : undefined;
        if (!target) throw new Error(`Camera move "${raw}" needs a known subject`);
        lens = aimAt(lens, target, id === 'tilt-to' ? e : 1 - e);
        break;
      }
      case 'static':
        break;
      default:
        throw new Error(`Unknown camera move "${raw}"`);
    }
  }
  return lens;
}
