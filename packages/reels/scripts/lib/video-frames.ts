/**
 * QA helper: pull frames out of a rendered MP4 (what viewers actually see)
 * around every cut, into one contact sheet.
 *   tsx scripts/lib/video-frames.ts <content> <mp4> <outDir> [format]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { compileContent } from '../../src/engine/director/compile';
import type { FormatId } from '../../src/engine/formats';
import { loadContent } from './content';
import { contactSheet, REELS_ROOT } from './remotion';

const [ref, mp4, outDir, format] = process.argv.slice(2);
const spec = await loadContent(ref);
const tl = compileContent(spec, { format: (format ?? 'reel') as FormatId });
mkdirSync(outDir, { recursive: true });
const frames = [...new Set([2, ...tl.shots.slice(1).flatMap((s) => [s.start - 2, s.start, s.start + 3]), tl.totalFrames - 3])].filter((f) => f >= 0 && f < tl.totalFrames).sort((a, b) => a - b);
const tiles: { file: string; label: string }[] = [];
for (const f of frames) {
  const file = path.join(outDir, `${String(f).padStart(4, '0')}.png`);
  const r = spawnSync('npx', ['remotion', 'ffmpeg', '-loglevel', 'error', '-y', '-ss', String((f + 0.5) / tl.fps), '-i', path.resolve(mp4), '-frames:v', '1', file], { cwd: REELS_ROOT, stdio: 'ignore' });
  if (r.status === 0) tiles.push({ file, label: `${f} ${tl.shots.find((s) => f >= s.start && f < s.start + s.duration)?.beat ?? ''}` });
}
await contactSheet(tiles, path.join(outDir, 'sheet.png'), 8, 150);
console.log(path.join(outDir, 'sheet.png'), tiles.length, 'frames');
process.exit(0);
