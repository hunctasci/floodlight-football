#!/usr/bin/env tsx
/**
 * Stills Blender needs from Remotion (hybrid shots) + the shared film-grain tile.
 *   npx tsx scripts/diaries-ui.ts --episode ep01
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { arg } from './lib/args';
import { REELS_ROOT, stills } from './lib/remotion';

const ep = arg('episode', 'ep01')!;
const ui = path.join(REELS_ROOT, 'public/generated/diaries', ep, 'ui');
mkdirSync(ui, { recursive: true });
if (ep === 'ep01') {
  await stills('DiariesPhoneUI', {}, [0], () => path.join(ui, 'world-table-phone.png'));
  await stills('DiariesMumLinksUI', {}, [0], () => path.join(ui, 'mum-links-phone.png'));
}
if (ep === 'rivals') {
  // the living-room TVs: what the two kids watched (verified scores; original HNC scoreboard)
  await stills('DiariesTVUI', { score: { home: 'Belgium', away: 'Türkiye', hs: 0, as: 2, clock: "88'", line: 'Brussels · 19.06.2000', era: 'crt' } }, [0], () => path.join(ui, 'tv-2000.png'));
}
// Deterministic grain tile (LCG noise around mid-grey; overlay-blended in the edit).
const N = 512;
const px = Buffer.alloc(N * N);
let s = 1234567;
for (let i = 0; i < px.length; i++) {
  s = (1103515245 * s + 12345) >>> 0;
  const a = (s >>> 16) / 65535;
  s = (1103515245 * s + 12345) >>> 0;
  const b = (s >>> 16) / 65535;
  px[i] = Math.max(0, Math.min(255, Math.round(128 + ((a + b) - 1) * 70)));
}
await sharp(px, { raw: { width: N, height: N, channels: 1 } }).blur(0.4).png().toFile(path.join(REELS_ROOT, 'public/generated/diaries/grain.png'));
console.log(`ui → ${path.relative(process.cwd(), ui)}; grain.png`);
process.exit(0);
