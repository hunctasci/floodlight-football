import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { frameAtMomentTime, momentTimeAt, remapInverse, remapProgress, TIME_RAMP_IDS } from '../src/animation/time-ramp';
import { shotLensRaw } from '../src/camera/evaluate';
import { compileContent } from '../src/engine/director/compile';
import { HNC_HERO } from '../src/content/hnc-hero';
import { HERO_ATTACK, sampleHeroAttack } from '../src/worlds/football/hero-attack';
import { CAMERA_MOVE_IDS, DEFAULT_LENS_ANCHORS, evaluateCameraMove } from '../src/worlds/football/lenses';

describe('time ramps', () => {
  it('are monotone with exact endpoints and invertible', () => {
    for (const id of TIME_RAMP_IDS) {
      assert.equal(remapProgress(id, 0), 0);
      assert.ok(Math.abs(remapProgress(id, 1) - 1) < 1e-12);
      let prev = -1;
      for (let u = 0; u <= 1.0001; u += 0.01) {
        const p = remapProgress(id, u);
        assert.ok(p >= prev - 1e-12, `${id} not monotone at ${u}`);
        prev = p;
        assert.ok(Math.abs(remapProgress(id, remapInverse(id, p)) - p) < 1e-6);
      }
    }
  });
  it('anticipation-snap slows the middle and snaps back', () => {
    const slope = (u: number) => (remapProgress('anticipation-snap', u + 0.01) - remapProgress('anticipation-snap', u)) / 0.01;
    assert.ok(slope(0.4) < 0.7);
    assert.ok(slope(0.85) > 1.2);
  });
  it('moment clock lands on `to` at the next shot boundary', () => {
    const clock = { from: 5.5, to: 6.5, length: 12, ramp: 'anticipation-snap' as const };
    assert.equal(momentTimeAt(clock, 0, 78), 5.5);
    assert.ok(Math.abs(momentTimeAt(clock, 78, 78) - 6.5) < 1e-12);
    const f = frameAtMomentTime(clock, 6.1, 78);
    assert.ok(Math.abs(momentTimeAt(clock, f, 78) - 6.1) < 0.02);
  });
});

describe('hero-attack choreography', () => {
  it('is deterministic and stays inside the canonical world', () => {
    for (let t = 0; t <= HERO_ATTACK.length; t += 0.05) {
      const a = sampleHeroAttack(t);
      assert.deepEqual(a, sampleHeroAttack(t));
      assert.ok(Math.abs(a.ball.x) < 50 && Math.abs(a.ball.z) < 30, `ball out at ${t}`);
      for (const actor of a.actors) assert.ok(Math.abs(actor.x) < 50 && Math.abs(actor.z) < 30 && Number.isFinite(actor.facing));
    }
  });
  it('scores under the bar and between the posts', () => {
    const b = sampleHeroAttack(HERO_ATTACK.goalLine).ball;
    assert.ok(Math.abs(b.x - 46) < 1e-9 && b.y + 0.25 < 2.8 && Math.abs(b.z) + 0.25 < 4.4);
    const net = sampleHeroAttack(HERO_ATTACK.netHit).ball;
    assert.ok(net.x > 46 && net.x < 48.21);
  });
  it('strikes the ball it dribbled and dives within game bounds', () => {
    const c = sampleHeroAttack(HERO_ATTACK.contact);
    assert.ok(Math.hypot(c.ball.x - c.anchors!.hero.x, c.ball.z - c.anchors!.hero.z) < 0.6);
    const k0 = sampleHeroAttack(HERO_ATTACK.keeperDive).anchors!.keeper!;
    const k1 = sampleHeroAttack(HERO_ATTACK.keeperDive + 1).anchors!.keeper!;
    assert.ok(Math.abs(k1.z - k0.z) <= 2.4);
  });
  it('uses canonical game actions and celebrations', () => {
    const actions = new Set<string>();
    for (let t = 0; t <= HERO_ATTACK.length; t += 0.02) for (const a of sampleHeroAttack(t).actors) if (a.pose) actions.add(a.pose.action);
    for (const act of ['idle', 'run', 'kick', 'slide', 'dive']) assert.ok(actions.has(act), act);
    assert.equal(sampleHeroAttack(HERO_ATTACK.celebrate + 0.2).actors[0].pose!.celebrating, true);
  });
});

describe('football world lenses', () => {
  const tl = compileContent(HNC_HERO);
  it('every anchored move evaluates to finite lenses', () => {
    for (const id of CAMERA_MOVE_IDS) for (const u of [0, 0.5, 1]) {
      const l = evaluateCameraMove(id, u, DEFAULT_LENS_ANCHORS);
      assert.ok([l.pos.x, l.pos.y, l.pos.z, l.look.x, l.look.y, l.look.z, l.fov].every(Number.isFinite), `${id}@${u}`);
    }
  });
  it('designed continuous handovers have no camera jump', () => {
    for (const cam of ['faceoff-depth-push', 'runner-burst', 'striker-windup', 'crane-out', 'stadium-drift']) {
      const i = tl.shots.findIndex((s) => s.camera.lens === cam);
      const prev = tl.shots[i - 1];
      const next = tl.shots[i];
      const a = shotLensRaw(tl, prev, next.start);
      const b = shotLensRaw(tl, next, next.start);
      const jump = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y, a.pos.z - b.pos.z);
      assert.ok(jump < 0.05, `${prev.id} -> ${next.id} jumps ${jump.toFixed(3)}m`);
    }
  });
  it('camera never enters the end stand or the grass', () => {
    for (const shot of tl.shots) for (let f = shot.start; f < shot.start + shot.duration; f += 3) {
      const p = shotLensRaw(tl, shot, f).pos;
      assert.ok(p.x < 50.45 && p.y > 0.3, `${shot.id}@${f}`);
    }
  });
});
