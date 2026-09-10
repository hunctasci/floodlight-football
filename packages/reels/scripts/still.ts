#!/usr/bin/env tsx
/** reels:still — render one deterministic frame (default: hero/payoff frame). */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

const composition = arg('composition', 'OfficeRivalry');
const frame = arg('frame', '200');
const output = arg('output', 'social/output/still.png');
const home = arg('home', 'TR');
const away = arg('away', 'GR');
const seed = Number(arg('seed', '42'));
const footballMoment = arg('football-moment') ?? arg('footballMoment', 'crossbar-chaos');
const props = JSON.stringify({ home, away, seed, footballMoment });
const entry = path.join(root, 'src/entry.tsx');

const res = spawnSync(
  'npx',
  ['remotion', 'still', entry, String(composition), path.resolve(String(output)), '--frame', String(frame), '--props', props],
  { stdio: 'inherit', cwd: root },
);
if (res.status !== 0) process.exit(res.status ?? 1);
