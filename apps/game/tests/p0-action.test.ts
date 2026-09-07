import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds = DT, input = {}, peer = {}) => {
  const n = Math.ceil(seconds / DT);
  for (let i = 0; i < n; i++) g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
};
function carrier(seed = 7) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) {
    p.x = p.team ? 36 : -36; p.z = -25 + (p.id % 11) * 4.5;
    p.vx = p.vz = 0; p.cooldown = 0; p.think = 100;
  }
  const p = s.players.find((q) => q.team === s.humanTeam && !q.keeper)!;
  s.controlled = p.id; p.x = 0; p.z = 0; p.facingX = 1; p.facingZ = 0;
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  return { g, s, p };
}

test('P0.1 keeper PASS distributes exactly once even when held', () => {
  const g = new MatchEngine(0, 180, 11);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  const k = s.players.find((p) => p.team === 0 && p.keeper)!;
  k.x = k.homeX; k.z = 0; k.vx = k.vz = 0; k.cooldown = 0;
  Object.assign(s.ball, {
    x: k.x + 0.5, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0,
    owner: k.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
  });
  const mates = s.players.filter((p) => p.team === 0 && !p.keeper);
  mates[0].x = k.x + 2; mates[0].z = 10; mates[0].vx = mates[0].vz = 0;
  for (const p of s.players) if (p.team === 1 && !p.keeper) { p.x = 20; p.z = 20; p.think = 100; }
  s.controlled = mates[1].id;
  // Press AND hold PASS for half a second: one edge, one distribution.
  tick(g, DT, { x: 0, z: 1, pass: true, passHeld: true });
  let kicks = g.events.filter((e) => e.type === 'kick').length;
  assert.equal(kicks, 1, 'exactly one distribution from the press edge');
  for (let i = 0; i < 30; i++) {
    g.update(DT, { ...EMPTY_INPUT, x: 0, z: 1, passHeld: true });
    kicks += g.events.filter((e) => e.type === 'kick').length;
    g.events.splice(0);
  }
  assert.equal(kicks, 1, 'the held button never re-fires after control transferred');
  assert.notEqual(s.ball.owner, k.id, 'keeper released the ball');
});

test('P0.1 held SHOOT cancelled by possession loss: no shot, no slide', () => {
  const { g, s, p } = carrier(21);
  // Start charging a shot.
  tick(g, DT, { x: 1, shootPressed: true, shootHeld: true });
  tick(g, 0.1, { x: 1, shootHeld: true });
  assert.equal(g.actionOf(0).action, 'shot', 'shot gesture captured');
  // Possession lost mid-charge (ball knocked loose and away).
  Object.assign(s.ball, { owner: null, x: 9, z: 6, vx: 0, vz: 0, lock: 0, lastTouch: 1 });
  p.x = 0; p.z = 0;
  // Keep holding, then release: the stale gesture must die quietly.
  tick(g, 0.1, { x: 1, shootHeld: true });
  assert.equal(g.actionOf(0).action, null, 'stale gesture cancelled on possession loss');
  tick(g, DT, { x: 1, shootReleased: true });
  const shots = g.events.filter((e) => e.type === 'shot').length;
  const tackles = g.events.filter((e) => e.type === 'tackle').length;
  assert.equal(shots, 0, 'no shot without the ball');
  assert.equal(tackles, 0, 'release never becomes a defensive slide');
  assert.notEqual(s.players[s.controlled].action, 'slide', 'no slide committed');
});

test('P0.1 release edge without a preceding press is not an action', () => {
  const { g, s } = carrier(22);
  // Defender setup: nobody owns the ball.
  Object.assign(s.ball, { owner: null, x: 20, z: 20, vx: 0, vz: 0, lock: 0 });
  const before = s.players[s.controlled].action;
  tick(g, DT, { shootReleased: true });
  assert.equal(g.events.filter((e) => e.type === 'tackle').length, 0, 'no tackle from a bare release');
  assert.equal(s.players[s.controlled].action, before === 'slide' ? 'slide' : s.players[s.controlled].action);
});

test('P0.1 outfield PASS edge fires once: receiver possession cannot re-fire', () => {
  const { g, s } = carrier(23);
  const mate = s.players.find((p) => p.team === 0 && !p.keeper && p.id !== s.controlled)!;
  mate.x = 10; mate.z = 0; mate.vx = mate.vz = 0;
  // Press, then release: exactly one kick.
  tick(g, DT, { x: 1, pass: true, passHeld: true });
  assert.equal(s.ball.owner !== null, true, 'press holds the ball for the gesture');
  tick(g, DT, { x: 1, passReleased: true });
  let kicks = g.events.filter((e) => e.type === 'kick').length;
  assert.equal(kicks, 1, 'one pass from one press-release');
  g.events.splice(0);
  // Hold PASS through reception: no second release.
  for (let i = 0; i < 60; i++) {
    g.update(DT, { ...EMPTY_INPUT, x: 1, passHeld: true });
    kicks += g.events.filter((e) => e.type === 'kick').length;
    g.events.splice(0);
  }
  assert.equal(kicks, 1, 'held PASS never re-fires after control transferred');
});
