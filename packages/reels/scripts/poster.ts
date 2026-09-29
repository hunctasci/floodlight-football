#!/usr/bin/env tsx
/**
 * reels:poster — render key-art posters (PosterDef): plates (key-art specs
 * rendered at 1080×1920 and cropped), a screen-space grade, and the
 * typography layer (PosterType, transparent), composited with sharp.
 *   npm run reels:poster -- --poster autumn-01-poster [--output post.png]
 *   npm run reels:poster -- --poster all            (every registered poster → campaign dirs)
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { compileContent } from '../src/engine/director/compile';
import { resolveAt } from '../src/engine/spec/timing';
import { POSTERS, posterOutput } from '../src/content/autumn-2026/posters';
import type { PosterDef } from '../src/posters/types';
import { arg } from './lib/args';
import { stills } from './lib/remotion';

const tmp = path.resolve('social/output/.poster-plates');

function frameOf(p: PosterDef['plates'][number]): number {
  const tl = compileContent(p.spec, { format: 'reel' });
  const beats = new Map(tl.shots.map((s) => [s.beat, { id: s.beat, start: s.start, duration: s.duration }]));
  return resolveAt(p.at, { fps: tl.fps, beat: { id: '_', start: 0, duration: tl.totalFrames }, beats });
}

function gradeSvg(W: number, H: number, g: NonNullable<PosterDef['grade']>): Buffer {
  const parts: string[] = [];
  if (g.tint) parts.push(`<rect width="${W}" height="${H}" fill="${g.tint}" fill-opacity="${g.tintAlpha ?? 0.2}"/>`);
  if (g.gradientBottom) parts.push(`<rect width="${W}" height="${H}" fill="url(#gb)"/>`);
  if (g.gradientTop) parts.push(`<rect width="${W}" height="${H}" fill="url(#gt)"/>`);
  if (g.vignette) parts.push(`<rect width="${W}" height="${H}" fill="url(#v)"/>`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="v" cx="50%" cy="46%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${g.vignette ?? 0}"/></radialGradient>
      <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#05070c" stop-opacity="${g.gradientBottom ?? 0}"/></linearGradient>
      <linearGradient id="gt" x1="0" y1="1" x2="0" y2="0"><stop offset="65%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#05070c" stop-opacity="${g.gradientTop ?? 0}"/></linearGradient>
    </defs>${parts.join('')}</svg>`);
}

export async function renderPoster(poster: PosterDef, output: string): Promise<string> {
  const W = poster.width ?? 1080;
  const H = poster.height ?? 1350;
  const layers: OverlayOptions[] = [];
  for (const [i, plate] of poster.plates.entries()) {
    const frame = frameOf(plate);
    const [file] = await stills('Content', { spec: plate.spec, format: 'reel' }, [frame], () => path.join(tmp, poster.id, `plate-${i}.png`));
    const rect = plate.rect ?? { x: 0, y: 0, w: W, h: H };
    const cw = plate.crop?.w ?? 1080;
    const ch = plate.crop?.h ?? Math.round((cw * rect.h) / rect.w);
    const img = await sharp(file)
      .extract({ left: plate.crop?.x ?? 0, top: Math.max(0, Math.min(1920 - ch, plate.crop?.y ?? Math.round((1920 - ch) / 2))), width: cw, height: ch })
      .resize(rect.w, rect.h)
      .png()
      .toBuffer();
    layers.push({ input: img, left: rect.x, top: rect.y });
  }
  if (poster.grade) layers.push({ input: gradeSvg(W, H, poster.grade), left: 0, top: 0 });
  const [typeFile] = await stills('PosterType', { poster }, [0], () => path.join(tmp, poster.id, 'type.png'));
  layers.push({ input: typeFile, left: 0, top: 0 });
  mkdirSync(path.dirname(output), { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 4, background: poster.background ?? '#05070c' } }).composite(layers).flatten({ background: poster.background ?? '#05070c' }).png().toFile(output);
  return output;
}

async function main(): Promise<void> {
  const want = arg('poster');
  if (!want) throw new Error(`--poster is required (${Object.keys(POSTERS).join(', ')}, or all)`);
  const ids = want === 'all' ? Object.keys(POSTERS) : [want];
  for (const id of ids) {
    const poster = POSTERS[id];
    if (!poster) throw new Error(`Unknown poster "${id}" (${Object.keys(POSTERS).join(', ')})`);
    const out = path.resolve(ids.length === 1 && arg('output') ? arg('output')! : posterOutput(id));
    await renderPoster(poster, out);
    console.log(`${id} → ${out}`);
  }
  process.exit(0);
}

// CLI only when run directly (campaign.ts imports renderPoster).
if (process.argv[1]?.endsWith('poster.ts')) await main();
