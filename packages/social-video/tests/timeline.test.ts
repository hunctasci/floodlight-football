import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clamp01, lerp, smoothstep, easeInOut, segmentProgress } from '../src/timeline/math.ts';
import {
  compileVideo, evaluateFrame, frameFilename, type CompiledSocialVideo,
} from '../src/timeline.ts';
import {
  frameTime, parseDuration, parseFps, resolveVideoSpec, SocialSpecError,
} from '../src/schema.ts';

const std = () => compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });

test('timeline math primitives are pure and bounded', () => {
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(7), 1);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(segmentProgress(0.3, 0.6, 1.8), 0);
  assert.equal(segmentProgress(5, 0.6, 1.8), 1);
  const mid = segmentProgress(1.2, 0.6, 1.8);
  assert.ok(mid > 0 && mid < 1 && Math.abs(mid - 0.5) < 1e-9);
});

test('video spec defaults: fps=30, duration=4, seed=42, format=reel', () => {
  const spec = resolveVideoSpec({ scene: 'faceoff', home: 'TR', away: 'GR' });
  assert.equal(spec.fps, 30);
  assert.equal(spec.duration, 4);
  assert.equal(spec.seed, 42);
  assert.equal(spec.format, 'reel');
  assert.equal(spec.totalFrames, 120);
});

test('totalFrames follows Math.round(duration * fps)', () => {
  assert.equal(resolveVideoSpec({ home: 'TR', away: 'GR', fps: 24, duration: 2.5 }).totalFrames, 60);
  assert.equal(resolveVideoSpec({ home: 'TR', away: 'GR', fps: 60, duration: 30 }).totalFrames, 1800);
});

test('fps and duration validation fails clearly', () => {
  assert.throws(() => parseFps(120), /Invalid fps: 120\. Supported range is 24–60/);
  assert.throws(() => parseFps(23), /Invalid fps/);
  assert.throws(() => parseFps(29.5), /Invalid fps/);
  assert.throws(() => parseDuration(0), /Invalid duration: 0/);
  assert.throws(() => parseDuration(-2), /Invalid duration/);
  assert.throws(() => parseDuration(31), /Invalid duration/);
  assert.throws(
    () => resolveVideoSpec({ home: 'TR', away: 'GR', fps: 1000 }),
    (e) => e instanceof SocialSpecError,
  );
});

test('time is always frame / fps', () => {
  assert.equal(frameTime(0, 30), 0);
  assert.equal(frameTime(30, 30), 1);
  assert.equal(frameTime(60, 30), 2);
  assert.equal(frameTime(90, 30), 3);
  assert.ok(Math.abs(frameTime(119, 30) - 3.966666666666667) < 1e-12);
});

test('frame filenames are zero-padded to 6 digits', () => {
  assert.equal(frameFilename(0), '000000.png');
  assert.equal(frameFilename(7), '000007.png');
  assert.equal(frameFilename(119), '000119.png');
});

test('evaluateFrame returns a well-formed description at 0, 60 and 119', () => {
  const compiled = std();
  for (const frame of [0, 60, 119]) {
    const desc = evaluateFrame(compiled, frame);
    assert.equal(desc.frame, frame);
    assert.equal(desc.time, frame / 30);
    assert.equal(desc.clock, desc.time);
    for (const actor of [desc.home, desc.away]) {
      assert.ok(Math.abs(actor.x) < 46 && Math.abs(actor.z) < 29, 'actor stays on the pitch');
      const facing = Math.hypot(actor.facingX, actor.facingZ);
      assert.ok(Math.abs(facing - 1) < 1e-9, 'facing is normalized');
    }
    assert.deepEqual(desc.ball, { x: 0, y: 0.25, z: 0 });
    assert.ok(desc.camera.fov >= 40 && desc.camera.fov <= 65);
    assert.ok(desc.camera.pos.z > 5, 'camera stays on the near side');
  }
});

test('out-of-range frames fail clearly', () => {
  const compiled = std();
  assert.throws(() => evaluateFrame(compiled, -1), /Invalid frame: -1\. Valid range is 0–119/);
  assert.throws(() => evaluateFrame(compiled, 120), /Invalid frame: 120/);
  assert.throws(() => evaluateFrame(compiled, 1.5), /Invalid frame: 1\.5/);
});

