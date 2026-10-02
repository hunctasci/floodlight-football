#!/usr/bin/env tsx
/** Design-exploration stills: 3 hook + 3 CTA variants over real footage. */
import { stills } from './lib/remotion.ts';

const OUT = '/tmp/gc-variants';
const variants = ['programme', 'scoreboard', 'ticket'] as const;

for (const v of variants) {
  // eslint-disable-next-line no-await-in-loop
  await stills('HNCVariantPreview', { part: 'hook', variant: v }, [32], () => `${OUT}/hook-${v}.png`);
  // eslint-disable-next-line no-await-in-loop
  await stills('HNCVariantPreview', { part: 'cta', variant: v }, [70], () => `${OUT}/cta-${v}.png`);
  console.log(`variant ${v} ok`);
}
