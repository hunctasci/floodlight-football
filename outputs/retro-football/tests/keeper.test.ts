import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds: number, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input });
};

/** Human keeper holding the ball at home, two placed mates, foes far away. */
function keeperSetup(seed = 11) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  const k = s.players.find(p => p.team === 0 && p.keeper)!;
  k.x = k.homeX; k.z = 0; k.vx = k.vz = 0; k.cooldown = 0;
  Object.assign(s.ball, { x: k.x + 0.6, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: k.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' });
  const mates = s.players.filter(p => p.team === 0 && !p.keeper);
  mates[0].x = k.x + 2; mates[0].z = 10; mates[0].vx = mates[0].vz = 0;
  mates[1].x = k.x + 13; mates[1].z = 0; mates[1].vx = mates[1].vz = 0;
  for (const p of mates.slice(2)) { p.x = -20; p.z = 24; p.think = 100; }
  for (const p of s.players) if (p.team === 1 && !p.keeper) { p.x = 20; p.z = 20; p.think = 100; }
  s.controlled = mates[1].id;
  return { g, s, k, side: mates[0], fwd: mates[1] };
}

test('keeper distributes short in the aimed sideways direction, not forward', () => {
  const { g, s, k, side } = keeperSetup();
  tick(g, DT, { x: 0, z: 1, pass: true });
  assert.equal(s.ball.owner, null);
  assert.equal(s.targetPlayer, side.id);
  tick(g, 1.2);
  assert.equal(s.ball.owner, side.id, 'sideways receiver takes the keeper throw');
  assert.equal(s.controlled, side.id);
  assert.notEqual(s.ball.owner, k.id);
});

test('keeper long kick on D follows aim', () => {
  const { g, s } = keeperSetup();
  tick(g, DT, { x: 1, z: 0, shootPressed: true });
  assert.equal(s.ball.owner, null);
  assert.equal(s.ball.flight, 'cross');
  assert.ok(s.ball.vx > 10, `long kick travels forward (vx=${s.ball.vx.toFixed(1)})`);
});

test('keeper through ball on W', () => {
  const { g, s } = keeperSetup();
  tick(g, DT, { x: 1, z: 0, through: true });
  assert.equal(s.ball.flight, 'through');
});

test('pressing forward cannot camp on or steal from a holding keeper', () => {
  const { g, s, k } = keeperSetup();
  const foe = s.players.find(p => p.team === 1 && !p.keeper)!;
  foe.x = k.x + 1.0; foe.z = 0; foe.vx = foe.vz = 0;
  let minDist = Infinity;
  for (let i = 0; i < Math.ceil(2.0 / DT); i++) {
    g.update(DT, { ...EMPTY_INPUT });
    for (const e of g.events.splice(0)) assert.notEqual(e.type, 'tackle', 'no tackle on a keeper holding the ball');
    minDist = Math.min(minDist, Math.hypot(foe.x - k.x, foe.z - k.z));
    assert.equal(s.ball.owner, k.id, 'keeper keeps holding under press');
  }
  assert.ok(minDist >= 1.9, `protection bubble holds (min=${minDist.toFixed(2)})`);
});

test('idle keeper auto-distributes instead of holding forever', () => {
  const { g, s, k } = keeperSetup();
  tick(g, 3.0);
  assert.notEqual(s.ball.owner, k.id, 'fallback release after timeout');
});

test('outfield driven pass (sprint+pass) is flat and fierce', () => {
  const g = new MatchEngine(0, 180, 21);
  const s = g.state;
  s.phase = 'playing'; s.restart = null;
  for (const p of s.players) { p.x = p.team === 0 ? -20 : 25; p.z = 24; p.think = 100; }
  const kicker = s.players[s.controlled];
  kicker.x = 0; kicker.z = 0; kicker.facingX = 1; kicker.facingZ = 0;
  const mate = s.players.find(p => p.team === 0 && !p.keeper && p.id !== kicker.id)!;
  mate.x = 13; mate.z = 0; mate.vx = mate.vz = 0;
  Object.assign(s.ball, { x: 0.7, z: 0, owner: kicker.id });
  tick(g, DT, { x: 1, z: 0, pass: true, sprint: true });
  const speed = Math.hypot(s.ball.vx, s.ball.vz);
  assert.ok(speed >= 25, `driven pass is fierce (${speed.toFixed(1)} m/s)`);
});
