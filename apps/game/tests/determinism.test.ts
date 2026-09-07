import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;

// Deterministic open-play driver: pure function of frame index, no wall-clock,
// no Math.random — both peers compute identical InputFrames from the tick.
function driveOpen(frame: number): { input: InputFrame; peer: InputFrame } {
  return {
    input: {
      ...EMPTY_INPUT,
      x: frame % 120 < 60 ? 1 : -0.6,
      z: frame % 90 < 45 ? 0.3 : -0.3,
      sprint: frame % 3 === 0,
      pass: frame % 200 === 60,
      through: frame % 250 === 120,
      cross: false,
      shootPressed: frame % 260 === 200,
      shootHeld: frame % 260 >= 200 && frame % 260 < 210,
      shootReleased: frame % 260 === 210,
      switchPlayer: frame % 120 === 90,
    },
    peer: {
      ...EMPTY_INPUT,
      x: frame % 100 < 50 ? -1 : 0.5,
      z: frame % 80 < 40 ? -0.2 : 0.2,
      sprint: frame % 4 === 0,
      pass: frame % 180 === 40,
      through: frame % 230 === 100,
      shootPressed: false,
      shootHeld: false,
      shootReleased: false,
      switchPlayer: frame % 140 === 70,
    },
  };
}

// Restart kicks resolved deterministically: the possessing side plays the ball.
function restartKick(g: MatchEngine): { input: Partial<InputFrame>; peer: Partial<InputFrame> } {
  const r = g.state.restart;
  if (!r) return { input: {}, peer: {} };
  const phase = g.state.phase;
  if (r.team === 0) {
    return {
      input: { pass: true, x: 1, z: 0, cross: phase === 'corner' },
      peer: {},
    };
  }
  return {
    input: {},
    peer: { pass: true, x: -1, z: 0, shootPressed: phase === 'goalkick' },
  };
}

function stepBoth(g: MatchEngine, frame: number) {
  const d = driveOpen(frame);
  const k = restartKick(g);
  g.update(
    DT,
    { ...d.input, ...k.input },
    { ...d.peer, ...k.peer },
  );
  g.events.splice(0);
}

function playingSandbox(seed: number): MatchEngine {
  const g = new MatchEngine(0, 180, seed);
  g.setRemoteTeam(1);
  const s = g.state;
  s.phase = 'playing';
  s.phaseTime = 0;
  s.restart = null;
  s.paused = false;
  return g;
}

test('deterministic simulation: same seed+inputs produce same hashes (several seeds)', () => {
  for (const seed of [1, 42, 99, 1234, 9182, 999999]) {
    const run = () => {
      const g = playingSandbox(seed);
      const hashes: number[] = [];
      for (let f = 0; f < 300; f++) {
        stepBoth(g, f);
        if ((f + 1) % 15 === 0) hashes.push(g.hash());
      }
      return hashes;
    };
    assert.deepEqual(run(), run(), `seed ${seed} hashes identical`);
  }
});

test('dual engine equivalence: A and B hash-identical at intervals', () => {
  const a = playingSandbox(4242);
  const b = playingSandbox(4242);
  for (let f = 0; f < 450; f++) {
    const d = driveOpen(f);
    const ka = restartKick(a);
    // Both engines see the same merged frames (lockstep delivers identical bytes).
    const ia = { ...d.input, ...ka.input };
    const pa = { ...d.peer, ...ka.peer };
    a.update(DT, ia, pa);
    b.update(DT, { ...ia }, { ...pa });
    a.events.splice(0);
    b.events.splice(0);
    if ((f + 1) % 15 === 0) {
      assert.equal(a.hash(), b.hash(), `tick ${f + 1} identical`);
    }
  }
});

