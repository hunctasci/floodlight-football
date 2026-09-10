#!/usr/bin/env tsx
/**
 * `social:frames` CLI — render a full deterministic PNG sequence.
 *
 *   npm run social:frames -- --home TR --away GR --scene faceoff \
 *     --output social/output/tr-vs-gr-faceoff/
 *
 * One reused browser session renders every frame random-access
 * (time = frame / fps) into 000000.png ... NNNNNN.png. Previously generated
 * frame PNGs in the directory are cleared first; other files are kept.
 */
import { resolveVideoSpec, resolveTrailerSpec, SocialSpecError } from '../src/schema';
import { renderFramesToDir, renderTemplateFramesToDir, renderTrailerFramesToDir } from '../src/render/frame';
import { compileTemplate } from '../src/templates/compile';
import { compileTrailer } from '../src/trailers/compile';
import { argStr, outputFromArgs, readArgs, specInputFromArgs, trailerInputFromArgs } from './cli-args';

function usage(): string {
  return [
    'Usage: social:frames --home <CODE> --away <CODE> [--scene faceoff|attack-goal] [--template country-rivalry-reel] [--trailer world-league-hero --countries TR,GR,BR,AR,DE,FR] [--format reel] [--seed 42] [--fps 30] [--duration <sec>] [--attack-team home|away] [--attack-style central|wing|counter] [--headline <text>] [--secondary <text>] [--cta <text>] [--no-overlays] --output <dir/>',
    '',
    'Examples:',
    '  npm run social:frames -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff/',
    '  npm run social:frames -- --home TR --away GR --scene attack-goal --output social/output/tr-vs-gr-goal/',
    '  npm run social:frames -- --trailer world-league-hero --countries TR,GR,BR,AR,DE,FR --seed 42 --output social/output/trailer-frames/',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
    'Defaults: scene=faceoff format=reel seed=42 fps=30 duration=4 (faceoff) or 6 (attack-goal) overlays=default.',
    'Trailer defaults: fps=60 duration=17.6 (world-league-hero).',
    'Copy flags are plain text (max 48/80/48 chars for headline/secondary/cta); --no-overlays renders clean 3D.',
  ].join('\n');
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  if (args.get('help') === true || args.get('h') === true) {
    console.log(usage());
    return;
  }
  const trailerRaw = argStr(args, 'trailer');
  if (trailerRaw !== undefined) {
    let trl;
    try {
      trl = compileTrailer(trailerInputFromArgs(args));
    } catch (error) {
      console.error(error instanceof SocialSpecError ? error.message : String(error));
      console.error(usage());
      process.exitCode = 1;
      return;
    }
    const output = outputFromArgs(args);
    if (!output) {
      console.error('Missing required --output <dir/> (e.g. --output social/output/trailer-frames/)');
      console.error(usage());
      process.exitCode = 1;
      return;
    }
    try {
      console.log(`Rendering ${trl.totalFrames} frames`);
      console.log(`Trailer: ${trl.trailer}`);
      console.log(`${trl.countries.join(',')}`);
      console.log(`${trl.width}x${trl.height}`);
      console.log(`${trl.fps} FPS`);
      console.log(`${trl.duration.toFixed(2)} sec`);
      console.log('');
      const result = await renderTrailerFramesToDir(trl, output, ({ frame, totalFrames }) => {
        console.log(`[${frame + 1}/${totalFrames}]`);
      });
      console.log('');
      console.log('Wrote:');
      console.log(result.dir);
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
  const output = outputFromArgs(args);
  if (!output) {
    console.error('Missing required --output <dir/> (e.g. --output social/output/tr-vs-gr-faceoff/)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const tpl = video.template !== undefined ? compileTemplate(specInputFromArgs(args)) : null;
  const totalFrames = tpl?.totalFrames ?? video.totalFrames;
  try {
    console.log(`Rendering ${totalFrames} frames`);
    if (tpl !== null) console.log(`Template: ${tpl.template}`);
    else console.log(`Scene: ${video.scene}`);
    console.log(`${video.home} vs ${video.away}`);
    console.log(`${video.width}x${video.height}`);
    console.log(`${video.fps} FPS`);
    console.log(`${(tpl?.duration ?? video.duration).toFixed(2)} sec`);
    console.log('');
    const result = tpl !== null
      ? await renderTemplateFramesToDir(tpl, output, ({ frame, totalFrames }) => {
        console.log(`[${frame + 1}/${totalFrames}]`);
      })
      : await renderFramesToDir(video, output, ({ frame, totalFrames }) => {
        console.log(`[${frame + 1}/${totalFrames}]`);
      });
    console.log('');
    console.log('Wrote:');
    console.log(result.dir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
