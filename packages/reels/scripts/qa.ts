#!/usr/bin/env tsx
/**
 * reels:qa — motion + framing report, plus contact sheets for review:
 *   npm run reels:qa -- --content office-rivalry           (report only)
 *   npm run reels:qa -- --content office-rivalry --sheet   (+ every beat at 15/55/92%)
 *   npm run reels:qa -- --content office-rivalry --cuts    (+ 6 frames around every cut)
 */
import path from 'node:path';
import { compileContent } from '../src/engine/director/compile';
import type { FormatId } from '../src/engine/formats';
import { qaTimeline } from '../src/engine/qa';
import { arg, flag } from './lib/args';
import { loadContent } from './lib/content';
import { contactSheet, stills } from './lib/remotion';

const spec = await loadContent(arg('content'));
const format = (arg('format') ?? spec.formats?.[0] ?? 'reel') as FormatId;
const tl = compileContent(spec, { format });
const qa = qaTimeline(tl);
for (const q of qa) console.log(`[${q.level}] ${q.shot} @${q.frame}: ${q.message}`);
console.log(`${qa.filter((q) => q.level === 'error').length} errors, ${qa.filter((q) => q.level === 'warn').length} warnings`);
const dir = path.resolve(arg('out-dir', `social/output/qa/${spec.id}-${format}`)!);
const sheet = async (name: string, frames: { frame: number; label: string }[], cols: number) => {
  const files = await stills('Content', { spec, format }, frames.map((f) => f.frame), (f) => path.join(dir, name, `${String(f).padStart(4, '0')}.png`));
  await contactSheet(files.map((file, i) => ({ file, label: `${frames[i].frame} ${frames[i].label}` })), path.join(dir, `${name}.png`), cols, 180);
  console.log(`${name} sheet → ${path.join(dir, `${name}.png`)}`);
};
if (flag('sheet')) await sheet('beats', tl.shots.flatMap((s) => [0.15, 0.55, 0.92].map((k) => ({ frame: s.start + Math.min(s.duration - 1, Math.round(s.duration * k)), label: `${s.beat}@${Math.round(k * 100)}` }))), 6);
if (flag('cuts')) await sheet('cuts', tl.shots.slice(1).flatMap((s) => [-3, -2, -1, 0, 1, 2].map((d) => ({ frame: s.start + d, label: `${s.beat}${d >= 0 ? '+' : ''}${d}` }))), 6);
process.exit(qa.some((q) => q.level === 'error') ? 1 : 0);
