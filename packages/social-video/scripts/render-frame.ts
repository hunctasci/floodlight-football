#!/usr/bin/env tsx
/**
 * `social:frame` CLI — render ONE deterministic timeline frame.
 *
 *   npm run social:frame -- --home TR --away GR --scene faceoff \
 *     --frame 75 --output social/output/frame-75.png
 *
 * The frame index is a random-access timeline position (time = frame / fps):
 * no sequence render is needed to inspect a single frame. Semantic args
 * only; Three.js coordinates live inside scene presets.
 */
import { parseFrameIndex, resolveVideoSpec, SocialSpecError } from '../src/schema';
import { renderFrameToPng } from '../src/render/frame';

function usage(): string {
  return [
    'Usage: social:frame --home <CODE> --away <CODE> [--scene faceoff|attack-goal] [--format reel] [--seed 42] [--fps 30] [--duration <sec>] [--attack-team home|away] [--attack-style central|wing|counter] [--frame 0] --output <png>',
    '',
    'Examples:',
    '  npm run social:frame -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff.png',
    '  npm run social:frame -- --home TR --away GR --frame 75 --output social/output/frame-75.png',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
    'Defaults: scene=faceoff format=reel seed=42 fps=30 duration=4 (faceoff) or 6 (attack-goal) frame=0.',
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
  const dryRun = args.get('dry-run') === true || args.get('dryRun') === true;
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
  let frame = 0;
  try {
    const raw = str('frame');
    frame = raw === undefined ? 0 : parseFrameIndex(raw, video.totalFrames, video.fps, video.duration);
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify({ ...video, frame, time: frame / video.fps }));
    return;
  }
  const output = str('output') ?? str('out');
  if (!output) {
    console.error('Missing required --output <path> (e.g. --output social/output/frame-75.png)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    const rendered = await renderFrameToPng(video, output, frame);
    console.log(`Wrote ${rendered.output} (${rendered.width}x${rendered.height}) scene=${video.scene} home=${video.home} away=${video.away} seed=${video.seed} frame=${frame}/${video.totalFrames} t=${(frame / video.fps).toFixed(3)}s`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
