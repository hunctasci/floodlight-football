#!/usr/bin/env tsx
/**
 * Remotion assembly of a Player Diaries episode (plates + cards + grain + stems).
 *   npx tsx scripts/diaries-render.ts --episode ep01 --quality animatic --out <mp4> [--review] [--clean] [--scale 0.5] [--frames 0-705]
 * Speaker captions are burned in by default (v3); --clean renders the caption-free variant.
 */
import path from 'node:path';
import { arg } from './lib/args';
import { video } from './lib/remotion';

const episode = arg('episode', 'ep01')!;
const quality = arg('quality', 'animatic')!;
const out = path.resolve(arg('out')!);
const review = process.argv.includes('--review') || quality === 'animatic';
const captions = !process.argv.includes('--clean');
const fps = Number(arg('fps', '0')) || undefined;
console.log(`PlayerDiaries ${episode} [${quality}${review ? ', review' : ''}${captions ? ', captions' : ''}] → ${out}`);
const range = arg('frames')?.split('-').map(Number) as [number, number] | undefined;
await video('PlayerDiaries', { episode, quality, review, captions, deliveryFps: fps }, out, { scale: Number(arg('scale', '1')), frameRange: range });
process.exit(0);
