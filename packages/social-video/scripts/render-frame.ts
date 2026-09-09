#!/usr/bin/env tsx
/**
 * `social:frame` CLI — the AI-agent interface to HNC social frames.
 *
 *   npm run social:frame -- --home TR --away GR --scene faceoff \
 *     --output social/output/tr-vs-gr-faceoff.png
 *
 * Semantic args only (scene, country codes, seed). Three.js coordinates live
 * inside scene presets. Exits non-zero with a plain-English error on bad input.
 */
import { resolveSpec, SocialSpecError } from '../src/schema';
import { renderFrameToPng } from '../src/render/frame';

function usage(): string {
  return [
    'Usage: social:frame --home <CODE> --away <CODE> [--scene faceoff] [--format reel] [--seed 42] --output <png>',
    '',
    'Examples:',
    '  npm run social:frame -- --home TR --away GR --scene faceoff --output social/output/tr-vs-gr-faceoff.png',
    '  npm run social:frame -- --home BR --away AR --seed 7 --output social/output/br-vs-ar-faceoff.png',
    '',
    'Country codes come from the game\'s canonical country list (e.g. TR GR BR AR DE FR).',
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
  let spec;
  try {
    spec = resolveSpec({
      scene: str('scene'),
      home: str('home'),
      away: str('away'),
      format: str('format'),
      seed: str('seed'),
    });
  } catch (error) {
    console.error(error instanceof SocialSpecError ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify(spec));
    return;
  }
  const output = str('output') ?? str('out');
  if (!output) {
    console.error('Missing required --output <path> (e.g. --output social/output/tr-vs-gr-faceoff.png)');
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    const rendered = await renderFrameToPng(spec, output);
    console.log(`Wrote ${rendered.output} (${rendered.width}x${rendered.height}) scene=${spec.scene} home=${spec.home} away=${spec.away} seed=${spec.seed}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
