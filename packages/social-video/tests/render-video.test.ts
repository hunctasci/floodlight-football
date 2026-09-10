import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveFfmpeg } from '../src/encode/ffmpeg.ts';
import { hasFaststart, probeMedia, validateMedia } from '../src/encode/probe.ts';

/** Chromium availability probe (same pattern as frame.test.ts). */
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

function ffmpegAvailable(): boolean {
  try {
    resolveFfmpeg();
    return true;
  } catch {
    return false;
  }
}

const PKG = new URL('..', import.meta.url);

function renderVideoCli(args: string[], env: Record<string, string> = {}): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', 'scripts/render-video.ts', ...args], {
      cwd: PKG,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { status: 0, stdout: String(stdout), stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

test('CLI refuses to overwrite an existing MP4 without --force (fast, no browser)', () => {
  const dir = path.join(tmpdir(), 'hnc-render-cli');
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'exists.mp4');
  writeFileSync(out, 'placeholder');
  const result = renderVideoCli(['--scene', 'faceoff', '--home', 'TR', '--away', 'GR', '--output', out]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
  assert.match(result.stderr, /--force/);
  assert.equal(existsSync(out), true);
});

test('CLI rejects a missing music file before launching a browser', () => {
  const out = path.join(tmpdir(), 'hnc-render-cli', 'music-check.mp4');
  const result = renderVideoCli([
    '--scene', 'faceoff', '--home', 'TR', '--away', 'GR',
    '--music', '/tmp/no-such-track-xyz.mp3', '--output', out,
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Music file not found/);
});

test('CLI reports a missing FFmpeg clearly (fast, no browser)', () => {
  const out = path.join(tmpdir(), 'hnc-render-cli', 'noffmpeg.mp4');
  const result = renderVideoCli(
    ['--scene', 'faceoff', '--home', 'TR', '--away', 'GR', '--output', out, '--force'],
    { FFMPEG_PATH: '/tmp/does-not-exist-ffmpeg-xyz' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not exist/);
});

test('short-clip integration: 24fps faceoff MP4 validates h264/aac/1080x1920', { timeout: 300_000 }, async (t) => {
  if (process.env.SOCIAL_BROWSER_TEST === '0' || !chromiumAvailable()) {
    t.skip('Chromium not installed — run `npx playwright install chromium` to enable');
    return;
  }
  if (!ffmpegAvailable()) {
    t.skip('FFmpeg not installed — install FFmpeg or set FFMPEG_PATH to enable');
    return;
  }
  const dir = path.join(tmpdir(), 'hnc-render-integration');
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'faceoff-short.mp4');
  const result = renderVideoCli([
    '--scene', 'faceoff', '--home', 'TR', '--away', 'GR',
    '--fps', '24', '--duration', '0.5', '--output', out, '--force',
  ]);
  assert.equal(result.status, 0, `render-video succeeded, stderr: ${result.stderr.slice(-500)}`);
  assert.ok(existsSync(out), 'MP4 written');
  assert.match(result.stdout, /Validated:/);

  const { resolveFfprobe } = await import('../src/encode/ffmpeg.ts');
  const probed = await probeMedia(resolveFfprobe(), out);
  validateMedia(probed, { width: 1080, height: 1920, fps: 24, duration: 0.5 });
  assert.ok(await hasFaststart(out), 'moov before mdat (faststart)');
});
