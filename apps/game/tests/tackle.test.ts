import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds = DT, input: Partial<InputFrame> = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input });
};
/** Carrier dribbles at (5,0); our controlled defender stands facing him. */
function duel(seed = 42) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.x = p.team ? 36 : -36; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const victim = s.players.find(p => p.team === 1 && !p.keeper)!;
  victim.x = 5; victim.z = 0; victim.facingX = -1; victim.facingZ = 0;
  Object.assign(s.ball, { x: 5.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, owner: victim.id, lastKicker: null, lock: 0, lastTouch: 1, flight: 'roll' });
  const hero = s.players.find(p => p.team === 0 && !p.keeper)!;
  s.controlled = hero.id; hero.x = 3.2; hero.z = 0; hero.facingX = 1; hero.facingZ = 0;
  return { g, s, hero, victim };
}

test('slide tackle knocks the carrier down and commits the slider', () => {
  const { g, s, hero, victim } = duel(42);
  tick(g, DT, { shootPressed: true }); // no possession → slide tackle
  assert.equal(s.ball.owner, null, 'slide wins the ball');
  assert.equal(hero.action, 'slide', 'tackler commits to the slide');
  assert.equal(victim.action, 'fallen', 'carrier is knocked down');
  assert.ok(victim.cooldown > .6, 'victim stays down a while');
});

test('sliding player glides with locked momentum, then recovers', () => {
  const { g, s, hero } = duel(42);
  tick(g, DT, { shootPressed: true });
  const x0 = hero.x;
  tick(g, .35); // no input at all
  assert.ok(hero.x > x0 + .6, `slide glides forward (dx=${(hero.x - x0).toFixed(2)})`);
  tick(g, .8);
  assert.notEqual(hero.action, 'slide', 'tackler recovers');
  assert.ok(hero.cooldown === 0 || hero.action !== 'slide', 'recovered');
});

test('a knocked-down player cannot collect the ball while down', () => {
  const { g, s, hero, victim } = duel(42);
  tick(g, DT, { shootPressed: true });
  assert.equal(victim.action, 'fallen');
  hero.x = -30; hero.vx = hero.vz = 0; hero.action = 'idle'; hero.actionTime = 0; hero.cooldown = 0;
  Object.assign(s.ball, { x: victim.x + .5, z: victim.z, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: null, lock: 0, lastTouch: 0, lastKicker: null, flight: 'roll' });
  tick(g, .3);
  assert.equal(s.ball.owner, null, 'ball untouched by the fallen player');
  tick(g, .6); // after getting up
  assert.equal(s.ball.owner, victim.id, 'recovered player can collect again');
});
