import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD } from '../src/types.ts';

const DT = 1 / 60;
function step(g: MatchEngine, input = {}, peer = {}) {
  g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
  g.events.splice(0);
}
/** Team 0 attacks +x; team-1 keeper guards, shooter placed, rest parked off-lane. */
function duel(seed = 7, sx = 32, sz = 0, kz = 0) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.x = -30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const keeper = s.players.find((p) => p.team === 1 && p.keeper)!;
  keeper.x = 43.5; keeper.z = kz; keeper.vx = keeper.vz = 0; keeper.cooldown = 0;
  const shooter = s.players.find((p) => p.team === 0 && !p.keeper)!;
  s.controlled = shooter.id;
  shooter.x = sx; shooter.z = sz; shooter.facingX = 1; shooter.facingZ = 0;
  Object.assign(s.ball, {
    x: sx + 0.7, y: FIELD.ballRadius, z: sz, vx: 0, vy: 0, vz: 0,
    owner: shooter.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  return { g, s, keeper, shooter };
}
function shoot(g: MatchEngine, aimU: number, aimV: number, hold = 0.3) {
  step(g, { aimU, aimV, shootPressed: true, shootHeld: true });
  const n = Math.max(0, Math.round((hold - DT) / DT));
  for (let i = 0; i < n; i++) step(g, { aimU, aimV, shootHeld: true });
  step(g, { aimU, aimV, shootReleased: true });
}
function settle(g: MatchEngine, seconds: number): string[] {
  const types: string[] = [];
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    g.update(DT, { ...EMPTY_INPUT });
    for (const e of g.events.splice(0)) types.push(e.type);
  }
  return types;
}

test('P0.4b slow central shot is caught cleanly', () => {
  const { g, s, keeper } = duel(7, 34, 0, 0);
  shoot(g, 0, 0, 0.1);
  // Catch happens on arrival (~0.3s); the keeper then distributes (correct).
  let held = false;
  for (let i = 0; i < 40; i++) {
    step(g, {});
    if (s.ball.owner === keeper.id) { held = true; break; }
  }
  assert.ok(held, 'comfortable take held, not spilled');
});

test('P0.4b point-blank rocket beats the reaction window', () => {
  const { g, s } = duel(8, 41, 0, 0);
  // Instant tap: no time to smother, no time to react.
  shoot(g, 0.3, 0, 0.05);
  const before = s.score[0];
  const events = settle(g, 1.2);
  assert.equal(s.score[0], before + 1, 'unsavable finish scores');
  assert.ok(!events.includes('save'), 'no phantom save without reaction time');
});

test('P0.4b far corner from a central striker scores (no miracle reach)', () => {
  const { g, s } = duel(9, 32, 0, 0);
  shoot(g, -0.65, 0, 0.35);
  const before = s.score[0];
  settle(g, 1.5);
  assert.equal(s.score[0], before + 1, 'placed corner beats a central keeper');
});

test('P0.4b near-corner rocket is parried when the dive reaches, rebound live', () => {
  const { g, s } = duel(10, 33, 2, 0);
  shoot(g, 0.55, 0, 0.4);
  const events = settle(g, 1.2);
  assert.ok(events.includes('save'), 'stretched keeper gets a hand to it');
  assert.equal(s.phase, 'playing', 'parry stays in play, not a goal');
  assert.equal(s.ball.owner, null, 'parry spills to a live rebound');
  // A nearby attacker can contest the rebound once the lock expires.
  const poacher = s.players.find((p) => p.team === 0 && !p.keeper && p.id !== s.controlled)!;
  poacher.x = s.ball.x + 0.4; poacher.z = s.ball.z; poacher.vx = poacher.vz = 0;
  let took = false;
  for (let i = 0; i < 90; i++) {
    step(g, {});
    if (s.ball.owner === poacher.id) { took = true; break; }
  }
  assert.ok(took, 'rebound is contestable, never instantly re-caught');
});

test('P0.4b wrong-footed keeper concedes the far side', () => {
  const { g, s } = duel(11, 32, 0, 3);
  shoot(g, -0.65, 0, 0.35);
  const before = s.score[0];
  settle(g, 1.5);
  assert.equal(s.score[0], before + 1, 'shot behind a shaded keeper scores');
});

test('P0.4b deliberate miss draws no save and no goal', () => {
  const { g, s } = duel(12, 32, 0, 0);
  shoot(g, 1.0, 0, 0.35);
  const events = settle(g, 2.0);
  assert.ok(!events.includes('save'), 'no save without contact');
  assert.equal(s.score[0], 0, 'wide stays wide');
});

test('P0.4b smother is a committed dive, not a claim aura', () => {
  const g = new MatchEngine(0, 180, 13);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.x = -30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const keeper = s.players.find((p) => p.team === 1 && p.keeper)!;
  keeper.x = 43; keeper.z = 0; keeper.vx = keeper.vz = 0; keeper.cooldown = 0;
  const carrier = s.players.find((p) => p.team === 0 && !p.keeper)!;
  s.controlled = carrier.id;
  carrier.x = 40; carrier.z = 0; carrier.facingX = 1; carrier.facingZ = 0;
  Object.assign(s.ball, {
    x: 40.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: carrier.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  // Walk the ball into the keeper's reach.
  let dived = false;
  for (let i = 0; i < 150; i++) {
    step(g, { x: 1 });
    if (keeper.action === 'dive') dived = true;
    if (s.ball.owner === keeper.id) break;
  }
  assert.ok(dived, 'keeper throws himself at the ball (committed dive)');
  assert.equal(s.ball.owner, keeper.id, 'smother gathers a slow close ball');
});

test('P0.4b varied 12–18m chances: strong but beatable (no clean sweep either way)', () => {
  // 2 central (usually held) + 4 placed corners (usually score).
  const chances: Array<[number, number, number, number]> = [
    [34, 0, 0, 0.05],
    [32, 1, 0, 0.1],
    [32, 0, -0.65, 0],
    [32, 0, 0.65, 0],
    [30, -2, 0.65, 0.1],
    [30, 2, -0.65, 0.55],
  ];
  let goals = 0;
  for (let k = 0; k < chances.length; k++) {
    const [sx, sz, aimU, aimV] = chances[k];
    const { g, s } = duel(100 + k, sx, sz, 0);
    shoot(g, aimU, aimV, 0.35);
    const before = s.score[0];
    settle(g, 1.6);
    if (s.score[0] > before) goals++;
  }
  assert.ok(goals >= 2 && goals <= 5, `keeper holds some, concedes some (${goals}/6 goals)`);
});
