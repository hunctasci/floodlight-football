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

test('keeper through ball on W (Triangle)', () => {
  const { g, s } = keeperSetup();
  tick(g, DT, { x: 1, z: 0, through: true });
  assert.equal(s.ball.flight, 'through');
});

test('pressing forward cannot camp inside the keeper cylinder or steal the ball', () => {
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
  assert.ok(minDist >= 1.9, `keeper cylinder holds (min=${minDist.toFixed(2)})`);
});

test('idle keeper auto-distributes instead of holding forever', () => {
  const { g, s, k } = keeperSetup();
  tick(g, 3.0);
  assert.notEqual(s.ball.owner, k.id, 'fallback release after timeout');
});

test('opponents retreat when the opposing keeper holds the ball', () => {
  const g = new MatchEngine(0, 180, 31);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  // Team 1 AI keeper holds the ball deep in his own box (+x side).
  const k1 = s.players.find(p => p.team === 1 && p.keeper)!;
  k1.x = 40; k1.z = 0; k1.vx = k1.vz = 0; k1.cooldown = 0;
  Object.assign(s.ball, { x: 39.4, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: k1.id, lastTouch: 1, lock: 0, lastKicker: null, flight: 'roll' });
  // Park team 0's AI outfielders at contain distance; human is excluded from AI.
  const chasers = s.players.filter(p => p.team === 0 && !p.keeper && p.id !== s.controlled);
  for (const p of chasers) { p.x = 32; p.z = 0; p.vx = p.vz = 0; p.think = 100; }
  tick(g, 0.4); // inside the calm .6s hold window — no distribution yet
  assert.equal(s.ball.owner, k1.id, 'keeper keeps holding');
  const retreats = chasers.filter(p => p.aiState === 'RETREAT').length;
  assert.ok(retreats >= 5, `most outfielders drop back (${retreats}/9)`);
});

test('keeper hurries the release when camped at the cylinder', () => {
  const g = new MatchEngine(0, 180, 32);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  const k1 = s.players.find(p => p.team === 1 && p.keeper)!;
  k1.x = 40; k1.z = 0; k1.vx = k1.vz = 0; k1.cooldown = 0;
  Object.assign(s.ball, { x: 39.4, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: k1.id, lastTouch: 1, lock: 0, lastKicker: null, flight: 'roll' });
  const camper = s.players.find(p => p.team === 0 && !p.keeper && p.id !== s.controlled)!;
  camper.x = 41.5; camper.z = 0; camper.vx = camper.vz = 0; camper.think = 100;
  for (const p of s.players) if (p.team === 0 && !p.keeper && p.id !== camper.id && p.id !== s.controlled) { p.x = 0; p.z = 20; p.think = 100; }
  tick(g, 0.5);
  assert.notEqual(s.ball.owner, k1.id, 'camped keeper releases early instead of holding');
});

test('hold-PASS is a lead pass into space; sprint never modifies a pass', () => {
  const setup = () => {
    const g = new MatchEngine(0, 180, 21);
    const s = g.state;
    s.phase = 'playing'; s.restart = null;
    for (const p of s.players) { p.x = p.team === 0 ? -20 : 25; p.z = 24; p.think = 100; }
    const kicker = s.players[s.controlled];
    kicker.x = 0; kicker.z = 0; kicker.facingX = 1; kicker.facingZ = 0;
    const mate = s.players.find(p => p.team === 0 && !p.keeper && p.id !== kicker.id)!;
    mate.x = 13; mate.z = 0; mate.vx = 4; mate.vz = 0;
    Object.assign(s.ball, { x: 0.7, z: 0, owner: kicker.id });
    return { g, s, kicker, mate };
  };
  // Tap: feet pass at a modest pace.
  {
    const { g, s } = setup();
    tick(g, DT, { x: 1, z: 0, pass: true, passHeld: true });
    tick(g, DT, { x: 1, z: 0, passReleased: true });
    assert.equal(s.ball.flight, 'pass');
    const tapSpeed = Math.hypot(s.ball.vx, s.ball.vz);
    assert.ok(tapSpeed >= 17 && tapSpeed <= 27, `tap pace sane (${tapSpeed.toFixed(1)} m/s)`);
  }
  // Hold: same receiver, lead destination into space.
  {
    const { g, s, mate } = setup();
    tick(g, DT, { x: 1, z: 0, pass: true, passHeld: true });
    assert.equal(s.targetPlayer, mate.id, 'hold keeps the same receiver');
    for (let i = 0; i < 14; i++) tick(g, DT, { x: 1, z: 0, passHeld: true });
    tick(g, DT, { x: 1, z: 0, passReleased: true, passHeld: false });
    assert.equal(s.ball.flight, 'through', 'hold turns the same receiver into a lead pass');
    const dest = g.receiveDest();
    assert.ok(dest && dest.x > mate.x + 2, `lead destination serves space ahead (${dest ? dest.x.toFixed(1) : 'none'} vs mate ${mate.x.toFixed(1)})`);
  }
  // Sprint held through the gesture must not change the pass intent.
  {
    const a = setup();
    tick(a.g, DT, { x: 1, z: 0, pass: true, passHeld: true });
    tick(a.g, DT, { x: 1, z: 0, passReleased: true });
    const b = setup();
    tick(b.g, DT, { x: 1, z: 0, pass: true, passHeld: true, sprint: true });
    tick(b.g, DT, { x: 1, z: 0, passReleased: true, sprint: true });
    assert.equal(a.s.targetPlayer, b.s.targetPlayer, 'sprint does not change the receiver');
    assert.equal(a.s.ball.flight, b.s.ball.flight, 'sprint does not change the pass type');
    const da = a.g.receiveDest()!, db = b.g.receiveDest()!;
    assert.ok(Math.hypot(da.x - db.x, da.z - db.z) < 1.5, 'sprint does not redirect the destination');
  }
});
