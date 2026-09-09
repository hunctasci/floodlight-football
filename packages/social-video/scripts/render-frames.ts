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
import { resolveVideoSpec, SocialSpecError } from '../src/schema';
import { renderFramesToDir } from '../src/render/frame';

function usage(): string {
  return [
    'Usage: social:frames --home <CODE> --away <CODE> [--scene faceoff|attack-goal] [--format reel] [--seed 42] [--fps 30] [--duration <sec>] [--attack-team home|away] [--attack-style central|wing|counter] --output <dir/>',
    '',
    'Examples:',
    '  npm run social:frames -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff/',
    '  npm run social:frames -- --home TR --away GR --scene attack-goal --output social/output/tr-vs-gr-goal/',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
    'Defaults: scene=faceoff format=reel seed=42 fps=30 duration=4 (faceoff) or 6 (attack-goal).',
  ].join('\n');
}

function readArgs(argv: string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq >= 0) {
      out.set(token.slice(2, eq), token.slice(eq + 1));
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      out.set(token.slice(2), argv[++i]);
    } else {
      out.set(token.slice(2), true);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = readArgs(process.argv.slice(2));
  if (args.get('help') === true || args.get('h') === true) {
    console.log(usage());
    return;
  }
  const str = (name: string): string | undefined => {
    const v = args.get(name);
    return typeof v === 'string' ? v : undefined;
  };
  let video;
  try {
    video = resolveVideoSpec({
      scene: str('scene'),
      home: str('home'),
      away: str('away'),
      format: str('format'),
      seed: str('seed'),
      fps: str('fps'),
      duration: str('duration'),
      attackTeam: str('attack-team') ?? str('attackTeam'),
      attackStyle: str('attack-style') ?? str('attackStyle'),
    });
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const output = str('output') ?? str('out');
  if (!output) {
    console.error('Missing required --output <dir/> (e.g. --output social/output/tr-vs-gr-faceoff/)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    console.log(`Rendering ${video.totalFrames} frames`);
    console.log(`${video.home} vs ${video.away}`);
    console.log(`${video.width}x${video.height}`);
    console.log(`${video.fps} FPS`);
    console.log(`${video.duration.toFixed(2)} sec`);
    console.log('');
    const result = await renderFramesToDir(video, output, ({ frame, totalFrames }) => {
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
