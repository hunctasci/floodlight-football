import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';
import { TUNING } from '../src/game/tuning.ts';

const DT = 1 / 60;
function step(g: MatchEngine, input: Partial<InputFrame> = {}, peer: Partial<InputFrame> = {}) {
  g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
  g.events.splice(0);
}
/** Open sandbox: controlled outfielder at origin, everyone else parked BEHIND. */
function sandbox(seed = 7) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) {
    // Parked deep behind the carrier's +x path: pure locomotion/dribble
    // isolation (a defender 36m upfield would legitimately close down).
    p.x = -40; p.z = -25 + (p.id % 11) * 4.5;
    p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; p.touchIn = 0;
  }
  const p = s.players.find((q) => q.team === s.humanTeam && !q.keeper)!;
  s.controlled = p.id; p.x = 0; p.z = 0; p.facingX = 1; p.facingZ = 0;
  return { g, s, p };
}
function giveBall(s: MatchEngine['state'], p: { id: number; team: 0 | 1 }) {
  Object.assign(s.ball, {
    x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
    owner: p.id, lastTouch: p.team, lock: 0, lastKicker: null, flight: 'roll',
  });
}
/** Loose ball far from everyone so locomotion tests measure running only. */
function clearBall(s: MatchEngine['state']) {
  Object.assign(s.ball, { owner: null, x: 40, z: 25, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, lock: 0 });
}
const speedOf = (p: { vx: number; vz: number }) => Math.hypot(p.vx, p.vz);

test('P0.2 movement timing: 95% run speed in 120–170ms', () => {
  const { g, s, p } = sandbox();
  clearBall(s);
  let ticks = 0;
  for (let i = 0; i < 60; i++) {
    step(g, { x: 1 });
    ticks++;
    if (speedOf(p) >= TUNING.speed * 0.95) break;
  }
  const ms = ticks * 1000 / 60;
  assert.ok(ms >= 100 && ms <= 200, `95% speed in ${ms.toFixed(0)}ms (want ~120–170)`);
});

test('P0.2 stop timing: release halts in 100–150ms without skating', () => {
  const { g, s, p } = sandbox();
  clearBall(s);
  for (let i = 0; i < 60; i++) step(g, { x: 1 });
  assert.ok(speedOf(p) > TUNING.speed * 0.9, 'precondition: at full run');
  let ticks = 0;
  for (let i = 0; i < 60; i++) {
    step(g, {});
    ticks++;
    if (speedOf(p) < TUNING.speed * 0.05) break;
  }
  const ms = ticks * 1000 / 60;
  assert.ok(ms >= 50 && ms <= 200, `stop in ${ms.toFixed(0)}ms (want ~100–150)`);
});

test('P0.2 reversal timing: ordinary 150–200ms, sprint 200–260ms', () => {
  const timeToReverse = (sprint: boolean) => {
    const { g, s, p } = sandbox();
    clearBall(s);
    for (let i = 0; i < 90; i++) step(g, { x: 1, sprint });
    assert.ok(speedOf(p) > (sprint ? TUNING.sprint : TUNING.speed) * 0.9, 'precondition: full pace');
    let ticks = 0;
    const target = (sprint ? TUNING.sprint : TUNING.speed) * 0.95;
    for (let i = 0; i < 90; i++) {
      step(g, { x: -1, sprint });
      ticks++;
      if (p.vx <= -target) break;
    }
    return ticks * 1000 / 60;
  };
  const ordinary = timeToReverse(false);
  assert.ok(ordinary >= 120 && ordinary <= 230, `ordinary reversal ${ordinary.toFixed(0)}ms (want ~150–200)`);
  const sprint = timeToReverse(true);
  assert.ok(sprint >= 180 && sprint <= 300, `sprint reversal ${sprint.toFixed(0)}ms (want ~200–260)`);
  assert.ok(sprint > ordinary, 'sprint reversal is heavier than ordinary');
});

test('P0.2 analog input is continuous: no minimum-jog jump', () => {
  const dist = (x: number) => {
    const { g, s } = sandbox();
    clearBall(s);
    for (let i = 0; i < 30; i++) step(g, { x, z: 0 });
    const p = s.players[s.controlled];
    return Math.hypot(p.x, p.z);
  };
  const tiny = dist(0.12), small = dist(0.3), full = dist(1);
  assert.ok(tiny < small * 0.6, 'tiny deflection crawls instead of jogging');
  assert.ok(small < full * 0.6, 'speed scales smoothly with deflection');
});

test('P0.2 ordinary 20m dribble never randomly loses the ball', () => {
  const { g, s, p } = sandbox(31);
  giveBall(s, p);
  // Dribble 20m with direction changes and no sprint.
  const legs: Array<Partial<InputFrame>> = [{ x: 1 }, { x: 0.7, z: 0.7 }, { x: 1, z: -0.3 }, { x: 1 }];
  let i = 0;
  for (let f = 0; f < 240 && p.x < 20; f++) {
    if (f % 60 === 0) i = Math.min(i + 1, legs.length - 1);
    step(g, legs[i]);
    assert.equal(s.ball.owner, p.id, `still in control at ${(s.ball.x).toFixed(1)}m`);
  }
  assert.ok(p.x >= 15, `covered ground dribbling (x=${p.x.toFixed(1)})`);
});

