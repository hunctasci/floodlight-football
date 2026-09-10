#!/usr/bin/env tsx
/**
 * Trailer storyboard: one PNG per trailer shot (midpoint) through ONE reused
 * browser session — answers "is the trailer readable without movement?"
 * before any full MP4 render.
 *
 *   npm run social:trailer-board -- --countries TR,GR,BR,AR,DE,FR --seed 42 \
 *     --output social/output/storyboards/world-league-hero/
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { compileTrailer } from '../src/trailers/compile';
import { SocialRenderSession } from '../src/render/session';
import { argStr, readArgs, trailerInputFromArgs } from './cli-args';

function usage(): string {
  return 'Usage: render-trailer-storyboard --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR [--seed 42] [--fps 60] [--output dir]';
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  const input = trailerInputFromArgs(args);
  if (input.trailer === undefined || input.countries === undefined) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const trl = compileTrailer(input);
  const outDir = path.resolve(argStr(args, 'output') ?? `social/output/storyboards/${trl.trailer}/`);
  mkdirSync(outDir, { recursive: true });
  const session = await SocialRenderSession.openTrailer(trl);
  try {
    for (const s of trl.shots) {
      const t = (s.start + s.end) / 2;
      const frame = Math.min(trl.totalFrames - 1, Math.round(t * trl.fps));
      const file = `${s.id}.png`;
      await session.screenshotFrame(frame, path.join(outDir, file));
      console.log(`${file}  t=${t.toFixed(2)}s  frame=${frame}  cam=${s.camera}  src=${s.source}[${s.srcStart.toFixed(2)}-${s.srcEnd.toFixed(2)}]`);
    }
  } finally {
    await session.close();
  }
  console.log(`\nStoryboard: ${outDir} (${trl.shots.length} shots)`);
}

void main();
