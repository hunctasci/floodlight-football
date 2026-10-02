#!/usr/bin/env tsx
/** V2 deliverables: 8 stills + contact sheet from the finished V2 mp4. */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contactSheet } from './lib/remotion.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(REPO, 'social/output/shorts/group-chat-croatia-england-v2');
const MP4 = path.join(OUT, 'group-chat-croatia-england-v2.mp4');

const STILLS: [string, number][] = [
  ['01-hook-v2.png', 0.9],
  ['02-polite-v2.png', 2.2],
  ['03-easy-win-v2.png', 3.5],
  ['04-screenshot-v2.png', 4.4],
  ['05-transition-v2.png', 6.25],
  ['06-chaos-v2.png', 9.4],
  ['07-final-message-v2.png', 11.0],
  ['08-cta-v2.png', 12.8],
];

mkdirSync(OUT, { recursive: true });
for (const [name, t] of STILLS) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', MP4, '-frames:v', '1', path.join(OUT, name)]);
  console.log(`still ${name} @${t}s`);
}
await contactSheet(
  STILLS.map(([name, t]) => ({ file: path.join(OUT, name), label: `${name} @${t}s` })),
  path.join(OUT, 'group-chat-croatia-england-v2-contact-sheet.png'),
  4,
);
console.log('contact sheet ok');

// audio deliverables next to the picture
const AUD = path.join(REPO, 'packages/reels/public/generated/shorts/group-chat-croatia-england-v2/audio');
for (const f of ['audio-mix-v2.wav', 'voice.wav', 'sfx.wav', 'room.wav', 'music.wav']) {
  const src = path.join(AUD, f);
  if (existsSync(src)) {
    const dst = path.join(OUT, f === 'audio-mix-v2.wav' ? f : f.replace('.wav', '-v2.wav'));
    copyFileSync(src, dst);
    console.log(`audio ${dst}`);
  }
}
