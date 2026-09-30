import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const rel = (p: string): string => path.relative(REPO_ROOT, p).split(path.sep).join('/');

/** SOURCE lives in tools/blender; GENERATED + OUTPUT live in the social/blender workspace. */
export const WORKSPACE = path.join(REPO_ROOT, 'social/blender');
export const GENERATED = path.join(WORKSPACE, 'generated');
export const MANIFEST = path.join(GENERATED, 'manifest.json');
export const VERIFICATION = path.join(WORKSPACE, 'verification');
export const PY_CLI = path.join(REPO_ROOT, 'tools/blender/py/hnc_cli.py');

/** Canonical files whose content defines the exported assets (drift detection). */
export const CANONICAL_SOURCES = [
  'packages/hnc-visuals/src/player/create-player.ts',
  'packages/hnc-visuals/src/player/types.ts',
  'packages/hnc-visuals/src/player/number-texture.ts',
  'packages/hnc-visuals/src/ball/create-ball.ts',
  'packages/hnc-visuals/src/ball/ball-texture.ts',
  'packages/hnc-visuals/src/stadium/create-goals.ts',
  'apps/game/src/city-league/countries.ts',
  'apps/game/src/city-league/country-colors.ts',
  'tools/blender/src/interchange.ts',
  'tools/blender/src/browser-entry.ts',
] as const;

/** Refuse to write anywhere outside the repository (Blender automation safety rule). */
export function insideRepo(p: string): string {
  const abs = path.resolve(p);
  if (abs !== REPO_ROOT && !abs.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`Refusing path outside the HNC repository: ${abs}`);
  }
  return abs;
}

/**
 * Blender executable discovery — no machine path is committed:
 * 1. HNC_BLENDER_BIN (or BLENDER_PATH, the variable the Blender Lab MCP uses)
 * 2. the standard macOS app bundle
 * 3. `blender` on PATH
 */
export function findBlender(): string {
  const fromEnv = process.env.HNC_BLENDER_BIN ?? process.env.BLENDER_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`HNC_BLENDER_BIN points to a missing file: ${fromEnv}`);
    return fromEnv;
  }
  const mac = '/Applications/Blender.app/Contents/MacOS/Blender';
  if (process.platform === 'darwin' && existsSync(mac)) return mac;
  try {
    return execFileSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' })
      .split('\n')[0]
      .trim();
  } catch {
    throw new Error('Blender not found. Install Blender 5.1+ or set HNC_BLENDER_BIN=/path/to/blender.');
  }
}

/** Blender "major.minor" — the pipeline is verified on 5.2 LTS and requires 5.1+. */
export function blenderVersion(bin: string): string {
  const out = execFileSync(bin, ['--version'], { encoding: 'utf8' });
  const m = /Blender (\d+)\.(\d+)(\.\d+)?( LTS)?/.exec(out);
  if (!m) throw new Error(`Cannot parse Blender version from: ${out.split('\n')[0]}`);
  if (Number(m[1]) < 5 || (Number(m[1]) === 5 && Number(m[2]) < 1)) {
    throw new Error(`Blender ${m[0]} is too old: the HNC pipeline needs 5.1+ (5.2 LTS verified).`);
  }
  return m[0].replace('Blender ', '');
}
