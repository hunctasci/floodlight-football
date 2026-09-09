import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveVideoSpec } from '../src/schema.ts';
import { pngDimensions } from '../src/render/png.ts';

/** Chromium availability probe: skip the browser test instead of failing CI without browsers. */
function chromiumAvailable(): boolean {
  const candidates = [
    path.join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright'),
    path.join(process.env.HOME ?? '', '.cache', 'ms-playwright'),
  ];
  return candidates.some((dir) => {
    try {
      return readdirSync(dir).some((entry) => entry.startsWith('chromium'));
    } catch {
      return false;
    }
  });
}

test('social frame renders an exact 1080x1920 PNG', { timeout: 180_000 }, async (t) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  const { renderFrameToPng } = await import('../src/render/frame.ts');
  const video = resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42 });
  const dir = path.join(tmpdir(), 'hnc-social-test');
  mkdirSync(dir, { recursive: true });
  const output = path.join(dir, 'tr-vs-gr-faceoff.png');
  const rendered = await renderFrameToPng(video, output);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1920);
  assert.ok(existsSync(output));
  const dims = pngDimensions(readFileSync(output));
  assert.deepEqual(dims, { width: 1080, height: 1920 });
});

test('browser renders a non-zero timeline frame (frame 75) at 1080x1920', { timeout: 180_000 }, async (t) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  const { renderFrameToPng } = await import('../src/render/frame.ts');
  const video = resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });
  const dir = path.join(tmpdir(), 'hnc-social-test');
  mkdirSync(dir, { recursive: true });
  const output = path.join(dir, 'frame-75.png');
  const rendered = await renderFrameToPng(video, output, 75);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1920);
  assert.ok(existsSync(output));
});

test('one reused browser session renders frames 0, 30 and 60', { timeout: 180_000 }, async (t) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  const { compileVideo } = await import('../src/timeline.ts');
  const { SocialRenderSession } = await import('../src/render/session.ts');
  const compiled = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });
  const dir = path.join(tmpdir(), 'hnc-social-test', 'session-reuse');
  mkdirSync(dir, { recursive: true });
  const session = await SocialRenderSession.open(compiled);
  try {
    for (const frame of [0, 30, 60]) {
      const out = path.join(dir, `${String(frame).padStart(6, '0')}.png`);
      const rendered = await session.screenshotFrame(frame, out);
      assert.deepEqual({ width: rendered.width, height: rendered.height }, { width: 1080, height: 1920 });
      assert.ok(existsSync(out));
    }
  } finally {
    await session.close();
  }
});

test('CLI rejects an unknown country with a useful error', () => {
  try {
    execFileSync('npx', ['tsx', 'scripts/render-frame.ts', '--dry-run', '--home', 'XX', '--away', 'GR'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('CLI should have exited non-zero');
  } catch (error) {
    const err = error as { status?: number; stderr?: string };
    assert.equal(err.status, 1);
    assert.match(String(err.stderr), /Unknown country code: XX/);
  }
});

function dryRunFails(args: string[]): string {
  try {
    execFileSync('npx', ['tsx', 'scripts/render-frame.ts', '--dry-run', ...args], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const err = error as { status?: number; stderr?: string };
    assert.equal(err.status, 1);
    return String(err.stderr);
  }
  assert.fail(`CLI should have rejected: ${args.join(' ')}`);
}

test('CLI fails cleanly on bad frame, fps, duration, scene and country', () => {
  const base = ['--home', 'TR', '--away', 'GR'];
  assert.match(dryRunFails([...base, '--frame', '-1']), /Invalid frame: -1\. Valid range is 0–119/);
  assert.match(dryRunFails([...base, '--frame', '120']), /Invalid frame: 120/);
  assert.match(dryRunFails([...base, '--fps', '1000']), /Invalid fps: 1000\. Supported range is 24–60/);
  assert.match(dryRunFails([...base, '--fps', '12']), /Invalid fps: 12/);
  assert.match(dryRunFails([...base, '--duration', '0']), /Invalid duration: 0/);
  assert.match(dryRunFails([...base, '--duration', '31']), /Invalid duration: 31/);
  assert.match(dryRunFails(['--home', 'TR', '--away', 'GR', '--scene', 'explosion']), /Unknown scene: explosion/);
  assert.match(dryRunFails(['--home', 'XX', '--away', 'GR']), /Unknown country code: XX/);
});
