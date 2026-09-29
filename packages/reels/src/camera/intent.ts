/**
 * Camera intent parsing. Two equivalent spellings:
 *
 *   'over-shoulder:hero>rival push-in handheld'
 *   { lens: 'over-shoulder', on: 'hero', at: 'rival', move: ['push-in', 'handheld'] }
 *
 * `left` / `right` tokens pick the side; `x1.5` sets the move amount.
 */
import type { CameraSpec } from '../engine/spec/types';
import type { CameraIntent } from '../engine/timeline/types';

function parseString(s: string): Omit<CameraIntent, 'to'> {
  const [head, ...mods] = s.trim().split(/\s+/);
  const [lens, subjects] = head.split(':');
  const [on, at] = (subjects ?? '').split('>');
  const out: Omit<CameraIntent, 'to'> = { lens, move: [], amount: 1, ease: 'ease-in-out' };
  if (on) out.on = on;
  if (at) out.at = at;
  for (const m of mods) {
    if (m === 'left' || m === 'right') out.side = m;
    else if (/^x\d+(\.\d+)?$/.test(m)) out.amount = Number(m.slice(1));
    else out.move.push(m);
  }
  return out;
}

function normalizeOne(c: Omit<CameraSpec, 'to'> | string): Omit<CameraIntent, 'to'> {
  if (typeof c === 'string') return parseString(c);
  const base = parseString(c.lens);
  return {
    ...base,
    on: c.on ?? base.on,
    at: c.at ?? base.at,
    move: [...base.move, ...(c.move ?? [])],
    amount: c.amount ?? base.amount,
    side: c.side ?? base.side,
    ease: c.ease ?? base.ease,
  };
}

export function normalizeCamera(c: CameraSpec | string): CameraIntent {
  const one = normalizeOne(c);
  const to = typeof c === 'string' ? undefined : c.to;
  return to ? { ...one, to: normalizeOne(to) } : one;
}