test('snapshot/restore: uninterrupted vs snapshot-run-restore-replay equivalent', () => {
  const runFrames = (g: MatchEngine, from: number, count: number) => {
    for (let f = from; f < from + count; f++) stepBoth(g, f);
  };
  // Uninterrupted reference.
  const ref = playingSandbox(77);
  runFrames(ref, 0, 300);
  const refHash = ref.hash();

  // Snapshot at 150, run on, restore into a fresh engine, replay.
  const live = playingSandbox(77);
  runFrames(live, 0, 150);
  const snap = live.snapshot();
  runFrames(live, 150, 150);
  assert.equal(live.hash(), refHash, 'live run matches reference');

  const resumed = new MatchEngine(0, 999, 12345);
  resumed.restore(snap);
  runFrames(resumed, 150, 150);
  assert.equal(resumed.hash(), refHash, 'restored replay matches uninterrupted');
  assert.equal(
    JSON.stringify(resumed.state),
    JSON.stringify(live.state),
    'restored state deep-equal to live state',
  );
});

function carrierSandbox(seed: number): MatchEngine {
  const g = playingSandbox(seed);
  const s = g.state;
  for (const p of s.players) {
    p.x = p.team ? 36 : -36;
    p.z = -25 + (p.id % 11) * 4.5;
    p.vx = p.vz = 0;
    p.cooldown = 0;
    p.think = 100;
  }
  const p = s.players.find((q) => q.team === s.humanTeam && !q.keeper)!;
  s.controlled = p.id;
  // 15m out, central: a settled, reachable finish (flat lobs from 40m are
  // physically impossible at arcade gravity — the solver says so honestly).
  p.x = 31;
  p.z = 0;
  p.facingX = 1;
  p.facingZ = 0;
  // Keepers parked far from the flight path so this asserts the shot, not a save.
  for (const k of s.players.filter((q) => q.keeper)) { k.x = 0; k.z = 25; k.think = 100; }
  Object.assign(s.ball, {
    x: 31.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastKicker: null, lock: 0, lastTouch: p.team, flight: 'roll',
  });
  return g;
}

test('snapshot/restore covers shot flight (charged release)', () => {
  const script = (g: MatchEngine) => {
    const aim = { x: 1, z: 0, aimU: 0.3, aimV: 0.1 };
    g.update(DT, { ...EMPTY_INPUT, ...aim, shootPressed: true, shootHeld: true });
    for (let i = 0; i < 20; i++) g.update(DT, { ...EMPTY_INPUT, ...aim, shootHeld: true });
    g.update(DT, { ...EMPTY_INPUT, ...aim, shootReleased: true });
    const snap = g.snapshot();
    for (let i = 0; i < 90; i++) g.update(DT, { ...EMPTY_INPUT });
    return snap;
  };
  const a = carrierSandbox(7);
  const snap = script(a);
  const aHash = a.hash();
  assert.equal(a.state.ball.flight === 'shot' || a.state.ball.owner !== null, true, 'shot happened');

  const b = carrierSandbox(7);
  const b2 = carrierSandbox(999);
  // Replay to the snapshot point, then restore and replay flight.
  const aim2 = { x: 1, z: 0, aimU: 0.3, aimV: 0.1 };
  b.update(DT, { ...EMPTY_INPUT, ...aim2, shootPressed: true, shootHeld: true });
  for (let i = 0; i < 20; i++) b.update(DT, { ...EMPTY_INPUT, ...aim2, shootHeld: true });
  b.update(DT, { ...EMPTY_INPUT, ...aim2, shootReleased: true });
  b2.restore(b.snapshot());
  // b2 must equal b at the same point, and flight onward must match a.
  assert.equal(b2.hash(), b.hash());
  void snap;
  for (let i = 0; i < 90; i++) {
    b.update(DT, { ...EMPTY_INPUT });
    b2.update(DT, { ...EMPTY_INPUT });
  }
  assert.equal(b2.hash(), b.hash(), 'restored flight matches live flight');
  assert.equal(b.hash(), aHash, 'replayed shot deterministic');
});

