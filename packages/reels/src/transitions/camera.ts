/**
 * Camera side of transitions: the whip-pan yaws the outgoing camera away and
 * swings the incoming one in from the same direction. Pure.
 */
import { applyEasing } from '../animation/easing';
import { orbit } from '../camera/vec';
import type { Shot } from '../engine/timeline/types';
import type { Lens } from '../worlds/types';

const WHIP = 1.15;

export function transitionCamera(lens: Lens, shot: Shot, frame: number): Lens {
  let angle = 0;
  const ex = shot.exit;
  if (ex?.type === 'whip-pan' && frame >= ex.start && frame < ex.cut) {
    const p = (frame - ex.start) / Math.max(1, ex.cut - ex.start);
    angle = (ex.direction === 'right' ? -1 : 1) * applyEasing('ease-in', p) * WHIP;
  }
  const en = shot.enter;
  if (en?.type === 'whip-pan' && frame >= en.cut && frame < en.end) {
    const p = (frame - en.cut) / Math.max(1, en.end - en.cut);
    angle = -(en.direction === 'right' ? -1 : 1) * (1 - applyEasing('ease-out', p)) * WHIP;
  }
  return angle === 0 ? lens : { ...lens, look: orbit(lens.look, lens.pos, angle) };
}
