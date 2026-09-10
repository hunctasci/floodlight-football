#!/usr/bin/env tsx
/**
 * Storyboard contact sheet: one PNG per directed shot (midpoint) + hero frame.
 * Reuses the deterministic frame renderer — no UI, no new infra.
 *
 *   npx tsx packages/social-video/scripts/render-storyboard.ts \
 *     --story last-second-winner --home TR --away GR \
 *     --output social/output/storyboards/last-second-winner/
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { compileStory } from '../src/director/stories';
import type { StoryId } from '../src/director/types';
import { renderFrameToPng } from '../src/render/frame';
import { resolveVideoSpec } from '../src/schema';
import { argStr, readArgs } from './cli-args';

function usage(): string {
  return 'Usage: render-storyboard --story <id> --home <CODE> --away <CODE> [--seed N] [--output dir]';
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const story = argStr(args, 'story') as StoryId | undefined;
  const home = argStr(args, 'home');
  const away = argStr(args, 'away');
  if (!story || !home || !away) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const seedRaw = argStr(args, 'seed');
  const plan = compileStory({
    story, home, away,
    ...(seedRaw !== undefined ? { seed: Number(seedRaw) } : {}),
  });
  const outDir = path.resolve(argStr(args, 'output') ?? `social/output/storyboards/${story}/`);
  mkdirSync(outDir, { recursive: true });
  const video = resolveVideoSpec({
    scene: plan.scene, home, away, fps: plan.fps, duration: plan.duration,
    seed: plan.seed, headline: plan.headline,
  });
  // One frame per shot midpoint + hero frame: answers "is the story readable
  // without movement?" before any full MP4 render.
  const times = new Map<string, number>();
  plan.shots.forEach((s, i) => {
    times.set(`${String(i + 1).padStart(2, '0')}-${s.beat}-${s.camera}.png`, (s.start + s.end) / 2);
  });
  times.set('hero-frame.png', plan.heroFrame.time);
  for (const [file, t] of times) {
    const frame = Math.min(video.totalFrames - 1, Math.round(t * plan.fps));
    await renderFrameToPng({ ...video, headline: plan.headline }, path.join(outDir, file), frame);
    console.log(`${file}  t=${t.toFixed(2)}s  frame=${frame}`);
  }
  console.log(`\nStoryboard: ${outDir} (${times.size} frames, hero: ${plan.heroFrame.description})`);
}

void main();
