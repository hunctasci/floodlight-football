#!/usr/bin/env tsx
/**
 * `social:frame` CLI — render ONE deterministic timeline frame.
 *
 *   npm run social:frame -- --home TR --away GR --scene faceoff \
 *     --frame 75 --output social/output/frame-75.png
 *
 *   npm run social:frame -- --trailer world-league-hero \
 *     --countries TR,GR,BR,AR,DE,FR --frame 90 \
 *     --output social/output/trailer-90.png
 *
 * The frame index is a random-access timeline position (time = frame / fps):
 * no sequence render is needed to inspect a single frame. Semantic args
 * only; Three.js coordinates live inside scene presets.
 */
import { parseFrameIndex, resolveVideoSpec, resolveTrailerSpec, SocialSpecError } from '../src/schema';
import { renderFrameToPng, renderTemplateFrameToPng, renderTrailerFrameToPng } from '../src/render/frame';
import { compileTemplate } from '../src/templates/compile';
import { compileTrailer } from '../src/trailers/compile';
import { argStr, outputFromArgs, readArgs, specInputFromArgs, trailerInputFromArgs } from './cli-args';

function usage(): string {
  return [
    'Usage: social:frame --home <CODE> --away <CODE> [--scene faceoff|attack-goal] [--template country-rivalry-reel] [--trailer world-league-hero --countries TR,GR,BR,AR,DE,FR] [--format reel] [--seed 42] [--fps 30] [--duration <sec>] [--attack-team home|away] [--attack-style central|wing|counter] [--headline <text>] [--secondary <text>] [--cta <text>] [--no-overlays] [--frame 0] --output <png>',
    '',
    'Examples:',
    '  npm run social:frame -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff.png',
    '  npm run social:frame -- --home TR --away GR --frame 75 --output social/output/frame-75.png',
    '  npm run social:frame -- --scene attack-goal --home TR --away GR --headline "ONE WIN FROM #1" --cta "PLAY FOR TÜRKİYE" --frame 170 --output social/output/preview.png',
    '  npm run social:frame -- --scene faceoff --home TR --away GR --no-overlays --output social/output/clean-3d.png',
    '  npm run social:frame -- --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR --seed 42 --frame 90 --output social/output/trailer-90.png',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
    'Defaults: scene=faceoff format=reel seed=42 fps=30 duration=4 (faceoff) or 6 (attack-goal) frame=0 overlays=default.',
    'Trailer defaults: fps=60 duration=17.6 (world-league-hero). Copy flags are plain text (max 48/80/48 chars for headline/secondary/cta); --no-overlays renders clean 3D.',
  ].join('\n');
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  if (args.get('help') === true || args.get('h') === true) {
    console.log(usage());
    return;
  }
  const dryRun = args.get('dry-run') === true || args.get('dryRun') === true;
  const trailerRaw = argStr(args, 'trailer');
  if (trailerRaw !== undefined) {
    let resolved;
    try {
      resolved = resolveTrailerSpec(trailerInputFromArgs(args));
    } catch (error) {
      console.error(error instanceof SocialSpecError ? error.message : String(error));
      console.error(usage());
      process.exitCode = 1;
      return;
    }
    const trl = compileTrailer(trailerInputFromArgs(args));
    let frame = 0;
    try {
      const raw = argStr(args, 'frame');
      frame = raw === undefined ? 0 : parseFrameIndex(raw, trl.totalFrames, trl.fps, trl.duration);
    } catch (error) {
      console.error(error instanceof SocialSpecError ? error.message : String(error));
      console.error(usage());
      process.exitCode = 1;
      return;
    }
    if (dryRun) {
      console.log(JSON.stringify({ ...resolved, frame, time: frame / trl.fps }));
      return;
    }
    const output = outputFromArgs(args);
    if (!output) {
      console.error('Missing required --output <path> (e.g. --output social/output/frame-75.png)');
      console.error(usage());
      process.exitCode = 1;
      return;
    }
    try {
      const rendered = await renderTrailerFrameToPng(trl, output, frame);
      console.log(`Wrote ${rendered.output} (${rendered.width}x${rendered.height}) trailer=${trl.trailer} countries=${trl.countries.join(',')} seed=${trl.seed} frame=${frame}/${trl.totalFrames} t=${(frame / trl.fps).toFixed(3)}s`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }
  let video;
  try {
    video = resolveVideoSpec(specInputFromArgs(args));
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const tpl = video.template !== undefined ? compileTemplate(specInputFromArgs(args)) : null;
  const totalFrames = tpl?.totalFrames ?? video.totalFrames;
  const fps = tpl?.fps ?? video.fps;
  const duration = tpl?.duration ?? video.duration;
  let frame = 0;
  try {
    const raw = argStr(args, 'frame');
    frame = raw === undefined ? 0 : parseFrameIndex(raw, totalFrames, fps, duration);
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify({ ...video, frame, time: frame / fps }));
    return;
  }
  const output = outputFromArgs(args);
  if (!output) {
    console.error('Missing required --output <path> (e.g. --output social/output/frame-75.png)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    const rendered = tpl !== null
      ? await renderTemplateFrameToPng(tpl, output, frame)
      : await renderFrameToPng(video, output, frame);
    const what = tpl !== null ? `template=${tpl.template}` : `scene=${video.scene}`;
    console.log(`Wrote ${rendered.output} (${rendered.width}x${rendered.height}) ${what} home=${video.home} away=${video.away} seed=${video.seed} frame=${frame}/${totalFrames} t=${(frame / fps).toFixed(3)}s`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
