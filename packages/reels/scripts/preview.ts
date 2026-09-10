#!/usr/bin/env tsx
/** reels preview helper: prints keyframe checkpoints for visual QA. */
import { parseTemplateInput } from '../src/reel/schema';
import { compileStory } from '../src/director/compile-story';

const template = process.argv.includes('--template')
  ? String(process.argv[process.argv.indexOf('--template') + 1])
  : 'office-rivalry';

const { spec, plan } = compileStory(
  parseTemplateInput({ template, home: 'TR', away: 'GR', seed: 42, fps: 30, footballMoment: 'crossbar-chaos' }),
);
// eslint-disable-next-line no-console
console.log(`Reel ${spec.id}: ${plan.totalFrames} frames, ${plan.shots.length} shots`);
for (const shot of plan.shots) {
  const mid = shot.startFrame + Math.floor(shot.durationInFrames / 2);
  // eslint-disable-next-line no-console
  console.log(`- ${shot.id} stage=${shot.stage} camera=${shot.camera} frames ${shot.startFrame}..${shot.startFrame + shot.durationInFrames - 1} (mid ${mid})`);
}
// eslint-disable-next-line no-console
console.log('Suggested stills: office establish 12, side-eye 120, cloud midpoint (transition shot mid), football reveal +10, payoff -10, CTA last-10');
