import type { WorldDef } from '../types';

/**
 * plate — a pre-rendered image sequence (a Blender plate) as a world: the
 * hybrid renderer seam. Blender renders the picture of the shot
 * (tools/blender, `hnc_cli.py plate`) into public/generated/plates/<id>/
 * 0001.png…; Remotion keeps time, cuts, overlays, text, fx and audio.
 * Plate frame n is shown on shot-local frame n-1 (+ `offset`), so a plate is
 * rendered at the reel's fps for exactly the frames the edit uses.
 */
export const PLATE_WORLD: WorldDef = {
  id: 'plate',
  kind: '2d',
  summary: 'Pre-rendered Blender plate (image sequence) — hybrid shots; Remotion adds overlays, fx and sound.',
  params: {
    plate: 'Plate id: public/generated/plates/<id>/0001.png… (rendered by tools/blender)',
    offset: 'First plate frame shown (default 1)',
    frames: 'Plate length; the last frame holds if the beat is longer',
  },
  marks: {},
  props: {},
  lights: {},
  surfaces: {},
  lensIds: [],
  validateSet(set) {
    const out: string[] = [];
    if (typeof set.plate !== 'string' || !/^[a-z0-9-]+$/.test(set.plate)) out.push('plate: a plate id (lowercase, digits, dashes) is required');
    if (set.offset !== undefined && !(Number.isInteger(set.offset) && Number(set.offset) >= 1)) out.push('offset must be an integer >= 1');
    if (set.frames !== undefined && !(Number.isInteger(set.frames) && Number(set.frames) >= 1)) out.push('frames must be an integer >= 1');
    return out;
  },
};

/** Plate frame file (public-relative) for a shot-local frame. */
export function plateFile(set: Record<string, unknown>, local: number): string {
  const offset = Number(set.offset ?? 1);
  const last = set.frames !== undefined ? Number(set.frames) : Infinity;
  const n = Math.min(last, Math.max(1, offset + local));
  return `generated/plates/${String(set.plate)}/${String(n).padStart(4, '0')}.png`;
}