test('snapshot/restore covers passing', () => {
  const runPass = (g: MatchEngine) => {
    const s = g.state;
    const receiver = s.players.find((p) => p.team === 0 && p.id !== s.controlled && !p.keeper)!;
    receiver.x = 13;
    receiver.z = 0;
    receiver.vx = 5;
    g.update(DT, { ...EMPTY_INPUT, x: 1, z: 0, pass: true });
    const snap = g.snapshot();
    for (let i = 0; i < 60; i++) g.update(DT, { ...EMPTY_INPUT });
    return { snap, hash: g.hash() };
  };
  const a = carrierSandbox(11);
  const { snap, hash } = runPass(a);
  const b = carrierSandbox(11);
  const rb = runPass(b);
  assert.equal(rb.hash, hash, 'pass flight deterministic');
  const c = carrierSandbox(555);
  c.restore(snap);
  for (let i = 0; i < 60; i++) c.update(DT, { ...EMPTY_INPUT });
  assert.equal(c.hash(), hash, 'restored pass replay matches');
});

test('snapshot/restore covers keeper possession + distribution', () => {
  const keeperSetup = (g: MatchEngine) => {
    const s = g.state;
    const k = s.players[0];
    k.x = k.homeX;
    k.z = 0;
    k.vx = k.vz = 0;
    k.cooldown = 0;
    Object.assign(s.ball, {
      x: k.x + 0.5, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
      owner: k.id, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll',
    });
  };
  const a = playingSandbox(21);
  keeperSetup(a);
  for (let i = 0; i < 10; i++) a.update(DT, { ...EMPTY_INPUT });
  const snap = a.snapshot();
  const snapHash = a.hash();
  for (let i = 0; i < 30; i++) a.update(DT, { ...EMPTY_INPUT, x: 1, pass: i === 5 });
  const endHash = a.hash();

  const b = playingSandbox(21);
  keeperSetup(b);
  for (let i = 0; i < 10; i++) b.update(DT, { ...EMPTY_INPUT });
  assert.equal(b.hash(), snapHash, 'keeper hold deterministic');
  const c = playingSandbox(999);
  c.restore(snap);
  for (let i = 0; i < 30; i++) c.update(DT, { ...EMPTY_INPUT, x: 1, pass: i === 5 });
  assert.equal(c.hash(), endHash, 'restored keeper distribution matches');
});

test('snapshot/restore covers charging state', () => {
  const a = carrierSandbox(31);
  a.update(DT, { ...EMPTY_INPUT, x: 1, shootPressed: true, shootHeld: true });
  a.update(DT, { ...EMPTY_INPUT, x: 1, shootHeld: true });
  const snap = a.snapshot();
  assert.equal(snap.charge > 0 || snap.chargingPlayer !== null, true, 'charge in progress snapshotted');
  for (let i = 0; i < 5; i++) a.update(DT, { ...EMPTY_INPUT, x: 1, shootHeld: true });
  a.update(DT, { ...EMPTY_INPUT, x: 1, shootReleased: true });
  for (let i = 0; i < 30; i++) a.update(DT, { ...EMPTY_INPUT });
  const endHash = a.hash();

  const b = carrierSandbox(31);
  b.update(DT, { ...EMPTY_INPUT, x: 1, shootPressed: true, shootHeld: true });
  b.update(DT, { ...EMPTY_INPUT, x: 1, shootHeld: true });
  const c = carrierSandbox(999);
  c.restore(snap);
  assert.equal(c.hash(), b.hash(), 'charge snapshot restores exactly');
  for (let i = 0; i < 5; i++) c.update(DT, { ...EMPTY_INPUT, x: 1, shootHeld: true });
  c.update(DT, { ...EMPTY_INPUT, x: 1, shootReleased: true });
  for (let i = 0; i < 30; i++) c.update(DT, { ...EMPTY_INPUT });
  assert.equal(c.hash(), endHash, 'charged shot after restore deterministic');
});
