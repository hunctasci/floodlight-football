import test from 'node:test';
import assert from 'node:assert/strict';
import { lerpAngleShortest, smoothstep } from '../src/timeline/math.ts';
import { evaluateTrack, evaluateTrackCR } from '../src/timeline/tracks.ts';
import { applyHold } from '../src/timeline/arcade.ts';
import { SCENE_RECOMMENDED_FPS } from '../src/config.ts';
import { buildEncodeArgs } from '../src/encode/video.ts';
import { compileVideo, evaluateFrame, type SceneFrameDescription } from '../src/timeline.ts';
import { CROSS_HEADER_BEATS } from '../src/scenes/cross-header-goal.ts';
import { CROSSBAR_BEATS } from '../src/scenes/crossbar-chaos.ts';
import { KEEPER_BEATS } from '../src/scenes/keeper-disaster.ts';
import { ATTACK_GOAL_BEATS } from '../src/scenes/attack-goal.ts';

// ---------------------------------------------------------------------------
// Facing: shortest-arc interpolation never spins the long way.
// ---------------------------------------------------------------------------

test('lerpAngleShortest crosses the -π/π seam the short way', () => {
  const near = Math.PI - 0.1, other = -Math.PI + 0.1;
  const mid = lerpAngleShortest(near, other, 0.5);
  // Shortest path goes through π (≈±π), not through 0.
  assert.ok(Math.abs(mid) > Math.PI - 0.15, `through the seam (got ${mid.toFixed(3)})`);
  assert.equal(lerpAngleShortest(0.5, 1.5, 0), 0.5);
  assert.equal(lerpAngleShortest(0.5, 1.5, 1), 1.5);
  assert.equal(lerpAngleShortest(0, Math.PI * 4 + 1, 1), 1, 'wraps long spins');
  assert.ok(lerpAngleShortest(0, Math.PI, 0.5) === Math.PI / 2, 'half turn midpoint');
});

// ---------------------------------------------------------------------------
// Tracks: eased stops vs continuous transit.
// ---------------------------------------------------------------------------

const RUN_KEYS = [
  { time: 0, x: 0, z: 0 },
  { time: 1, x: 5, z: 0 },
  { time: 2, x: 10, z: 0 },
  { time: 3, x: 15, z: 0 },
];

test('evaluateTrack eases to a stop at every key (settles)', () => {
  // Zero slope at the interior key: arrives stopped.
  const before = evaluateTrack(RUN_KEYS, 0.999).x;
  const after = evaluateTrack(RUN_KEYS, 1.001).x;
  assert.ok(Math.abs(before - 5) < 0.001 && Math.abs(after - 5) < 0.001, 'parks at the key');
  const vIn = (evaluateTrack(RUN_KEYS, 1).x - evaluateTrack(RUN_KEYS, 0.99).x) / 0.01;
  const vOut = (evaluateTrack(RUN_KEYS, 1.01).x - evaluateTrack(RUN_KEYS, 1).x) / 0.01;
  assert.ok(vIn < 0.5 && vOut < 0.5, `stopped both sides (${vIn.toFixed(2)}, ${vOut.toFixed(2)})`);
});

test('evaluateTrackCR keeps velocity through interior waypoints', () => {
  const vIn = (evaluateTrackCR(RUN_KEYS, 1).x - evaluateTrackCR(RUN_KEYS, 0.9).x) / 0.1;
  const vOut = (evaluateTrackCR(RUN_KEYS, 1.1).x - evaluateTrackCR(RUN_KEYS, 1).x) / 0.1;
  assert.ok(vIn > 2 && vOut > 2, `runs through the key (${vIn.toFixed(2)}, ${vOut.toFixed(2)} m/s)`);
  assert.ok(Math.abs(vOut - vIn) < 1.5, 'no velocity cliff across the key');
  assert.deepEqual(evaluateTrackCR(RUN_KEYS, 0), { x: 0, z: 0 });
  assert.deepEqual(evaluateTrackCR(RUN_KEYS, 99), { x: 15, z: 0 });
  assert.deepEqual(evaluateTrackCR([], 1), { x: 0, z: 0 });
});

// ---------------------------------------------------------------------------
// Time warp: pure, monotonic, holds only where declared.
// ---------------------------------------------------------------------------

