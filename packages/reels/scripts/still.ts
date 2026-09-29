#!/usr/bin/env tsx
/**
 * reels:still — deterministic PNG stills.
 *   --content office-rivalry --frame 120
 *   --content office-rivalry --at faceoff@55%,goal   (timing grammar, any beats → one sheet)
 *   --content office-rivalry --key thumb             (spec keyArt marker)
 *   --content office-rivalry --beats                 (contact sheet: every beat)
 *   [--format reel|story|portrait|square] [--output file.png]
 */
import path from 'node:path';
import { compileContent } from '../src/engine/director/compile';
import { isFormatId, type FormatId } from '../src/engine/formats';
import { resolveAt } from '../src/engine/spec/timing';
import { compositionId } from '../src/content';
import { arg, flag } from './lib/args';
import { loadContent } from './lib/content';
import { contactSheet, stills } from './lib/remotion';

const spec = await loadContent(arg('content'));
const format = (arg('format') ?? spec.formats?.[0] ?? 'reel') as FormatId;
if (!isFormatId(format)) throw new Error(`Unknown format ${format}`);
const tl = compileContent(spec, { format });
const outDir = arg('out-dir', path.resolve('social/output/stills'))!;
const props = { spec, format };

function frameOf(at: string): number {
  const beats = new Map(tl.shots.map((s) => [s.beat, { id: s.beat, start: s.start, duration: s.duration }]));
  return resolveAt(at, { fps: tl.fps, beat: { id: '_', start: 0, duration: tl.totalFrames }, beats });
}

let frames: { frame: number; label: string }[];
if (flag('beats')) {
  frames = tl.shots.flatMap((s) => [0.15, 0.55, 0.92].map((k) => ({ frame: s.start + Math.min(s.duration - 1, Math.round(s.duration * k)), label: `${s.beat}@${Math.round(k * 100)}` })));
} else if (arg('key')) {
  const f = tl.markers[`key:${arg('key')}`];
  if (f === undefined) throw new Error(`No keyArt "${arg('key')}" (have: ${Object.keys(tl.markers).filter((m) => m.startsWith('key:')).join(', ')})`);
  frames = [{ frame: f, label: `key-${arg('key')}` }];
} else if (arg('at')) {
  // One or more times, comma separated: --at reach@80%,stare-a@60%
  frames = arg('at')!.split(',').map((a) => ({ frame: frameOf(a.trim()), label: a.trim().replace(/[@%]/g, '_') }));
} else {
  frames = (arg('frame', '0') ?? '0').split(',').map((f) => ({ frame: Number(f), label: `f${f}` }));
}
const single = arg('output');
const files = await stills(compositionId('content'), props, frames.map((f) => f.frame), (f) => {
  if (single && frames.length === 1) return path.resolve(single);
  const lbl = frames.find((x) => x.frame === f)?.label ?? `f${f}`;
  return path.join(outDir, `${spec.id}-${format}`, `${String(f).padStart(4, '0')}-${lbl}.png`);
});
if (files.length > 1) {
  const sheet = path.join(outDir, `${spec.id}-${format}`, 'sheet.png');
  await contactSheet(files.map((file, i) => ({ file, label: `${frames[i].frame} ${frames[i].label}` })), sheet, flag('beats') ? 6 : Math.min(5, files.length), flag('beats') ? 180 : 240);
  console.log(`sheet → ${sheet}`);
}
for (const f of files) console.log(f);
process.exit(0);
