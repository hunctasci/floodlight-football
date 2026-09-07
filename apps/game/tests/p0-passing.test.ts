import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
function step(g: MatchEngine, input: Partial<InputFrame> = {}, peer: Partial<InputFrame> = {}) {
  g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
  g.events.splice(0);
}
function sandbox(seed = 7) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) {
    p.x = -40; p.z = -25 + (p.id % 11) * 4.5;
    p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; p.touchIn = 0;
  }
  const p = s.players.find((q) => q.team === s.humanTeam && !q.keeper)!;
  s.controlled = p.id; p.x = 0; p.z = 0; p.facingX = 1; p.facingZ = 0;
  return { g, s, p };
}
function tapPass(g: MatchEngine, aim: Partial<InputFrame>) {
  step(g, { ...aim, pass: true, passHeld: true });
  step(g, { ...aim, passReleased: true });
}
function holdPass(g: MatchEngine, aim: Partial<InputFrame>, holds = 14) {
  step(g, { ...aim, pass: true, passHeld: true });
  for (let i = 0; i < holds; i++) step(g, { ...aim, passHeld: true });
  step(g, { ...aim, passReleased: true, passHeld: false });
}

test('P0.3 open 8–18m passes complete reliably to a sensible receiver', () => {
  let made = 0;
  const N = 10;
  for (let k = 0; k < N; k++) {
    const { g, s, p } = sandbox(100 + k);
    const mate = s.players.filter((q) => q.team === 0 && !q.keeper && q.id !== p.id)[k % 9];
    const dist = 8 + (k % 11);
    mate.x = dist; mate.z = (k % 3) - 1; mate.vx = mate.vz = 0;
    Object.assign(s.ball, {
      x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
      owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
    });
    const aim = { x: mate.x, z: mate.z };
    const n = Math.hypot(aim.x, aim.z);
    tapPass(g, { x: aim.x / n, z: aim.z / n });
    for (let f = 0; f < 150 && s.ball.owner !== mate.id; f++) step(g, {});
    if (s.ball.owner === mate.id) made++;
  }
  assert.ok(made >= 9, `open passes complete (${made}/${N})`);
});

test('P0.3 tap and hold pick the same teammate with different destinations', () => {
  const run = (hold: boolean) => {
    const { g, s, p } = sandbox(200);
    const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
    mate.x = 13; mate.z = 0; mate.vx = 3; mate.vz = 0;
    Object.assign(s.ball, {
      x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
      owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
    });
    if (hold) holdPass(g, { x: 1, z: 0 });
    else tapPass(g, { x: 1, z: 0 });
    return { target: s.targetPlayer, flight: s.ball.flight, dest: g.receiveDest(), mate: mate.id };
  };
  const feet = run(false), space = run(true);
  assert.equal(feet.target, feet.mate, 'tap nominates the runner');
  assert.equal(space.target, space.mate, 'hold keeps the SAME receiver');
  assert.equal(feet.flight, 'pass');
  assert.equal(space.flight, 'through');
  assert.ok(space.dest!.x > feet.dest!.x + 2, 'hold serves space ahead');
});

test('P0.3 defender first to the lane intercepts', () => {
  const { g, s, p } = sandbox(300);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 14; mate.z = 0; mate.vx = mate.vz = 0;
  const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
  foe.x = 7; foe.z = 0; foe.vx = foe.vz = 0; foe.think = 100;
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  tapPass(g, { x: 1, z: 0 });
  let winner: number | null = null;
  for (let f = 0; f < 150; f++) {
    step(g, {});
    if (s.ball.owner !== null) { winner = s.ball.owner; break; }
  }
  assert.ok(winner !== null, 'someone wins the lane ball');
  assert.equal(s.players[winner!].team, 1, 'the lane defender intercepts');
});

test('P0.3 no candidate in the cone: manual directional pass, no nominee', () => {
  const { g, s, p } = sandbox(400);
  // Everyone else is behind the aim direction.
  for (const q of s.players) if (q.id !== p.id && !q.keeper) { q.x = -30; q.z = 0; q.think = 100; }
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  tapPass(g, { x: 1, z: 0 });
  assert.equal(s.targetPlayer, null, 'no nominee without a candidate');
  assert.equal(s.ball.owner, null, 'ball released');
  assert.ok(s.ball.vx > 10, 'manual ball travels toward the aim');
  assert.equal(g.receiveDest(), null, 'manual pass fixes no destination');
});

