/** Render one ContentSpec to a mastered MP4 (stem → video → loudness). Shared by render / campaign. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compileContent } from '../../src/engine/director/compile';
import type { FormatId } from '../../src/engine/formats';
import type { ContentSpec } from '../../src/engine/spec/types';
import { renderStemWav, stemPath } from '../../src/audio/stem';
import { master } from './master';
import { REELS_ROOT, video } from './remotion';

/** Write the stem into public/ (must happen before the first bundle). */
export function writeStem(spec: ContentSpec, format: FormatId = 'reel'): string {
  const tl = compileContent(spec, { format });
  const sfx = stemPath(tl);
  const file = path.join(REELS_ROOT, 'public', sfx);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, renderStemWav(tl));
  return sfx;
}

export async function renderReel(spec: ContentSpec, output: string, opts: { format?: FormatId; scale?: number; sfx?: string } = {}): Promise<ReturnType<typeof master>> {
  const format = opts.format ?? 'reel';
  const sfx = opts.sfx ?? stemPath(compileContent(spec, { format }));
  await video('Content', { spec, format, sfx }, output, { scale: opts.scale ?? 1 });
  return master(output);
}
