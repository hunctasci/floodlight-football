import test from 'node:test';
import assert from 'node:assert/strict';
import { compileVideo, evaluateFrame, type SceneFrameDescription } from '../src/timeline.ts';
import { assertShotTable, type SceneShot } from '../src/cameras/presets.ts';
import { cameraAxes, insideFrame, projectToNdc, REEL_ASPECT, type Vec3 } from '../src/cameras/project.ts';
import { CROSS_HEADER_SHOTS } from '../src/scenes/cross-header-goal.ts';
import { CROSSBAR_SHOTS } from '../src/scenes/crossbar-chaos.ts';
import { KEEPER_SHOTS } from '../src/scenes/keeper-disaster.ts';
import { ATTACK_SHOTS } from '../src/scenes/attack-goal.ts';

/**
 * Editorial readability budget. The whole milestone exists to prevent
 * machine-gun editing: these tests turn the creative rules into enforceable
 * invariants — establishing shots hold, flights track, cuts have reasons,
 * and the 180-degree screen direction survives consecutive information
 * shots. Pure timeline math, no browser.
 */

interface EditorialRules {
  /** Total deliberate shots (cuts + 1) must stay inside this range. */
  cuts: [number, number];
  /** First (establishing) shot minimum length in seconds. */
  establishMin: number;
  /** Every information shot minimum length in seconds. */
  infoMin: number;
  /** Reaction shots minimum length in seconds. */
  reactionMin: number;
  /** Spectacle shots (cinematic inserts) share of total duration. */
  spectacleMaxShare: number;
}

const RULES: Record<string, EditorialRules> = {
  'attack-goal': { cuts: [4, 7], establishMin: 1.5, infoMin: 0.5, reactionMin: 1.0, spectacleMaxShare: 0.3 },
  'cross-header-goal': { cuts: [6, 9], establishMin: 1.5, infoMin: 0.5, reactionMin: 1.0, spectacleMaxShare: 0.35 },
  'crossbar-chaos': { cuts: [5, 8], establishMin: 1.5, infoMin: 0.5, reactionMin: 1.0, spectacleMaxShare: 0.3 },
  'keeper-disaster': { cuts: [6, 9], establishMin: 1.5, infoMin: 0.5, reactionMin: 1.0, spectacleMaxShare: 0.3 },
};

const SCENES: Record<string, { shots: readonly SceneShot[]; spec: Record<string, unknown> }> = {
  'attack-goal': { shots: ATTACK_SHOTS, spec: { scene: 'attack-goal', home: 'TR', away: 'GR', seed: 42, fps: 30 } },
  'cross-header-goal': { shots: CROSS_HEADER_SHOTS, spec: { scene: 'cross-header-goal', home: 'TR', away: 'GR', seed: 42, fps: 60 } },
  'crossbar-chaos': { shots: CROSSBAR_SHOTS, spec: { scene: 'crossbar-chaos', home: 'BR', away: 'AR', seed: 7, fps: 60 } },
  'keeper-disaster': { shots: KEEPER_SHOTS, spec: { scene: 'keeper-disaster', home: 'TR', away: 'DE', seed: 11, fps: 60 } },
};