test('applyHold freezes exactly the declared window and stays monotonic', () => {
  let prev = -Infinity;
  for (let t = 2.4; t <= 2.9; t += 1 / 60) {
    const { te, inHold } = applyHold(t, 2.6, 0.05);
    assert.ok(te >= prev - 1e-12, 'monotonic');
    prev = te;
    assert.equal(inHold, t >= 2.6 && t < 2.65, `hold flag at t=${t.toFixed(3)}`);
    if (inHold) assert.equal(te, 2.6, 'frozen at contact');
  }
  assert.deepEqual(applyHold(1, 2, 0), { te: 1, inHold: false }, 'zero hold is identity');
});

// ---------------------------------------------------------------------------
// Ball motion: frozen ONLY inside declared impact holds (or declared rests),
// always travelling inside flight windows. This is the duplicate-frame rule
// at the level that matters: unintended stillness during fast action.
// ---------------------------------------------------------------------------

/** Declared hold windows (seconds) per scene. */
const HOLD_WINDOWS: Record<string, [number, number][]> = {
  'attack-goal': [],
  'cross-header-goal': [[CROSS_HEADER_BEATS.contact, CROSS_HEADER_BEATS.contact + CROSS_HEADER_BEATS.holdLen]],
  'crossbar-chaos': [[CROSSBAR_BEATS.barHit, CROSSBAR_BEATS.barHit + CROSSBAR_BEATS.holdLen]],
  // Save clang + the poacher's first-touch settle (control, not lag). The
  // touch freeze is staged in action time [2.55, 2.6) but the earlier save
  // hold shifts the action clock 0.05s behind scene time, so it manifests
  // at scene time [2.6, 2.65).
  'keeper-disaster': [
    [KEEPER_BEATS.saveMoment, KEEPER_BEATS.saveMoment + KEEPER_BEATS.holdLen],
    [KEEPER_BEATS.clearanceEnd + KEEPER_BEATS.holdLen, KEEPER_BEATS.clearanceEnd + KEEPER_BEATS.holdLen + 0.05],
  ],
};

/** Flight windows: the ball must travel every frame except inside holds. */
const FLIGHT_WINDOWS: Record<string, [number, number][]> = {
  'attack-goal': [[ATTACK_GOAL_BEATS.pass1Start, ATTACK_GOAL_BEATS.pass1End], [ATTACK_GOAL_BEATS.pass1End, ATTACK_GOAL_BEATS.carryEnd], [ATTACK_GOAL_BEATS.carryEnd, ATTACK_GOAL_BEATS.settleEnd], [ATTACK_GOAL_BEATS.shotStart, ATTACK_GOAL_BEATS.netSettleEnd]],
  'cross-header-goal': [[CROSS_HEADER_BEATS.crossContact, CROSS_HEADER_BEATS.headerEnd], [CROSS_HEADER_BEATS.headerEnd, CROSS_HEADER_BEATS.netSettleEnd]],
  'crossbar-chaos': [[CROSSBAR_BEATS.shotStart, CROSSBAR_BEATS.barHit], [CROSSBAR_BEATS.barHit, CROSSBAR_BEATS.reboundEnd], [CROSSBAR_BEATS.reboundEnd, CROSSBAR_BEATS.volleyContact], [CROSSBAR_BEATS.volleyContact, CROSSBAR_BEATS.volleyEnd], [CROSSBAR_BEATS.volleyEnd, CROSSBAR_BEATS.netSettleEnd]],
  'keeper-disaster': [[KEEPER_BEATS.shotStart, KEEPER_BEATS.saveMoment], [KEEPER_BEATS.saveMoment, KEEPER_BEATS.gatherEnd], [KEEPER_BEATS.holdBallEnd, KEEPER_BEATS.clearanceEnd], [KEEPER_BEATS.clearanceEnd, KEEPER_BEATS.instantShotEnd], [KEEPER_BEATS.instantShotEnd, KEEPER_BEATS.netSettleEnd]],
};

const SCENE_SPECS: Record<string, Record<string, unknown>> = {
  'attack-goal': { scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 6 },
  'cross-header-goal': { scene: 'cross-header-goal', home: 'TR', away: 'GR', seed: 42, fps: 60, duration: 6 },
  'crossbar-chaos': { scene: 'crossbar-chaos', home: 'BR', away: 'AR', seed: 7, fps: 60, duration: 6 },
  'keeper-disaster': { scene: 'keeper-disaster', home: 'TR', away: 'DE', seed: 11, fps: 60, duration: 5.5 },
};

