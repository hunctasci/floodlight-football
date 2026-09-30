#!/usr/bin/env tsx
/**
 * blender:plates — render Blender plates (hybrid shots) for a Reel Factory piece.
 *
 *   npm run blender:plates -- --spec the-current                       all plates, final quality
 *   npm run blender:plates -- --spec the-current --only current-eye    one plate
 *   [--preview]            50 % resolution, 16 samples, no motion blur (lookdev)
 *   [--frames 1-24]        a frame range   [--stills 1,48,96] single frames
 *   [--bake-only]          write pose tracks, skip Blender   [--save-blend] keep a .blend per plate
 *
 * 1. pose tracks: the canonical choreography/poses → social/blender/generated/poses/<plate>.json
 * 2. Blender headless (hnc_cli.py plate) builds the plate scene from generated GLBs + the
 *    track, verifies every imported identity + the reproduced pose, and renders PNGs to
 *    packages/reels/public/generated/plates/<plate>/0001.png… (the `plate` world reads them).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bakePlate, type PlateSpec } from './src/pose-track.ts';
import { THE_CURRENT_PLATES } from './src/plates/the-current.ts';
import { GENERATED, PY_CLI, REPO_ROOT, blenderVersion, findBlender, insideRepo, rel } from './src/paths.ts';

const SPECS: Record<string, PlateSpec[]> = { 'the-current': THE_CURRENT_PLATES };
const PLATES_OUT = path.join(REPO_ROOT, 'packages/reels/public/generated/plates');

const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const flag = (k: string): boolean => argv.includes(`--${k}`);

const plates = SPECS[arg('spec') ?? ''];
if (!plates) throw new Error(`--spec must be one of: ${Object.keys(SPECS).join(', ')}`);
const only = arg('only')?.split(',');
const todo = plates.filter((p) => !only || only.includes(p.id));
if (only && todo.length !== only.length) throw new Error(`unknown plate in --only (have: ${plates.map((p) => p.id).join(', ')})`);

const bin = flag('bake-only') ? '' : findBlender();
if (bin) console.log(`blender ${blenderVersion(bin)}`);
let failed = 0;
for (const spec of todo) {
  const track = bakePlate(spec);
  const trackFile = insideRepo(path.join(GENERATED, 'poses', `${spec.id}.json`));
  mkdirSync(path.dirname(trackFile), { recursive: true });
  writeFileSync(trackFile, JSON.stringify(track));
  console.log(`${spec.id}: pose track → ${rel(trackFile)} (${track.frames} f, ${track.actors.length} actor(s)${track.ball ? ' + ball' : ''})`);
  if (!bin) continue;
  const out = insideRepo(path.join(PLATES_OUT, arg('out-name') ?? spec.id));
  mkdirSync(out, { recursive: true });
  const extra = [
    ...(flag('preview') ? ['--preview'] : []),
    ...(arg('frames') ? ['--frames', arg('frames')!] : []),
    ...(arg('stills') ? ['--stills', arg('stills')!] : []),
    ...(flag('save-blend') ? ['--save-blend'] : []),
    ...(arg('cycles') ? ['--hero-samples', arg('cycles')!, '--cycles-device', 'METAL'] : []),
  ];
  const t0 = performance.now();
  const r = spawnSync(bin, ['-b', '--factory-startup', '--python-exit-code', '1', '--python', PY_CLI, '--', 'plate', '--track', trackFile, '--out', out, ...extra], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const log = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const result = log.split('\n').reverse().find((l) => l.startsWith('HNC_RESULT '));
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  if (r.status !== 0 || !result) {
    failed++;
    console.error(`${spec.id}: FAILED after ${secs}s\n${log.split('\n').slice(-40).join('\n')}`);
    continue;
  }
  console.log(`${spec.id}: ${result.slice('HNC_RESULT '.length)} (${secs}s)`);
}
process.exit(failed ? 1 : 0);