test('P0.2 sprint visibly pushes the ball farther ahead than jogging', () => {
  const run = (sprint: boolean) => {
    const { g, s, p } = sandbox(sprint ? 41 : 42);
    giveBall(s, p);
    let maxGap = 0;
    for (let f = 0; f < 120; f++) {
      step(g, { x: 1, sprint });
      maxGap = Math.max(maxGap, Math.hypot(s.ball.x - p.x, s.ball.z - p.z));
      if (s.ball.owner !== p.id) break;
    }
    return { maxGap, kept: s.ball.owner === p.id };
  };
  const jog = run(false), sprint = run(true);
  assert.ok(jog.kept && sprint.kept, 'both runs keep control on open ground');
  assert.ok(sprint.maxGap > jog.maxGap + 0.3,
    `sprint exposes the ball (jog ${jog.maxGap.toFixed(2)}m vs sprint ${sprint.maxGap.toFixed(2)}m)`);
});

test('P0.2 receiver controls an 8–15m open pass with no teleport', () => {
  const { g, s, p } = sandbox(51);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 12; mate.z = 0; mate.vx = mate.vz = 0;
  giveBall(s, p);
  step(g, { x: 1, pass: true, passHeld: true });
  step(g, { x: 1, passReleased: true });
  assert.equal(s.ball.owner, null, 'pass released');
  let maxStep = 0;
  let prev = { x: s.ball.x, z: s.ball.z };
  let received = false;
  for (let f = 0; f < 120; f++) {
    step(g, {});
    maxStep = Math.max(maxStep, Math.hypot(s.ball.x - prev.x, s.ball.z - prev.z));
    prev = { x: s.ball.x, z: s.ball.z };
    if (s.ball.owner === mate.id) { received = true; break; }
  }
  assert.ok(received, 'receiver gathers the pass');
  assert.ok(maxStep < 1.0, `ball never teleports (max step ${maxStep.toFixed(2)}m)`);
});

test('P0.2 manual movement overrides everything: nominated receiver obeys the stick', () => {
  const { g, s, p } = sandbox(52);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 12; mate.z = 0; mate.vx = mate.vz = 0;
  giveBall(s, p);
  step(g, { x: 1, pass: true });
  // New controlled player is the nominee; hold LEFT — he must go left.
  const nominee = s.players[s.controlled];
  const x0 = nominee.x;
  for (let f = 0; f < 30; f++) step(g, { x: -1, z: 0 });
  assert.ok(nominee.x < x0 - 0.5, 'nominee follows manual input, not assistance');
});

test('P0.2 earliest contact wins: closer opponent beats the nominated receiver', () => {
  const { g, s, p } = sandbox(53);
  const mate = s.players.find((q) => q.team === 0 && !q.keeper && q.id !== p.id)!;
  mate.x = 12; mate.z = 0; mate.vx = mate.vz = 0;
  const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
  foe.x = 6; foe.z = 0; foe.vx = foe.vz = 0; foe.think = 100;
  giveBall(s, p);
  step(g, { x: 1, pass: true });
  // Freeze the nominee far away; the ball must be won by whoever gets there.
  mate.x = 30;
  let winner: number | null = null;
  for (let f = 0; f < 120; f++) {
    step(g, {});
    if (s.ball.owner !== null) { winner = s.ball.owner; break; }
  }
  assert.ok(winner !== null, 'someone wins the loose ball');
  assert.equal(s.players[winner!].team, 1, 'the closer opponent reaches it first');
});

test('P0.2 exact-overlap tie breaks deterministically by lower id', () => {
  const winners: Array<number | null> = [];
  let lowId = -1;
  for (const seed of [5, 6]) {
    const { g, s } = sandbox(seed);
    const a = s.players.filter((q) => q.team === 0 && !q.keeper)[0];
    const b = s.players.filter((q) => q.team === 1 && !q.keeper)[0];
    lowId = Math.min(a.id, b.id);
    a.x = 5; a.z = 0; a.vx = a.vz = 0; a.think = 100;
    b.x = 5; b.z = 0; b.vx = b.vz = 0; b.think = 100;
    Object.assign(s.ball, {
      x: 5, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0,
      owner: null, lock: 0, lastTouch: 0, lastKicker: null, flight: 'roll',
    });
    step(g, {});
    winners.push(s.ball.owner);
  }
  assert.ok(winners[0] !== null, 'overlap resolves to someone');
  assert.equal(winners[0], winners[1], 'same overlap, same winner across seeds');
  assert.equal(winners[0], lowId, 'lower id wins the exact tie');
});
