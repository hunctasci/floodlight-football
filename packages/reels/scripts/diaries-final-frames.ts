#!/usr/bin/env tsx
/** Render a single Remotion diary shot to lossless PNG frames at a delivery fps. */
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { EPISODES, timeline } from '../src/diaries/edit.ts';
import { stills } from './lib/remotion.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const episode = arg('episode')!;
const shotId = arg('shot')!;
const out = path.resolve(arg('out')!);
const fps = Number(arg('fps') ?? 60);
const quality = arg('quality') ?? 'final60';
const shots = timeline(EPISODES[episode].edit, fps).shots;
const shot = shots.find(s => s.id === shotId);
if (!shot) throw new Error(`unknown shot ${shotId}`);
mkdirSync(out, { recursive: true });
await stills('PlayerDiaries', { episode, quality, captions: true, audio: false, deliveryFps: fps }, Array.from({ length: shot.frames }, (_, i) => shot.from + i), (frame) => path.join(out, `${String(frame - shot.from + 1).padStart(4, '0')}.png`));
