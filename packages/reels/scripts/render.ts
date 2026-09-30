#!/usr/bin/env tsx
/**
 * reels:render — validate, synthesise the SFX stem, render MP4 (H.264 + AAC).
 *   npm run reels:render -- --content office-rivalry                    (primary format)
 *   npm run reels:render -- --content office-rivalry --format all       (every declared format)
 *   npm run reels:render -- --content ./my-idea.json --format square --output social/output/x.mp4
 *   [--scale 0.5] (fast preview)  [--frames 0-120]  [--concurrency 12]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compileContent } from '../src/engine/director/compile';
import { assertValidContent } from '../src/engine/director/validate';
import { isFormatId, type FormatId } from '../src/engine/formats';
import { renderStemWav, stemPath } from '../src/audio/stem';
import { getCue } from '../src/audio/registry';
import { SCORES } from '../src/audio/scores';
import { arg } from './lib/args';
import { loadContent } from './lib/content';
import { master } from './lib/master';
import { REELS_ROOT, video } from './lib/remotion';

const spec = await loadContent(arg('content'));
assertValidContent(spec);
const want = arg('format');
const formats: FormatId[] = want === 'all' ? spec.formats ?? ['reel'] : [(want ?? spec.formats?.[0] ?? 'reel') as FormatId];
const scale = Number(arg('scale', '1'));
const range = arg('frames')?.split('-').map(Number) as [number, number] | undefined;
// Stems first: the bundle snapshots public/, so every file must exist before it.
const first = compileContent(spec, { format: formats[0] });
const sfx = stemPath(first);
const file = path.join(REELS_ROOT, 'public', sfx);
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, renderStemWav(first));
const score = SCORES[spec.id];
if (score) {
  const out = path.join(REELS_ROOT, 'public', getCue(score.cue).file!);
  writeFileSync(out, score.render(first.seed));
  console.log(`score → ${path.relative(process.cwd(), out)}`);
}
for (const format of formats) {
  if (!isFormatId(format)) throw new Error(`Unknown format ${format}`);
  const tl = compileContent(spec, { format });
  const output = path.resolve(arg('output') && formats.length === 1 ? arg('output')! : `social/output/${spec.id}-${format}${scale !== 1 ? '-preview' : ''}.mp4`);
  console.log(`Rendering ${spec.id} [${format} ${tl.width}x${tl.height}, ${tl.totalFrames}f @ ${tl.fps}] → ${output}`);
  await video('Content', { spec, format, sfx }, output, { scale, frameRange: range, concurrency: arg('concurrency') ? Number(arg('concurrency')) : undefined });
  const m = master(output);
  console.log(`  audio: ${m.lufs} LUFS / ${m.truePeak} dBTP → ${m.gainDb >= 0 ? '+' : ''}${m.gainDb.toFixed(2)} dB → ${m.out.lufs} LUFS / ${m.out.truePeak} dBTP${m.out.lufs < -15.5 ? '  (peak-limited: reduce transient peaks to get louder)' : ''}`);
}
process.exit(0);