function inHold(scene: string, time: number): boolean {
  return (HOLD_WINDOWS[scene] ?? []).some(([a, b]) => time >= a && time < b + 1e-9);
}

function inFlight(scene: string, time: number): boolean {
  return (FLIGHT_WINDOWS[scene] ?? []).some(([a, b]) => time >= a && time < b);
}

for (const [scene, spec] of Object.entries(SCENE_SPECS)) {
  test(`${scene}: ball travels in flight, freezes only on declared holds`, () => {
    const compiled = compileVideo(spec);
    const ballAt = (f: number): { x: number; y: number; z: number } =>
      (evaluateFrame(compiled, f) as { ball: { x: number; y: number; z: number } }).ball;
    let frozenFlightFrames = 0;
    let holdFrozen = false;
    for (let f = 1; f < compiled.totalFrames; f++) {
      const t = f / compiled.fps;
      if (!inFlight(scene, t)) continue;
      const a = ballAt(f - 1), b = ballAt(f);
      const moved = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (inHold(scene, t)) {
        if (moved < 1e-9) holdFrozen = true;
      } else if (moved < 1e-9) {
        frozenFlightFrames++;
      }
    }
    assert.equal(frozenFlightFrames, 0, `${scene} has still ball frames outside holds/rests`);
    if ((HOLD_WINDOWS[scene] ?? []).length > 0) {
      assert.ok(holdFrozen, `${scene} declares holds — the ball must actually freeze in them`);
    }
  });
}

// ---------------------------------------------------------------------------
// Camera: smooth within beats, jumps only at declared cuts.
// ---------------------------------------------------------------------------

/** Declared hard-cut times (seconds) per scene. */
const CAMERA_CUTS: Record<string, number[]> = {
  'attack-goal': [ATTACK_GOAL_BEATS.pass2End, ATTACK_GOAL_BEATS.shotStart, ATTACK_GOAL_BEATS.cineEnd - 1.0, ATTACK_GOAL_BEATS.cineEnd],
  'cross-header-goal': [0.8, CROSS_HEADER_BEATS.crossContact, CROSS_HEADER_BEATS.lensStart, CROSS_HEADER_BEATS.lensEnd, CROSS_HEADER_BEATS.contact, 3.2, CROSS_HEADER_BEATS.celebStart],
  'crossbar-chaos': [CROSSBAR_BEATS.shotStart, CROSSBAR_BEATS.barHit, 2.0, CROSSBAR_BEATS.reboundEnd, CROSSBAR_BEATS.volleyContact, CROSSBAR_BEATS.volleyEnd + 0.3, CROSSBAR_BEATS.celebStart],
  'keeper-disaster': [KEEPER_BEATS.shotStart, KEEPER_BEATS.saveMoment, 1.7, KEEPER_BEATS.holdBallEnd, KEEPER_BEATS.clearanceEnd + 0.1, KEEPER_BEATS.instantShotEnd + 0.3, KEEPER_BEATS.celebStart, KEEPER_BEATS.celebStart + 0.9],
};

function camJump(d: SceneFrameDescription): { pos: number; fov: number } {
  void d;
  return { pos: 0, fov: 0 };
}
void camJump;

