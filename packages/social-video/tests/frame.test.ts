import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveSpec } from '../src/schema.ts';
import { pngDimensions } from '../src/render/frame.ts';

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
  const spec = resolveSpec({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42 });
  const dir = path.join(tmpdir(), 'hnc-social-test');
  mkdirSync(dir, { recursive: true });
  const output = path.join(dir, 'tr-vs-gr-faceoff.png');
  const rendered = await renderFrameToPng(spec, output);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1920);
  assert.ok(existsSync(output));
  const dims = pngDimensions(readFileSync(output));
  assert.deepEqual(dims, { width: 1080, height: 1920 });
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