test('same spec compiled twice yields identical frame descriptions', () => {
  const a = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });
  const b = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });
  for (const frame of [0, 30, 60, 90, 119]) {
    assert.deepEqual(evaluateFrame(a, frame), evaluateFrame(b, frame));
  }
});

test('evaluateFrame is random-access: frame 75 is independent of prior evaluations', () => {
  const compiled = std();
  const direct = evaluateFrame(compiled, 75);
  evaluateFrame(compiled, 0);
  evaluateFrame(compiled, 10);
  evaluateFrame(compiled, 40);
  evaluateFrame(compiled, 119);
  const afterOthers = evaluateFrame(compiled, 75);
  assert.deepEqual(direct, afterOthers);
});

test('seed 42 vs 43 differ stylistically but preserve identity and length', () => {
  const a = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 4 });
  const b = compileVideo({ scene: 'faceoff', home: 'TR', away: 'GR', seed: 43, fps: 30, duration: 4 });
  assert.notDeepEqual(a.faceoff, b.faceoff);
  assert.notDeepEqual(evaluateFrame(a, 60), evaluateFrame(b, 60));
  for (const compiled of [a, b]) {
    assert.equal(compiled.home, 'TR');
    assert.equal(compiled.away, 'GR');
    assert.equal(compiled.fps, 30);
    assert.equal(compiled.duration, 4);
    assert.equal(compiled.totalFrames, 120);
    assert.equal(compiled.width, 1080);
    assert.equal(compiled.height, 1920);
  }
});

function gap(compiled: CompiledSocialVideo, frame: number): number {
  const desc = evaluateFrame(compiled, frame);
  return Math.hypot(desc.home.x - desc.away.x, desc.home.z - desc.away.z);
}

test('faceoff beats: still start, approach, tension hold, final push', () => {
  const compiled = std();
  // Frame 0 sits exactly on the staged base positions (no approach yet).
  const first = evaluateFrame(compiled, 0);
  assert.equal(first.home.x, compiled.faceoff.homeBase.x);
  assert.equal(first.away.x, compiled.faceoff.awayBase.x);
  assert.equal(first.home.bob, Math.sin(compiled.faceoff.breathPhaseHome) * 0.022);
  // Mid-approach players are closer than at the start, and closer still later.
  const g0 = gap(compiled, 0);
  const g30 = gap(compiled, 30);
  const g60 = gap(compiled, 60);
  assert.ok(g30 < g0 && g60 <= g30, `gaps ${g0.toFixed(2)} ${g30.toFixed(2)} ${g60.toFixed(2)}`);
  // Nobody collides: separation stays clearly above body width throughout.
  for (const frame of [0, 30, 60, 90, 119]) {
    assert.ok(gap(compiled, frame) > 1.5, `frame ${frame} keeps separation`);
  }
  // Final frame carries the rivalry stance; the opener does not.
  const last = evaluateFrame(compiled, 119);
  assert.ok(last.home.lean > 0 && last.home.armLift > 0);
  assert.equal(first.home.lean, 0);
  assert.equal(first.home.armLift, 0);
  // Camera pushes in over the clip: nearer and lower at the end.
  assert.ok(last.camera.pos.z < first.camera.pos.z, 'camera dollies in');
  assert.ok(last.camera.pos.y < first.camera.pos.y, 'camera drops lower');
});

test('clearFramePngs removes only generated frame files', async () => {
  const { clearFramePngs } = await import('../src/render/frame.ts');
  const dir = mkdtempSync(path.join(tmpdir(), 'hnc-clear-'));
  writeFileSync(path.join(dir, '000000.png'), 'stale');
  writeFileSync(path.join(dir, '000119.png'), 'stale');
  writeFileSync(path.join(dir, 'notes.txt'), 'keep me');
  mkdirSync(path.join(dir, 'sub'));
  const removed = await clearFramePngs(dir);
  assert.equal(removed, 2);
  assert.deepEqual(readdirSync(dir).sort(), ['notes.txt', 'sub']);
});
