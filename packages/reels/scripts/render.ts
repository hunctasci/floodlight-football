#!/usr/bin/env tsx
/**
 * reels:render — semantic CLI. Agents pass template + countries + seed;
 * the compiler owns cameras/anchors/transitions. Renders 1080x1920 MP4
 * (H.264 + AAC) via the Remotion CLI (which owns FFmpeg/encoding).
 *
 * Examples:
 *   npm run reels:render -- --template office-rivalry --home TR --away GR --seed 42 --football-moment crossbar-chaos --output social/output/tr-gr-office.mp4
 *   npm run reels:render -- --template country-rivalry --home TR --away GR --seed 42 --output social/output/tr-gr.mp4
 *   npm run reels:render -- --template hnc-hero --home TR --away GR --seed 42 --output social/output/hnc-hero.mp4
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTemplateInput } from '../src/reel/schema';
import { compileStory } from '../src/director/compile-story';
import { assertValidProductionReel } from '../src/reel/validate';
import { compileSfxEvents, sfxStemPath } from '../src/audio/sfx';
import { renderSfxStem } from '../src/audio/sfx-stem';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

function main(): void {
  const template = arg('template', 'office-rivalry');
  const home = arg('home', 'TR');
  const away = arg('away', 'GR');
  const seed = arg('seed', '42');
  const fps = arg('fps');
  const footballMoment = arg('football-moment') ?? arg('footballMoment', 'crossbar-chaos');
  const headline = arg('headline');
  const cta = arg('cta');
  const output = arg('output', `social/output/reel-${Date.now()}.mp4`);
  const compOverride = arg('composition');

  const input = parseTemplateInput({
    template,
    home,
    away,
    seed: Number(seed),
    fps: fps === undefined ? undefined : Number(fps),
    footballMoment,
    headline,
    cta,
  });
  const { spec, plan } = compileStory(input);
  assertValidProductionReel(spec, plan);

  const COMPOSITIONS: Record<string, string> = {
    'office-rivalry': 'OfficeRivalry',
    'country-rivalry': 'CountryRivalry',
    'hnc-hero': 'HncHeroReel',
  };
  const composition = compOverride ?? COMPOSITIONS[input.template];
  // Procedural cues -> one deterministic SFX stem (game arcade synth recipes).
  let sfx: string | undefined;
  if (spec.audio?.sfxStem) {
    sfx = sfxStemPath(spec.id);
    const file = path.join(root, 'public', sfx);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, renderSfxStem(plan, spec.seed));
    // eslint-disable-next-line no-console
    console.log(`SFX stem: ${compileSfxEvents(plan).length} events -> public/${sfx}`);
  }
  const props = JSON.stringify({
    ...(sfx ? { sfx } : {}),
    home: input.home,
    away: input.away,
    seed: input.seed,
    footballMoment: input.footballMoment,
    ...(headline ? { headline } : {}),
    ...(cta ? { cta } : {}),
  });
  const entry = path.join(root, 'src/entry.tsx');
  // eslint-disable-next-line no-console
  console.log(`Rendering ${composition} ${home} vs ${away} (seed ${input.seed}) -> ${output}`);
  // eslint-disable-next-line no-console
  console.log(`Spec: ${spec.id} | ${plan.totalFrames} frames @ ${spec.fps}fps | ${spec.durationInSeconds}s`);
  const res = spawnSync(
    'npx',
    ['remotion', 'render', entry, composition, path.resolve(String(output)), '--props', props, '--codec', 'h264', '--audio-codec', 'aac'],
    { stdio: 'inherit', cwd: root },
  );
  if (res.status !== 0) process.exit(res.status ?? 1);
}

main();
