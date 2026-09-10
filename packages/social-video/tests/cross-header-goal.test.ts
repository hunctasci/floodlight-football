import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from '../../../apps/game/src/types.ts';
import { compileVideo, evaluateFrame, type CompiledSocialVideo } from '../src/timeline.ts';
import {
  CROSS_HEADER_BEATS, evaluateCrossCrowd, type CrossHeaderFrameDescription,
} from '../src/scenes/cross-header-goal.ts';
import { resolveVideoSpec } from '../src/schema.ts';

const std = (extra: Record<string, unknown> = {}) =>
  compileVideo({ scene: 'cross-header-goal', home: 'TR', away: 'GR', seed: 42, fps: 60, ...extra });

function desc(compiled: CompiledSocialVideo, frame: number): CrossHeaderFrameDescription {
  const d = evaluateFrame(compiled, frame);
  if (d.scene !== 'cross-header-goal') throw new Error(`expected cross-header-goal, got ${d.scene}`);
  return d;
}

function actor(d: CrossHeaderFrameDescription, name: string): CrossHeaderFrameDescription['actors'][number] {
  const found = d.actors.find((a) => a.name === name);
  assert.ok(found, `actor ${name} exists`);
  return found;
}

test('cross-header-goal defaults: 8s, production 60fps recommended', () => {
  const spec = resolveVideoSpec({ scene: 'cross-header-goal', home: 'TR', away: 'GR' });
  assert.equal(spec.duration, 8);
  assert.equal(spec.totalFrames, 240); // explicit 30fps still supported for previews
  const prod = resolveVideoSpec({ scene: 'cross-header-goal', home: 'TR', away: 'GR', fps: 60 });
  assert.equal(prod.totalFrames, 480);
});

test('buildup: midfielder feeds the winger, then the winger carries', () => {
  const compiled = std();
  // Ball starts with the midfielder, travels to the winger on the pass.
  const start = desc(compiled, 0);
  assert.ok(Math.hypot(start.ball.x - actor(start, 'Midfielder').x, start.ball.z - actor(start, 'Midfielder').z) < 1.5, 'ball starts with the midfielder');
  const mid = desc(compiled, Math.round(1.45 * 60));
  const release = desc(compiled, Math.round(1.15 * 60)).ball;
  const recv = actor(desc(compiled, Math.round(CROSS_HEADER_BEATS.passEnd * 60)), 'Winger');
  assert.ok(mid.ball.x > release.x && mid.ball.x < recv.x, 'ball is mid-pass, between passer and winger');
  const caught = desc(compiled, Math.round(CROSS_HEADER_BEATS.passEnd * 60));
  const winger = actor(caught, 'Winger');
  assert.ok(Math.hypot(caught.ball.x - winger.x, caught.ball.z - winger.z) < 1.2, 'winger receives the wide pass');
});

test('cross reaches the striker: contact is exact, header meets ball', () => {
  const compiled = std();
  const fc = Math.round(CROSS_HEADER_BEATS.contact * 60);
  const d = desc(compiled, fc);
  const striker = actor(d, 'Striker');
  assert.ok(Math.hypot(d.ball.x - striker.x, d.ball.z - striker.z) < 0.3, 'ball at the striker');
  const headY = 1.7 + striker.bob;
  const dh = Math.hypot(d.ball.x - striker.x, d.ball.y - headY, d.ball.z - striker.z);
  assert.ok(dh < 0.6, `header contact valid (${dh.toFixed(2)}m)`);
  assert.ok(striker.bob > 0.2, 'striker is airborne at contact');
});

