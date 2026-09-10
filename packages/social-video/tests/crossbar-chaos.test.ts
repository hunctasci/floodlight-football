import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from '../../../apps/game/src/types.ts';
import { compileVideo, evaluateFrame, type CompiledSocialVideo } from '../src/timeline.ts';
import {
  CROSSBAR_BEATS, evaluateChaosCrowd, type CrossbarFrameDescription,
} from '../src/scenes/crossbar-chaos.ts';

const std = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'crossbar-chaos', home: 'BR', away: 'AR', seed: 7, fps: 60, ...extra });

function desc(compiled: CompiledSocialVideo, frame: number): CrossbarFrameDescription {
  const d = evaluateFrame(compiled, frame);
  if (d.scene !== 'crossbar-chaos') throw new Error(`expected crossbar-chaos, got ${d.scene}`);
  return d;
}

function actor(d: CrossbarFrameDescription, name: string): CrossbarFrameDescription['actors'][number] {
  const found = d.actors.find((a) => a.name === name);
  assert.ok(found, `actor ${name} exists`);
  return found;
}

function barDistance(b: { x: number; y: number; z: number }): number {
  const dz = Math.min(FIELD.goalHalfWidth, Math.max(-FIELD.goalHalfWidth, b.z));
  return Math.hypot(b.x - FIELD.halfLength, b.y - FIELD.goalHeight, b.z - dz);
}

test('first shot contacts the crossbar', () => {
  const compiled = std();
  let min = Infinity;
  for (let f = Math.round(0.9 * 60); f <= Math.round(2.0 * 60); f++) {
    const dist = barDistance(desc(compiled, f).ball);
    if (dist < min) min = dist;
  }
  assert.ok(min < 0.45, `bar contact unmistakable (${min.toFixed(2)}m)`);
});

test('rebound launches high and away from the bar', () => {
  const compiled = std();
  const mid = desc(compiled, Math.round(2.3 * 60)).ball;
  assert.ok(mid.y > 4, `ball flies high (${mid.y.toFixed(1)}m)`);
  assert.ok(barDistance(mid) > 2, 'well clear of the bar');
});

test('second action (volley) scores through the mouth', () => {
  const compiled = std();
  const vc = desc(compiled, Math.round(CROSSBAR_BEATS.volleyContact * 60));
  const poacher = actor(vc, 'Poacher');
  assert.ok(Math.hypot(vc.ball.x - poacher.x, vc.ball.z - poacher.z) < 1.0, 'poacher meets the drop');
  let crossed = -1;
  for (let f = 0; f < 360; f++) {
    const prev = desc(compiled, Math.max(0, f - 1)).ball;
    const cur = desc(compiled, f).ball;
    if (prev.x <= FIELD.halfLength && cur.x > FIELD.halfLength) {
      crossed = f;
      assert.ok(Math.abs(cur.z) <= FIELD.goalHalfWidth, `inside posts (z=${cur.z.toFixed(2)})`);
      assert.ok(cur.y <= FIELD.goalHeight, `under the bar (y=${cur.y.toFixed(2)})`);
      break;
    }
  }
  assert.ok(crossed > 0, 'rebound crosses the goal line');
  assert.ok(crossed / 60 > CROSSBAR_BEATS.volleyContact, 'only the second action scores');
});

test('crowd comedy: false dawn, gasp, double eruption', () => {
  assert.equal(evaluateChaosCrowd(1.0, 7, 0).mood, 'anticipation');
  const dawn = evaluateChaosCrowd(1.75, 7, 0);
  assert.equal(dawn.mood, 'goal', 'supporters jump as the ball looks in');
  assert.equal(dawn.scoringTeam, 0);
  assert.equal(evaluateChaosCrowd(2.5, 7, 0).mood, 'anticipation', 'frozen gasp while it hangs');
  const real = evaluateChaosCrowd(4.2, 7, 0);
  assert.equal(real.mood, 'goal', 'real eruption on the rebound');
});

test('keeper scrambles and ends kneeling; defender freezes', () => {
  const compiled = std();
  const frozen = actor(desc(compiled, Math.round(2.2 * 60)), 'Defender');
  assert.ok(frozen.armLift > 1.5, 'defender frozen hands-on-head');
  const end = actor(desc(compiled, 330), 'Keeper');
  assert.ok(end.bob < -0.2, `keeper kneels in despair (bob=${end.bob.toFixed(2)})`);
});

test('continuity: actors glide, facings never snap', () => {
  const compiled = std();
  for (let f = 1; f < 360; f++) {
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

test('determinism + random access + seed variation scores', () => {
  const a = std(), b = std();
  for (const frame of [0, 96, 200, 231, 300, 359]) {
    assert.deepEqual(evaluateFrame(a, frame), evaluateFrame(b, frame));
  }
  const direct = evaluateFrame(a, 231);
  for (const f of [0, 150, 359]) evaluateFrame(a, f);
  assert.deepEqual(evaluateFrame(a, 231), direct);
  for (const seed of [8, 21]) {
    const compiled = std({ seed });
    let scored = false;
    for (let f = 200; f <= 260; f++) {
      const ball = desc(compiled, f).ball;
      if (ball.x > FIELD.halfLength && Math.abs(ball.z) < FIELD.goalHalfWidth && ball.y < FIELD.goalHeight) {
        scored = true;
        break;
      }
    }
    assert.ok(scored, `seed ${seed} scores the rebound`);
  }
});