test('P0.3 teammate behind the aim is never selected', () => {
  const { g, s, p } = sandbox(401);
  const behind = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  behind.x = -8; behind.z = 0; behind.vx = behind.vz = 0;
  const ahead = s.players.filter((q) => q.team === 0 && !q.keeper && q.id !== p.id)[1];
  ahead.x = 12; ahead.z = 6; ahead.vx = ahead.vz = 0;
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  step(g, { x: 1, z: 0, pass: true, passHeld: true });
  assert.equal(s.targetPlayer, ahead.id, 'ahead teammate picked over the closer man behind');
});

test('P0.3 two SWITCH presses give two different useful candidates', () => {
  const { g, s } = sandbox(500);
  // Opponent owns the ball upfield; our controlled man is deep.
  const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
  foe.x = 20; foe.z = 0;
  Object.assign(s.ball, {
    x: 20.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: foe.id, lastTouch: 1, lock: 0, lastKicker: null, flight: 'roll',
  });
  // Park two defenders near the ball so both are sensible picks.
  const mates = s.players.filter((q) => q.team === 0 && !q.keeper);
  mates[0].x = 17; mates[0].z = -2; mates[0].vx = mates[0].vz = 0;
  mates[1].x = 16; mates[1].z = 3; mates[1].vx = mates[1].vz = 0;
  s.controlled = mates[5].id;
  const first = s.controlled;
  step(g, { switchPlayer: true });
  const second = s.controlled;
  step(g, {});
  step(g, { switchPlayer: true });
  const third = s.controlled;
  assert.notEqual(second, first, 'first press changes selection');
  assert.notEqual(third, second, 'second press cycles to another candidate');
  assert.ok(Math.hypot(mates[0].x - s.players[second].x, mates[0].z - s.players[second].z) < 12
    || Math.hypot(mates[1].x - s.players[second].x, mates[1].z - s.players[second].z) < 12,
    'first pick is a useful nearby defender');
});

test('P0.3 no automatic switch while defending without input', () => {
  const { g, s } = sandbox(501);
  const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
  foe.x = 10; foe.z = 0;
  Object.assign(s.ball, {
    x: 10.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: foe.id, lastTouch: 1, lock: 0, lastKicker: null, flight: 'roll',
  });
  const defender = s.players.find((q) => q.team === 0 && !q.keeper)!;
  defender.x = 8; defender.z = 1; defender.vx = defender.vz = 0;
  s.controlled = defender.id;
  for (let f = 0; f < 60; f++) step(g, {});
  assert.equal(s.controlled, defender.id, 'manually positioned defender is not stolen');
});

test('P0.3 W (Triangle) is a firm through pass: one edge, one flat kick, same nomination rules', () => {
  const { g, s, p } = sandbox(700);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 22; mate.z = -2; mate.vx = mate.vz = 0;
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  step(g, { x: 1, z: 0, through: true });
  assert.equal(s.ball.owner, null, 'long pass released immediately');
  assert.equal(s.ball.flight, 'pass', 'long stays flat, not a lob');
  const speed = Math.hypot(s.ball.vx, s.ball.vz);
  assert.ok(speed >= 25 && speed <= 32, `long has pace (${speed.toFixed(1)} m/s)`);
  assert.equal(s.targetPlayer, mate.id, 'cone nomination applies');
  assert.equal(s.controlled, p.id, 'control stays until reception');
});

test('P0.3 A (Square) is a lofted cross into the box from wide areas', () => {
  const { g, s, p } = sandbox(701);
  p.x = 27; p.z = 21; p.facingX = 1; p.facingZ = 0;
  Object.assign(s.ball, {
    x: 27.7, y: FIELD.ballRadius, z: 21, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  for (const q of s.players) if (q.team === 0 && !q.keeper && q.id !== p.id) { q.x = 30; q.z = (q.id % 2 ? 7 : -7); }
  step(g, { x: 1, z: -1, cross: true });
  assert.equal(s.ball.owner, null, 'cross released immediately');
  assert.equal(s.ball.flight, 'cross');
  assert.ok(s.ball.vy > 3, 'cross has loft');
  const x0 = s.ball.x;
  for (let i = 0; i < 27; i++) step(g, {});
  assert.ok(s.ball.x < 42 && Math.abs(s.ball.z) < 18, 'cross lands in the box, not beyond');
});

test('P0.3 press shows the nominee before release; fixed destination after', () => {
  const { g, s, p } = sandbox(600);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 12; mate.z = 0; mate.vx = mate.vz = 0;
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
  step(g, { x: 1, z: 0, pass: true, passHeld: true });
  assert.equal(s.targetPlayer, mate.id, 'intent visible on press');
  assert.equal(g.receiveDest(), null, 'no destination fixed before release');
  step(g, { x: 1, z: 0, passReleased: true });
  assert.ok(g.receiveDest() !== null, 'destination fixed at release');
});
