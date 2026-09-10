#!/usr/bin/env tsx
/** reels:validate — compile + production-validate a Reel without rendering. */
import { parseTemplateInput } from '../src/reel/schema';
import { compileStory } from '../src/director/compile-story';
import { validateProductionReel } from '../src/reel/validate';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return fallback;
}

const input = parseTemplateInput({
  template: arg('template', 'office-rivalry'),
  home: arg('home', 'TR'),
  away: arg('away', 'GR'),
  seed: Number(arg('seed', '42')),
  fps: Number(arg('fps', '30')),
  footballMoment: arg('football-moment') ?? arg('footballMoment', 'crossbar-chaos'),
  headline: arg('headline'),
  cta: arg('cta'),
});
const { spec, plan } = compileStory(input);
const issues = validateProductionReel(spec, plan);
for (const issue of issues) {
  // eslint-disable-next-line no-console
  console.log(`[${issue.level}] ${issue.message}`);
}
if (issues.some((i) => i.level === 'error')) process.exit(1);
// eslint-disable-next-line no-console
console.log(`OK: ${spec.id} | ${plan.totalFrames} frames @ ${spec.fps}fps | ${plan.shots.length} shots`);
