import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
function step(g: MatchEngine, input: Partial<InputFrame> = {}, peer: Partial<InputFrame> = {}) {
  g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
  g.events.splice(0);
}
/** Carrier holds the ball; our controlled defender stands off facing him. */
function duel(seed = 42, gap = 1.8) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.x = p.team ? 36 : -36; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const victim = s.players.find((p) => p.team === 1 && !p.keeper)!;
  victim.x = 5; victim.z = 0; victim.facingX = -1; victim.facingZ = 0; victim.think = 100;
  Object.assign(s.ball, {
    x: 5 - 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0, spin: 0,
    owner: victim.id, lastKicker: null, lock: 0, lastTouch: 1, flight: 'roll',
  });
  const hero = s.players.find((p) => p.team === 0 && !p.keeper)!;
  s.controlled = hero.id; hero.x = 5 - gap; hero.z = 0; hero.facingX = 1; hero.facingZ = 0;
  return { g, s, hero, victim };
}

test('P0.5 standing challenge wins aligned contact with no dice and no transfer', () => {
  for (const seed of [42, 43]) {
    const { g, s, hero, victim } = duel(seed, 1.6);
    // Victim holds still (facing the defender, ball between them).
    victim.vx = victim.vz = 0;
    step(g, { pass: true });
    let won = s.ball.owner === null;
    for (let i = 0; i < 30 && !won; i++) {
      victim.vx = victim.vz = 0;
      step(g, {});
      won = s.ball.owner === null;
    }
    assert.ok(won, `aligned lunge knocks it loose (seed ${seed})`);
    assert.equal(s.ball.owner, null, 'no direct ownership transfer from a tackle');
    assert.ok(hero.cooldown <= 0.5 && hero.cooldown >= 0, 'quick recovery, brief commitment');
  }
});

test('P0.5 same aligned challenge, same outcome for every seed', () => {
  const outcomes: string[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const { g, s, hero, victim } = duel(seed, 1.6);
    victim.vx = victim.vz = 0;
    step(g, { pass: true });
    for (let i = 0; i < 30; i++) { victim.vx = victim.vz = 0; step(g, {}); }
    outcomes.push(`${s.ball.owner}|${victim.action}|${hero.action}`);
  }
  for (const o of outcomes) assert.equal(o, outcomes[0], `geometry decides, not RNG (${o})`);
});

test('P0.5 standing miss recovers quickly', () => {
  const { g, s, hero, victim } = duel(44, 1.6);
  // Victim sidesteps out of the lane before the lunge lands.
  victim.z = 3; victim.vx = victim.vz = 0;
  Object.assign(s.ball, { x: victim.x - 0.7, z: 3, owner: victim.id });
  step(g, { pass: true });
  for (let i = 0; i < 40; i++) step(g, {});
  assert.notEqual(hero.action, 'tackle', 'lunge finishes');
  assert.equal(hero.cooldown, 0, 'recovered fast after a miss');
  assert.equal(s.ball.owner, victim.id, 'clean miss keeps the carrier going');
});

test('P0.5 late slide intersection wins the ball after launch', () => {
  const { g, s, hero, victim } = duel(42, 2.6);
  victim.think = 100;
  // FIFA defense: A (Square / cross) is the slide tackle.
  step(g, { cross: true });
  assert.equal(hero.action, 'slide', 'tackler commits to the slide');
  assert.notEqual(s.ball.owner, null, 'no instant win from outside range');
  // Scripted straight-line runner head-on: isolates the swept slide capsule
  // from AI dodging (dodging beats slides — covered by the miss test).
  let won = false;
  for (let i = 0; i < 45; i++) {
    victim.x -= 7.4 * DT; victim.z = 0; victim.vx = -7.4; victim.vz = 0;
    Object.assign(s.ball, { x: victim.x - 0.7, z: 0, owner: victim.id });
    step(g, {});
    if (s.ball.owner === null) { won = true; break; }
  }
  assert.ok(won, 'slide travels into the ball and wins it late');
  assert.equal(victim.action, 'fallen', 'ball-first contact floors the carrier');
});

test('P0.5 slide that misses the lane wins nothing', () => {
  const { g, s, hero, victim } = duel(45, 2.2);
  victim.z = 4; victim.vx = victim.vz = 0;
  Object.assign(s.ball, { x: victim.x - 0.7, z: 4, owner: victim.id });
  hero.z = 0;
  step(g, { cross: true });
  for (let i = 0; i < 60; i++) step(g, {});
  assert.equal(s.ball.owner, victim.id, 'clean slide miss keeps possession');
  assert.notEqual(hero.action, 'slide', 'slider eventually recovers');
});

test('P0.5 sliding player glides locked, then recovers', () => {
  const { g, s, hero } = duel(42, 2.6);
  step(g, { cross: true });
  const x0 = hero.x;
  for (let i = 0; i < 21; i++) step(g, {});
  assert.ok(hero.x > x0 + 0.6, `slide glides forward (dx=${(hero.x - x0).toFixed(2)})`);
  for (let i = 0; i < 60; i++) step(g, {});
  assert.notEqual(hero.action, 'slide', 'tackler recovers');
  assert.equal(hero.cooldown, 0, 'commitment ends, no cinematic punishment');
});

test('P0.5 FIFA defense: D (Circle) is a standing tackle, A (Square) is the slide', () => {
  // D standing: same aligned duel, Circle press lunges without sliding.
  {
    const { g, s, hero } = duel(42, 1.6);
    step(g, { shootPressed: true });
    assert.equal(hero.action, 'tackle', 'D commits to a standing challenge, not a slide');
    assert.notEqual(hero.action, 'slide', 'no slide from the Circle button');
    void s;
  }
  // W (Triangle) rush: pressure lunge, never a slide, never dead.
  {
    const { g, hero } = duel(42, 1.6);
    step(g, { through: true });
    assert.equal(hero.action, 'tackle', 'W commits to a pressure challenge');
    assert.notEqual(hero.action, 'slide', 'no slide from the Triangle button');
  }
  // A slide: Square press commits to the slide (covered above, asserted here).
  {
    const { g, hero } = duel(42, 2.6);
    step(g, { cross: true });
    assert.equal(hero.action, 'slide', 'A commits to the slide');
  }
});

test('P0.5 a knocked-down player cannot collect the ball while down', () => {
  const { g, s, hero, victim } = duel(42, 2.6);
  step(g, { cross: true });
  let down = false;
  for (let i = 0; i < 45; i++) {
    victim.x -= 7.4 * DT; victim.z = 0; victim.vx = -7.4; victim.vz = 0;
    if (s.ball.owner === victim.id) Object.assign(s.ball, { x: victim.x - 0.7, z: 0 });
    step(g, {});
    if (victim.action === 'fallen') { down = true; break; }
  }
  assert.ok(down, 'carrier floored by the slide');
  hero.x = -30; hero.vx = hero.vz = 0; hero.action = 'idle'; hero.actionTime = 0; hero.cooldown = 0;
  Object.assign(s.ball, { x: victim.x + 0.5, z: victim.z, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: null, lock: 0, lastTouch: 0, lastKicker: null, flight: 'roll' });
  for (let i = 0; i < 18; i++) step(g, {});
  assert.equal(s.ball.owner, null, 'ball untouched by the fallen player');
  for (let i = 0; i < 60; i++) step(g, {});
  assert.equal(s.ball.owner, victim.id, 'recovered player can collect again');
});