test('header scores through the mouth, keeper misses', () => {
  const compiled = std();
  let crossed = -1;
  for (let f = 0; f < 480; f++) {
    const prev = desc(compiled, Math.max(0, f - 1)).ball;
    const cur = desc(compiled, f).ball;
    if (prev.x <= FIELD.halfLength && cur.x > FIELD.halfLength) {
      crossed = f;
      assert.ok(Math.abs(cur.z) <= FIELD.goalHalfWidth, `inside posts (z=${cur.z.toFixed(2)})`);
      assert.ok(cur.y <= FIELD.goalHeight, `under the bar (y=${cur.y.toFixed(2)})`);
      break;
    }
  }
  assert.ok(crossed > 0, 'header crosses the goal line');
  let min = Infinity;
  for (let f = Math.round(5.6 * 60); f <= Math.round(6.6 * 60); f++) {
    const dd = desc(compiled, f);
    const k = actor(dd, 'Keeper');
    const dist = Math.hypot(dd.ball.x - k.x, dd.ball.z - k.z, dd.ball.y - 1.0);
    if (dist < min) min = dist;
  }
  assert.ok(min > 0.75, `keeper misses the header (${min.toFixed(2)}m)`);
});

test('ball-near-lens insert stays dramatic without clipping', () => {
  const compiled = std();
  assert.ok(compiled.crossHeader, 'staging present');
  const lens = compiled.crossHeader.lensPos;
  let min = Infinity;
  for (let f = Math.round(4.15 * 60); f <= Math.round(4.5 * 60); f++) {
    const b = desc(compiled, f).ball;
    const dist = Math.hypot(b.x - lens.x, b.y - lens.y, b.z - lens.z);
    if (dist < min) min = dist;
  }
  assert.ok(min > 0.5, `never clips the near plane (${min.toFixed(2)}m)`);
  assert.ok(min < 6, `stays dramatic (${min.toFixed(2)}m)`);
});

test('crowd story: wave builds, anticipation rises, eruption on goal', () => {
  assert.equal(evaluateCrossCrowd(0.5, 42, 0).mood, 'wave');
  assert.equal(evaluateCrossCrowd(3.0, 42, 0).mood, 'wave', 'wave holds through the buildup');
  const ante = evaluateCrossCrowd(4.6, 42, 0);
  assert.equal(ante.mood, 'anticipation');
  assert.ok(ante.intensity > 0.5, 'anticipation builds during the flight');
  const goal = evaluateCrossCrowd(6.5, 42, 0);
  assert.equal(goal.mood, 'goal');
  assert.equal(goal.scoringTeam, 0);
});

test('continuity: actors glide, facings never snap', () => {
  const compiled = std();
  for (let f = 1; f < 480; f++) {
    const a = desc(compiled, f - 1), b = desc(compiled, f);
    for (let i = 0; i < a.actors.length; i++) {
      const m = Math.hypot(b.actors[i].x - a.actors[i].x, b.actors[i].z - a.actors[i].z);
      assert.ok(m < 0.6, `frame ${f} actor ${a.actors[i].name} moves ${m.toFixed(2)}m @60fps`);
      let da = Math.abs(Math.atan2(b.actors[i].facingX, b.actors[i].facingZ) - Math.atan2(a.actors[i].facingX, a.actors[i].facingZ));
      if (da > Math.PI) da = 2 * Math.PI - da;
      assert.ok(da < 0.3, `frame ${f} actor ${a.actors[i].name} turns ${(da * 180 / Math.PI).toFixed(1)}° @60fps`);
    }
  }
});

test('determinism + random access + away mirror', () => {
  const a = std(), b = std();
  for (const frame of [0, 100, 200, 300, 400, 479]) {
    assert.deepEqual(evaluateFrame(a, frame), evaluateFrame(b, frame));
  }
  const direct = evaluateFrame(a, 300);
  for (const f of [0, 100, 400, 50]) evaluateFrame(a, f);
  assert.deepEqual(evaluateFrame(a, 300), direct);
  const away = std({ attackTeam: 'away' });
  const dd = desc(away, 400);
  assert.ok(dd.ball.x < -FIELD.halfLength, 'away attack mirrors onto the far goal');
  assert.equal(actor(dd, 'Striker').team, 1);
});

test('seed variation still scores', () => {
  for (const seed of [43, 7, 99]) {
    const compiled = std({ seed });
    let scored = false;
    for (let f = 330; f <= 400; f++) {
      const ball = desc(compiled, f).ball;
      if (ball.x > FIELD.halfLength && Math.abs(ball.z) < FIELD.goalHalfWidth && ball.y < FIELD.goalHeight) {
        scored = true;
        break;
      }
    }
    assert.ok(scored, `seed ${seed} scores`);
  }
});