for (const [scene, { shots, spec }] of Object.entries(SCENES)) {
  test(`${scene}: shot table tiles and obeys the readability budget`, () => {
    assertShotTable(shots);
    const rules = RULES[scene];
    const total = shots[shots.length - 1].end;
    // Cut count: deliberate shots, never dozens of tiny segments.
    assert.ok(
      shots.length >= rules.cuts[0] && shots.length <= rules.cuts[1],
      `${scene} has ${shots.length} shots (budget ${rules.cuts[0]}–${rules.cuts[1]})`,
    );
    // Establishing shot: the viewer must understand the situation first.
    assert.ok(
      shots[0].end - shots[0].start >= rules.establishMin,
      `${scene} establishing shot ${(shots[0].end - shots[0].start).toFixed(2)}s >= ${rules.establishMin}s`,
    );
    for (const s of shots) {
      const d = s.end - s.start;
      if (s.kind === 'info') {
        assert.ok(d >= rules.infoMin, `${scene} info shot ${s.name} ${d.toFixed(2)}s >= ${rules.infoMin}s`);
      } else if (s.kind === 'reaction') {
        assert.ok(d >= rules.reactionMin - 1e-9, `${scene} reaction shot ${s.name} ${d.toFixed(2)}s >= ${rules.reactionMin}s`);
      } else if (s.kind === 'spectacle') {
        assert.ok(d >= 0.25, `${scene} spectacle shot ${s.name} ${d.toFixed(2)}s is a punctuation, not a blink`);
      } else if (s.kind === 'impact') {
        assert.ok(d >= 0.12, `${scene} impact shot ${s.name} has a positive hold`);
      }
    }
    // Spectacle share: cinematic closeups never dominate the action.
    const spectacle = shots.filter((s) => s.kind === 'spectacle').reduce((sum, s) => sum + s.end - s.start, 0);
    assert.ok(
      spectacle / total <= rules.spectacleMaxShare + 1e-9,
      `${scene} spectacle share ${(spectacle / total).toFixed(2)} <= ${rules.spectacleMaxShare}`,
    );
  });

  test(`${scene}: ball stays inside the frame during every flight beat`, () => {
    const compiled = compileVideo(spec);
    // Flight coverage = shots that carry the ball story (everything except
    // reaction shots and the goal-cine behind-net angle, where the ball is
    // the subject by construction but the camera looks back at the goal).
    const flightShots = shots.filter((s) => s.kind !== 'reaction' && !s.name.startsWith('goal-cine'));
    for (const s of flightShots) {
      const f0 = Math.ceil(s.start * compiled.fps);
      const f1 = Math.max(f0, Math.floor(s.end * compiled.fps) - 1);
      for (let f = f0; f <= f1; f += Math.max(1, Math.round(compiled.fps / 10))) {        const desc = evaluateFrame(compiled, f) as { ball: Vec3; camera: { pos: Vec3; look: Vec3; fov: number } };
        const ndc = projectToNdc(desc.camera, desc.ball, REEL_ASPECT);
        assert.ok(
          insideFrame(ndc, 1.0),
          `${scene} ${s.name} frame ${f} (t=${(f / compiled.fps).toFixed(2)}): ball ndc (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)})`,
        );
      }
    }
  });

  test(`${scene}: attack screen direction survives consecutive information shots`, () => {
    const compiled = compileVideo(spec);
    const attackSign = compiled.attackTeam === 'away' ? -1 : 1;
    const attackDir = { x: attackSign, y: 0, z: 0 };
    // Reaction shots, spectacle inserts and behind-goal angles may
    // legitimately reverse the screen direction (cutaway/replay-style);
    // consecutive INFORMATION shots must keep the dominant attack direction
    // flowing the same way across cuts.
    const readable = shots.filter((s) => s.kind === 'info' && !s.name.startsWith('goal-cine'));
    let expectedSign: number | null = null;
    for (const s of readable) {
      const mid = Math.min(compiled.totalFrames - 1, Math.floor((s.start + s.end) / 2 * compiled.fps));
      const desc = evaluateFrame(compiled, mid) as { camera: { pos: Vec3; look: Vec3; fov: number } };
      const { right } = cameraAxes(desc.camera);
      const screenX = right.x * attackDir.x + right.y * attackDir.y + right.z * attackDir.z;
      const sign = Math.sign(screenX);
      if (sign === 0) continue;
      if (expectedSign === null) expectedSign = sign;
      assert.equal(
        sign, expectedSign,
        `${scene} ${s.name} flips attack screen direction (${sign} vs ${expectedSign})`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Flight tracking minimums: ball flights must be held in readable
// compositions (never cut through), with spectacle inserts capped.
// ---------------------------------------------------------------------------

function overlap(s: SceneShot, start: number, end: number): number {
  return Math.max(0, Math.min(s.end, end) - Math.max(s.start, start));
}

test('cross-header: cross flight is tracked across the full flight window', () => {
  // The cross flies 3.5–5.8s. Readable cameras (medium hold, cross-follow,
  // wide-goal setup) cover the flight; only ONE short spectacle insert
  // (ball-near-lens) may interrupt it.
  const flightStart = 3.5, flightEnd = 5.8;
  const spectacle = CROSS_HEADER_SHOTS.filter((s) => s.kind === 'spectacle' && overlap(s, flightStart, flightEnd) > 0);
  assert.equal(spectacle.length, 1, 'exactly one spectacle insert inside the cross flight');
  const readable = CROSS_HEADER_SHOTS.filter((s) => s.kind === 'info');
  const covered = readable.reduce((sum, s) => sum + overlap(s, flightStart, flightEnd), 0);
  assert.ok(covered >= 1.9, `cross flight readable coverage ≥ 1.9s (got ${covered.toFixed(2)}s)`);
  const follow = CROSS_HEADER_SHOTS.find((s) => s.name === 'cross-follow');
  assert.ok(follow, 'cross-follow shot exists');
  assert.ok(follow.end - follow.start >= 0.5, `cross-follow tracks the flight (got ${(follow.end - follow.start).toFixed(2)}s)`);
});

test('crossbar: rebound story holds on ONE camera', () => {
  const wide = CROSSBAR_SHOTS.find((s) => s.name === 'wide-goal');
  assert.ok(wide, 'wide-goal rebound shot exists');
  assert.ok(wide.end - wide.start >= 2.0, `rebound hang + scramble ≥ 2s on one camera (got ${(wide.end - wide.start).toFixed(2)}s)`);
});

test('keeper: hero beat pauses before the mistake, mistake never hidden behind a cut', () => {
  const glory = KEEPER_SHOTS.find((s) => s.name === 'keeper-close');
  assert.ok(glory, 'keeper glory beat exists');
  assert.ok(glory.end - glory.start >= 0.9, `viewer has ≥ 0.9s to believe the save (got ${(glory.end - glory.start).toFixed(2)}s)`);
  // The mistake itself (punt 5.8 → poacher receives 7.0) plays out on
  // readable cameras: wide-goal through the punt, one medium for the flight.
  const flightStart = 5.8, flightEnd = 7.0;
  const readable = KEEPER_SHOTS.filter((s) => s.kind === 'info');
  const covered = readable.reduce((sum, s) => sum + overlap(s, flightStart, flightEnd), 0);
  assert.ok(covered >= flightEnd - flightStart - 1e-9, `clearance flight fully covered by readable shots (${covered.toFixed(2)}s)`);
  const cutsInFlight = readable.filter((s) => s.start > flightStart && s.start < flightEnd).length;
  assert.ok(cutsInFlight <= 1, `at most one cut during the clearance flight (got ${cutsInFlight})`);
});

test('attack: final pass + settle play without a cut', () => {
  // The final ball (4.4s) and the shooter's setup run on one striker-low
  // shot — the viewer sees the settle and the wind-up, then the shot.
  const setup = ATTACK_SHOTS.find((s) => s.name === 'striker-low');
  assert.ok(setup, 'shooter setup shot exists');
  assert.ok(setup.end - setup.start >= 0.8, `settle + wind-up ≥ 0.8s (got ${(setup.end - setup.start).toFixed(2)}s)`);
});

test('every scene ends with a celebration reaction of at least 1s', () => {
  for (const [scene, { shots }] of Object.entries(SCENES)) {
    const last = shots[shots.length - 1];
    assert.equal(last.kind, 'reaction', `${scene} closes on a reaction beat`);
    assert.ok(last.end - last.start >= 1.0, `${scene} closing reaction ≥ 1s (got ${(last.end - last.start).toFixed(2)}s)`);
  }
});

test('evaluation is still deterministic and random-access with the new cuts', () => {
  for (const [scene, { spec }] of Object.entries(SCENES)) {
    const a = compileVideo(spec);
    const b = compileVideo(spec);
    const last = a.totalFrames - 1;
    const frames = [0, 10, 100, Math.floor(last / 2), last].filter((f, i, arr) => f >= 0 && arr.indexOf(f) === i);
    for (const f of frames) {
      assert.deepEqual(evaluateFrame(a, f), evaluateFrame(b, f), `${scene} frame ${f} deterministic`);
    }
    const direct = evaluateFrame(a, 100) as SceneFrameDescription;
    for (const f of [0, 50, 200]) evaluateFrame(a, f);
    assert.deepEqual(evaluateFrame(a, 100), direct, `${scene} random access`);
  }
});
