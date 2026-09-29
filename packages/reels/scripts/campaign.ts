#!/usr/bin/env tsx
/**
 * reels:campaign — produce the autumn 2026 campaign into
 * social/output/autumn-2026/<NN-slug>/: reel.mp4 (1080×1920, 60 fps, mastered),
 * post.png (4:5 key art), storyboard.md (generated), qa/ (beat sheet, frames
 * pulled from the MP4 around every cut, report). copy.md is authored by hand.
 *   npm run reels:campaign                       (everything)
 *   npm run reels:campaign -- --only 2,9          (some items)
 *   npm run reels:campaign -- --skip-reel / --skip-poster / --skip-qa
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { compileContent } from '../src/engine/director/compile';
import { validateContent } from '../src/engine/director/validate';
import { qaTimeline } from '../src/engine/qa';
import { storyboardMarkdown } from '../src/engine/storyboard';
import { CAMPAIGN, campaignDir } from '../src/content/autumn-2026/campaign';
import { POSTERS } from '../src/content/autumn-2026/posters';
import { arg, flag } from './lib/args';
import { contactSheet, REELS_ROOT, stills } from './lib/remotion';
import { renderReel, writeStem } from './lib/reel';
import { renderPoster } from './poster';

const only = arg('only')?.split(',').map(Number);
const items = CAMPAIGN.filter((c) => !only || only.includes(c.n));
// Stems before the (single) bundle.
const stems = new Map(items.map((c) => [c.n, writeStem(c.reel)]));

for (const item of items) {
  const dir = path.resolve(campaignDir(item));
  mkdirSync(path.join(dir, 'qa'), { recursive: true });
  const tl = compileContent(item.reel, { format: 'reel' });
  const issues = validateContent(item.reel);
  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length) throw new Error(`${item.dir}: ${errors.map((e) => e.message).join('; ')}`);
  console.log(`\n#${item.n} ${item.title} — ${(tl.totalFrames / tl.fps).toFixed(2)}s, ${tl.shots.length} shots`);
  const intro = [
    `**#${item.n} · ${item.date}** — ${item.context}`,
    '',
    `- **Hook:** ${item.notes.hook}`,
    `- **Story:** ${item.notes.story}`,
    `- **Surprise:** ${item.notes.surprise}`,
    `- **Payoff:** ${item.notes.payoff}`,
  ].join('\n');
  writeFileSync(path.join(dir, 'storyboard.md'), storyboardMarkdown(item.reel, tl, intro));

  const report: string[] = [`${item.dir} · ${tl.width}x${tl.height} ${tl.fps}fps ${tl.totalFrames}f`, '', 'VALIDATION'];
  for (const i of issues) report.push(`  [${i.level}] ${i.path}: ${i.message}`);
  report.push('', 'FRAMING / MOTION QA');
  for (const q of qaTimeline(tl)) report.push(`  [${q.level}] ${q.shot} @${q.frame}: ${q.message}`);

  if (!flag('skip-reel')) {
    const out = path.join(dir, 'reel.mp4');
    const m = await renderReel(item.reel, out, { sfx: stems.get(item.n) });
    report.push('', `AUDIO  measured ${m.lufs} LUFS / ${m.truePeak} dBTP → gain ${m.gainDb.toFixed(2)} dB → ${m.out.lufs} LUFS / ${m.out.truePeak} dBTP`);
    console.log(`  reel → ${out} (${m.out.lufs} LUFS)`);
    if (!flag('skip-qa')) {
      const r = spawnSync('npx', ['tsx', 'scripts/lib/video-frames.ts', item.reel.id, out, path.join(dir, 'qa', 'cuts')], { cwd: REELS_ROOT, encoding: 'utf8' });
      if (r.status !== 0) console.warn(r.stderr);
    }
  }
  if (!flag('skip-qa')) {
    const frames = tl.shots.flatMap((s) => [0.15, 0.55, 0.92].map((k) => ({ frame: s.start + Math.min(s.duration - 1, Math.round(s.duration * k)), label: `${s.beat}@${Math.round(k * 100)}` })));
    const files = await stills('Content', { spec: item.reel, format: 'reel' }, frames.map((f) => f.frame), (f) => path.join(dir, 'qa', 'beats', `${String(f).padStart(4, '0')}.png`));
    await contactSheet(files.map((file, i) => ({ file, label: `${frames[i].frame} ${frames[i].label}` })), path.join(dir, 'qa', 'beats.png'), 6, 180);
    const [first] = await stills('Content', { spec: item.reel, format: 'reel' }, [0], () => path.join(dir, 'qa', 'first-frame.png'));
    report.push('', `first frame → ${path.relative(dir, first)}`);
  }
  if (!flag('skip-poster')) {
    const out = path.join(dir, 'post.png');
    await renderPoster(POSTERS[item.poster], out);
    console.log(`  post → ${out}`);
  }
  writeFileSync(path.join(dir, 'qa', 'report.txt'), report.join('\n') + '\n');
}
process.exit(0);