for (const [scene, spec] of Object.entries(SCENE_SPECS)) {
  test(`${scene}: camera glides within beats, cuts only where declared`, () => {
    const compiled = compileVideo(spec);
    const cuts = CAMERA_CUTS[scene];
    const nearCut = (t: number) => cuts.some((c) => Math.abs(t - c) < 1 / compiled.fps + 1e-9);
    for (let f = 1; f < compiled.totalFrames; f++) {
      const a = evaluateFrame(compiled, f - 1) as { camera: { pos: { x: number; y: number; z: number }; fov: number } };
      const b = evaluateFrame(compiled, f) as { camera: { pos: { x: number; y: number; z: number }; fov: number } };
      const jump = Math.hypot(b.camera.pos.x - a.camera.pos.x, b.camera.pos.y - a.camera.pos.y, b.camera.pos.z - a.camera.pos.z);
      const cut = nearCut(f / compiled.fps);
      if (jump > 3) {
        assert.ok(cut, `${scene} ${(jump).toFixed(1)}m camera jump at frame ${f} is not a declared cut`);
      }
      // A hard cut swaps lenses outright (up to ~5° FOV steps are the new
      // shot, not a glitch); inside a beat the FOV only breathes via punch.
      const fovStep = Math.abs(b.camera.fov - a.camera.fov);
      assert.ok(fovStep < (cut ? 5.5 : 0.5), `${scene} FOV step ${fovStep.toFixed(2)} at frame ${f}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Poses blend continuously (no 0→1 toggles).
// ---------------------------------------------------------------------------

for (const [scene, spec] of Object.entries(SCENE_SPECS)) {
  test(`${scene}: pose properties blend without pops`, () => {
    const compiled = compileVideo(spec);
    const poseOf = (d: SceneFrameDescription): number[][] => {
      const p = (d as { pose?: { bob: number; lean: number; armLift: number; armSpread?: number; legSwing?: number; roll?: number; spin?: number }[] }).pose
        ?? (d as unknown as { actors: { bob: number; lean: number; armLift: number; armSpread: number; legSwing: number; roll: number; spin: number }[] }).actors.map((a) => ({
          bob: a.bob, lean: a.lean, armLift: a.armLift, armSpread: a.armSpread, legSwing: a.legSwing, roll: a.roll, spin: a.spin,
        }));
      return p.map((q) => [q.bob, q.lean, q.armLift, q.armSpread ?? 0, q.legSwing ?? 0, q.roll ?? 0, q.spin ?? 0]);
    };
    for (let f = 1; f < compiled.totalFrames; f++) {
      if (inHold(scene, f / compiled.fps)) continue;
      const a = poseOf(evaluateFrame(compiled, f - 1));
      const b = poseOf(evaluateFrame(compiled, f));
      for (let i = 0; i < a.length; i++) {
        for (let k = 0; k < a[i].length; k++) {
          // Index 4 is legSwing: strike/volley/clearance sweeps run at real
          // kick speed by design (masked by the impact juice on those exact
          // frames); everything else must blend smoothly.
          const limit = k === 4 ? 1.0 : 0.6;
          assert.ok(Math.abs(b[i][k] - a[i][k]) < limit, `${scene} frame ${f} actor ${i} pose[${k}] pops`);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Shake is time-based: the same moment renders identically at 30 and 60fps.
// ---------------------------------------------------------------------------

test('camera shake is fps-independent (same moment, same offset)', () => {
  const at30 = compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30, duration: 6 });
  const at60 = compileVideo({ scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 60, duration: 6 });
  for (const t of [3.3, 3.5, 3.7]) {
    const a = evaluateFrame(at30, Math.round(t * 30)) as { effects: { shakeX: number; shakeY: number } };
    const b = evaluateFrame(at60, Math.round(t * 60)) as { effects: { shakeX: number; shakeY: number } };
    assert.ok(Math.abs(a.effects.shakeX - b.effects.shakeX) < 1e-9, `shakeX matches at t=${t}`);
    assert.ok(Math.abs(a.effects.shakeY - b.effects.shakeY) < 1e-9, `shakeY matches at t=${t}`);
  }
});

// ---------------------------------------------------------------------------
// Production fps + encoder cadence.
// ---------------------------------------------------------------------------

test('high-action scenes recommend 60fps; intros stay 30', () => {
  assert.equal(SCENE_RECOMMENDED_FPS.faceoff, 30);
  for (const scene of ['attack-goal', 'cross-header-goal', 'crossbar-chaos', 'keeper-disaster'] as const) {
    assert.equal(SCENE_RECOMMENDED_FPS[scene], 60, `${scene} is a 60fps production scene`);
  }
});

test('encoder interprets PNGs at the compiled fps with CFR-friendly flags', () => {
  for (const fps of [30, 60]) {
    const args = buildEncodeArgs({ fps, framePattern: '/tmp/x/%06d.png', audioPath: '/tmp/x/sfx.wav', output: '/tmp/x/out.mp4' });
    const rate = args.indexOf('-framerate');
    assert.ok(rate >= 0 && args[rate + 1] === String(fps), `input framerate ${fps}`);
    assert.ok(args.includes('yuv420p'), 'platform pixel format');
    assert.ok(args.includes('+faststart'), 'faststart for progressive playback');
    assert.ok(args.includes('aac'), 'AAC audio');
    void smoothstep;
  }
});
