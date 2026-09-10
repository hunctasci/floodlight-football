import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from '../../../apps/game/src/types.ts';
import { compileVideo, evaluateFrame, type CompiledSocialVideo } from '../src/timeline.ts';
import {
  KEEPER_BEATS, evaluateKeeperCrowd, type KeeperFrameDescription,
} from '../src/scenes/keeper-disaster.ts';

const std = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'keeper-disaster', home: 'TR', away: 'DE', seed: 11, fps: 60, ...extra });

function desc(compiled: CompiledSocialVideo, frame: number): KeeperFrameDescription {
  const d = evaluateFrame(compiled, frame);
  if (d.scene !== 'keeper-disaster') throw new Error(`expected keeper-disaster, got ${d.scene}`);
  return d;
}

function actor(d: KeeperFrameDescription, name: string): KeeperFrameDescription['actors'][number] {
  const found = d.actors.find((a) => a.name === name);
  assert.ok(found, `actor ${name} exists`);
  return found;
}

test('keeper-disaster defaults: 10.5s comedy with a hero beat', () => {
  const compiled = std();
  assert.equal(compiled.duration, 10.5);
  assert.equal(compiled.totalFrames, 630);
});

test('first save genuinely intersects the ball', () => {
  const compiled = std();
  let min = Infinity;
  for (let f = Math.round(2.5 * 60); f <= Math.round(3.5 * 60); f++) {
    const d = desc(compiled, f);
    const k = actor(d, 'Keeper');
    const dist = Math.hypot(d.ball.x - k.x, d.ball.z - k.z, d.ball.y - 1.0);
    if (dist < min) min = dist;
  }
  // Glove reach: outstretched arm + dive bob cover ~1.1m from the root.
  assert.ok(min < 1.1, `WHAT A SAVE — glove contact (${min.toFixed(2)}m)`);
});

test('hero beat: keeper gets up with the ball and the viewer believes it', () => {
  const compiled = std();
  // After the save the keeper holds the ball at his feet through the glory
  // window — the beat BEFORE the mistake is the joke's setup.
  const glory = desc(compiled, Math.round(4.2 * 60));
  const k = actor(glory, 'Keeper');
  assert.ok(Math.hypot(glory.ball.x - k.x, glory.ball.z - k.z) < 1.2, 'ball at the keeper during the glory beat');
  assert.ok(k.armLift > 0.5, 'keeper celebrates the save');
});

test('bad clearance lands directly on the poacher, slowly (readable comedy)', () => {
  const compiled = std();
  let min = Infinity;
  for (let f = Math.round(6.9 * 60); f <= Math.round(7.1 * 60); f++) {
    const d = desc(compiled, f);
    const po = actor(d, 'Poacher');
    const dist = Math.hypot(d.ball.x - po.x, d.ball.y - 0.3, d.ball.z - po.z);
    if (dist < min) min = dist;
  }
  assert.ok(min < 1.2, `clearance straight to the poacher (${min.toFixed(2)}m)`);
  // The mistake is SLOW enough to watch — the flight must be readable, not
  // a hidden cut (this is the whole readability point of the re-cut).
  assert.ok(KEEPER_BEATS.clearanceEnd - KEEPER_BEATS.clearanceKick >= 1.0, 'clearance flight is watchable');
});

test('second shot scores; keeper collapses', () => {
  const compiled = std();
  let crossed = -1;
  for (let f = 0; f < 630; f++) {
    const prev = desc(compiled, Math.max(0, f - 1)).ball;
    const cur = desc(compiled, f).ball;
    if (prev.x <= FIELD.halfLength && cur.x > FIELD.halfLength) {
      crossed = f;
      assert.ok(Math.abs(cur.z) <= FIELD.goalHalfWidth, `inside posts (z=${cur.z.toFixed(2)})`);
      assert.ok(cur.y <= FIELD.goalHeight, `under the bar (y=${cur.y.toFixed(2)})`);
      break;
    }
  }
  assert.ok(crossed > 0, 'the robbery completes');
  assert.ok(crossed / 60 > KEEPER_BEATS.clearanceEnd, 'only after the bad clearance');
  const keeper = actor(desc(compiled, 580), 'Keeper');
  assert.ok(keeper.bob < -0.2, `keeper kneels (bob=${keeper.bob.toFixed(2)})`);
  const scorer = actor(desc(compiled, 580), 'Poacher');
  assert.ok(scorer.armLift > 1.2, 'poacher celebrates the gift');
});

test('crowd tragedy-comedy: glory tease, groan, eruption, collapse', () => {
  // Home TR attacks (attackIdx 0), away DE defends (defendIdx 1).
  const glory = evaluateKeeperCrowd(4.2, 11, 0, 1);
  assert.equal(glory.mood, 'goal');
  assert.equal(glory.scoringTeam, 1, 'keeper section erupts at the save');
  const goal = evaluateKeeperCrowd(8.8, 11, 0, 1);
  assert.equal(goal.mood, 'goal');
  assert.equal(goal.scoringTeam, 0, 'attackers erupt at the robbery');
});

test('continuity: actors glide, facings never snap', () => {
  const compiled = std();
  for (let f = 1; f < 630; f++) {
    const a = desc(compiled, f - 1), b = desc(compiled, f);
    for (let i = 0; i < a.actors.length; i++) {
      const m = Math.hypot(b.actors[i].x - a.actors[i].x, b.actors[i].z - a.actors[i].z);
      assert.ok(m < 0.6, `frame ${f} actor ${a.actors[i].name} moves ${m.toFixed(2)}m @60fps`);
      let da = Math.abs(Math.atan2(b.actors[i].facingX, b.actors[i].facingZ) - Math.atan2(a.actors[i].facingX, a.actors[i].facingZ));
      if (da > Math.PI) da = 2 * Math.PI - da;
      assert.ok(da < 0.55, `frame ${f} actor ${a.actors[i].name} turns ${(da * 180 / Math.PI).toFixed(1)}° @60fps`);
    }
  }
});

test('determinism + random access + seed variation completes the robbery', () => {
  const a = std(), b = std();
  for (const frame of [0, 150, 300, 450, 550, 629]) {
    assert.deepEqual(evaluateFrame(a, frame), evaluateFrame(b, frame));
  }
  const direct = evaluateFrame(a, 300);
  for (const f of [0, 100, 600]) evaluateFrame(a, f);
  assert.deepEqual(evaluateFrame(a, 300), direct);
  for (const seed of [12, 33]) {
    const compiled = std({ seed });
    let scored = false;
    for (let f = 480; f <= 540; f++) {
      const ball = desc(compiled, f).ball;
      if (ball.x > FIELD.halfLength && Math.abs(ball.z) < FIELD.goalHalfWidth && ball.y < FIELD.goalHeight) {
        scored = true;
        break;
      }
    }
    assert.ok(scored, `seed ${seed} completes the robbery`);
  }
});
