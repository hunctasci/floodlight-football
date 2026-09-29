#!/usr/bin/env tsx
/**
 * reels:validate — spec validation (vocabulary, timing, creative lint) +
 * framing/motion QA for every format. No browser; fast.
 *   npm run reels:validate -- --content office-rivalry [--format reel] [--quiet]
 */
import { compileContent } from '../src/engine/director/compile';
import { validateContent } from '../src/engine/director/validate';
import type { FormatId } from '../src/engine/formats';
import { qaTimeline } from '../src/engine/qa';
import { arg, flag } from './lib/args';
import { loadContent } from './lib/content';

const spec = await loadContent(arg('content'));
const issues = validateContent(spec);
for (const i of issues) console.log(`[${i.level}] ${i.path}: ${i.message}`);
if (issues.some((i) => i.level === 'error')) process.exit(1);
const formats = (arg('format') ? [arg('format')] : spec.formats ?? ['reel']) as FormatId[];
let errors = 0;
for (const format of formats) {
  const tl = compileContent(spec, { format });
  const qa = qaTimeline(tl);
  errors += qa.filter((q) => q.level === 'error').length;
  if (!flag('quiet')) for (const q of qa) console.log(`[qa:${q.level}] ${format} ${q.shot} @${q.frame}: ${q.message}`);
  console.log(`${format}: ${tl.width}x${tl.height} | ${tl.totalFrames} frames @ ${tl.fps}fps (${(tl.totalFrames / tl.fps).toFixed(2)}s) | ${tl.shots.length} shots | ${tl.sounds.length} sounds | QA ${qa.filter((q) => q.level === 'error').length} errors, ${qa.filter((q) => q.level === 'warn').length} warnings`);
}
process.exit(errors ? 1 : 0);
