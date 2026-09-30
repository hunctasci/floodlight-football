#!/usr/bin/env tsx
/**
 * Blender-side commands (headless, no GUI, no MCP needed):
 *   build        rebuild verification/hnc-parity.blend + library/hnc-cinematic-base.blend from generated GLBs
 *   verify       typecheck + interchange tests + Blender parity inspection (non-destructive)
 *   render-test  render ONE frame of hnc-parity.blend via plain `blender -b … -f 1` [--cycles]
 *
 * Blender is discovered via HNC_BLENDER_BIN → macOS app bundle → PATH (src/paths.ts).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pngSize } from './src/glb.ts';
import { MANIFEST, PY_CLI, REPO_ROOT, VERIFICATION, blenderVersion, findBlender, insideRepo, rel } from './src/paths.ts';

const PARITY_BLEND = path.join(VERIFICATION, 'hnc-parity.blend');

function run(cmd: string, args: string[]): { code: number; seconds: number; stdout: string } {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const stdout = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { code: r.status ?? 1, seconds: Math.round(performance.now() - t0) / 1000, stdout };
}

/** Last `HNC_RESULT {json}` line printed by hnc_cli.py. */
function hncResult(stdout: string): Record<string, unknown> | null {
  const line = stdout.split('\n').reverse().find((l) => l.startsWith('HNC_RESULT '));
  return line ? JSON.parse(line.slice('HNC_RESULT '.length)) : null;
}

function blender(args: string[]): { code: number; seconds: number; stdout: string } {
  const bin = findBlender();
  console.log(`blender ${blenderVersion(bin)} — ${args.join(' ')}`);
  return run(bin, args);
}

function requireManifest(): void {
  if (!existsSync(MANIFEST)) throw new Error('No generated assets: run `npm run blender:export` first.');
}

function build(): number {
  requireManifest();
  const r = blender(['-b', '--factory-startup', '--python-exit-code', '1', '--python', PY_CLI, '--', 'build']);
  const result = hncResult(r.stdout);
  console.log(result ? JSON.stringify(result, null, 2) : r.stdout);
  return r.code;
}

function verify(): number {
  const steps: [string, () => { code: number; stdout: string }][] = [
    ['typecheck tools/blender', () => run('npx', ['tsc', '-p', 'tools/blender/tsconfig.json'])],
    ['interchange tests', () => run('npx', ['tsx', '--test', 'tools/blender/tests/interchange.test.ts'])],
    ['blender parity inspection', () => {
      requireManifest();
      // Inspect the saved verification file when present (also proves it is not stale),
      // otherwise import the generated GLBs into an empty in-memory scene.
      const file = existsSync(PARITY_BLEND) ? [PARITY_BLEND] : ['--factory-startup'];
      const r = blender(['-b', ...file, '--python-exit-code', '1', '--python', PY_CLI, '--', 'inspect']);
      const result = hncResult(r.stdout);
      return { code: r.code, stdout: result ? JSON.stringify(result, null, 2) : r.stdout };
    }],
  ];
  let failed = 0;
  for (const [name, step] of steps) {
    const r = step();
    console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${name}`);
    if (r.code !== 0 || name === 'blender parity inspection') console.log(r.stdout.trim().split('\n').slice(-25).join('\n'));
    if (r.code !== 0) failed++;
  }
  return failed ? 1 : 0;
}

function renderTest(cycles: boolean): number {
  if (!existsSync(PARITY_BLEND)) throw new Error('No verification scene: run `npm run blender:build` first.');
  const outDir = insideRepo(path.join(VERIFICATION, 'renders'));
  mkdirSync(outDir, { recursive: true });
  const stem = cycles ? 'headless-cycles-' : 'headless-eevee-';
  // The saved default (cinematic portrait, EEVEE daily preset) is rendered as-is —
  // exactly what an unattended daily job would do.
  const args = ['-b', PARITY_BLEND];
  if (cycles) {
    // Hero preset check, kept cheap: 50% resolution, 64 samples, Metal via CLI (no preference edits).
    args.push('-E', 'CYCLES', '--python-expr', [
      'import bpy; s=bpy.context.scene; s.render.resolution_percentage=50; s.cycles.samples=64',
      "p=bpy.context.preferences.addons['cycles'].preferences; p.refresh_devices()",
      "print('HNC_DEVICE', p.compute_device_type, [d.name for d in p.devices if d.use])",
    ].join('\n'));
  }
  args.push('-o', path.join(outDir, `${stem}####`), '-F', 'PNG', '-f', '1');
  if (cycles) args.push('--', '--cycles-device', 'METAL');
  const r = blender(args);
  const file = path.join(outDir, `${stem}0001.png`);
  const size = existsSync(file) ? pngSize(readFileSync(file)) : null;
  // First Metal run compiles kernels (~2 min, cached); later runs take seconds.
  const device = /^HNC_DEVICE (.+)$/m.exec(r.stdout);
  const record = {
    recordedAt: new Date().toISOString(),
    command: `<blender> ${args.map((a) => (a.startsWith(REPO_ROOT) ? rel(a) : a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}`,
    exitCode: r.code,
    seconds: r.seconds,
    output: size ? rel(file) : null,
    size,
    engine: cycles ? 'CYCLES' : 'BLENDER_EEVEE',
    device: cycles ? (device ? device[1] : 'unknown') : 'EEVEE (GPU, Metal backend)',
  };
  writeFileSync(insideRepo(path.join(VERIFICATION, `${stem}render-test.json`)), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify(record, null, 2));
  if (r.code !== 0) console.log(r.stdout.split('\n').slice(-30).join('\n'));
  return r.code === 0 && size ? 0 : 1;
}

const [command, ...rest] = process.argv.slice(2);
try {
  const code =
    command === 'build' ? build()
    : command === 'verify' ? verify()
    : command === 'render-test' ? renderTest(rest.includes('--cycles'))
    : (console.error('usage: blender.ts build | verify | render-test [--cycles]'), 2);
  process.exit(code);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
