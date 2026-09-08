import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame, type TeamId } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds = DT, input: Partial<InputFrame> = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input });
};
function sandbox(seed = 42) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) {
    p.x = p.team ? 36 : -36;
    p.z = -25 + (p.id % 11) * 4.5;
    p.vx = p.vz = 0; p.cooldown = 0; p.think = 100;
  }
  const p = s.players.find(p => p.team === s.humanTeam && !p.keeper)!;
  s.controlled = p.id; p.x = 0; p.z = 0; p.facingX = 1; p.facingZ = 0;
  Object.assign(s.ball, { x: 0.7, y: FIELD.ballRadius, z: 0, vx: 0, vy: 0, vz: 0, owner: p.id, lastKicker: null, lock: 0, lastTouch: p.team, flight: 'roll' });
  return g;
}
function freeBall(g: MatchEngine, values: Partial<MatchEngine['state']['ball']>) {
  Object.assign(g.state.ball, { owner: null, lock: 1, lastKicker: null }, values);
}

test('22 players, two goalkeepers, fictional selectable teams and complete kickoff', () => {
  for (let team = 0; team < 4; team++) {
    const g = new MatchEngine(team, 180, 11);
    assert.equal(g.state.players.length, 22);
    assert.equal(g.state.players.filter(p => p.keeper).length, 2);
    assert.notEqual(g.state.teams[0].name, g.state.teams[1].name);
    assert.equal(g.state.phase, 'kickoff');
    tick(g, 1.3); tick(g, DT, { pass: true }); tick(g, 0.4);
    assert.equal(g.state.phase, 'playing');
  }
});

test('movement accelerates responsively, normalizes diagonals, and sprint is faster', () => {
  const run = (x: number, z: number, sprint = false) => {
    const g = sandbox(); g.state.ball.owner = null; g.state.ball.x = 40; g.state.ball.z = 25;
    tick(g, 0.5, { x, z, sprint });
    const p = g.state.players[g.state.controlled];
    return { speed: Math.hypot(p.vx, p.vz), distance: Math.hypot(p.x, p.z), g };
  };
  const straight = run(1, 0), diagonal = run(1, 1), sprint = run(1, 0, true);
  assert.ok(straight.distance > 1.5, 'movement begins promptly');
  assert.ok(Math.abs(straight.speed - diagonal.speed) < 0.35, 'diagonals are normalized');
  assert.ok(sprint.speed > straight.speed * 1.1, 'sprint has a meaningful speed gain');
  const p = straight.g.state.players[straight.g.state.controlled];
  tick(straight.g, 0.2, { x: -1 }); assert.ok(p.vx < 0, 'direction reverses within 200ms');
  tick(straight.g, 0.35); assert.ok(Math.hypot(p.vx, p.vz) < 1, 'release stops without skating');
});

test('analog pace is smooth: partial deflection scales speed, sprint ratio ~1.24, no stamina cliff', () => {
  const run = (x: number, z: number, sprint = false) => {
    const g = sandbox(); freeBall(g, { x: 40, z: 25, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0 });
    tick(g, 1, { x, z, sprint });
    const p = g.state.players[g.state.controlled];
    return { dist: Math.hypot(p.x, p.z), speed: Math.hypot(p.vx, p.vz), stamina: p.stamina };
  };
  const full = run(1, 0), half = run(0.45, 0), burst = run(1, 0, true);
  assert.ok(half.dist < full.dist * 0.85, 'partial stick deflection jogs slower');
  assert.ok(half.dist > full.dist * 0.2, 'no minimum-jog jump: small deflection stays slow');
  assert.ok(burst.dist > full.dist * 1.15 && burst.dist < full.dist * 1.35, `sprint ratio is arcade (~1.24), got ${(burst.dist / full.dist).toFixed(2)}`);
  assert.equal(half.stamina, 1, 'no stamina model in P0');
  assert.equal(burst.stamina, 1, 'sprint costs through touch exposure, not a stamina cliff');
});

test('tap pass goes to feet, hold pass leads the same receiver into space', () => {
  const perform = (hold: boolean) => {
    const g = sandbox(); const s = g.state;
    const receiver = s.players.find(p => p.team === 0 && p.id !== s.controlled && !p.keeper)!;
    receiver.x = 13; receiver.z = 0; receiver.vx = 5;
    tick(g, DT, { x: 1, z: 0, pass: true, passHeld: true });
    assert.equal(s.targetPlayer, receiver.id, 'press nominates the intended teammate');
    assert.notEqual(s.ball.owner, null, 'press does not kick yet');
    if (hold) for (let i = 0; i < 14; i++) tick(g, DT, { x: 1, z: 0, passHeld: true });
    tick(g, DT, { x: 1, z: 0, passReleased: true });
    assert.equal(s.ball.owner, null, 'release kicks'); assert.ok(s.ball.vx > 8);
    assert.ok(s.ball.x < 3, 'ball does not teleport to receiver');
    assert.equal(s.targetPlayer, receiver.id, 'same receiver for tap and hold');
    assert.equal(s.ball.flight, hold ? 'through' : 'pass');
    const dest = g.receiveDest();
    assert.ok(dest, 'release fixes a destination');
    return { g, destX: dest!.x };
  };
  const pass = perform(false), through = perform(true);
  assert.ok(through.destX > pass.destX + 2, `hold leads the same man into space (feet ${pass.destX.toFixed(1)}m vs lead ${through.destX.toFixed(1)}m)`);
});

test('corner has loft and shot produces fast independent ball', () => {
  const corner = sandbox();
  corner.state.phase = 'corner';
  corner.state.restart = { team: 0, taker: corner.state.controlled, x: 40, z: 24, wait: 0 };
  tick(corner, DT, { shootPressed: true, x: -1 });
  assert.equal(corner.state.ball.owner, null);
  assert.ok(corner.state.ball.vy > 3); assert.equal(corner.state.ball.flight, 'cross');
  const shot = sandbox();
  tick(shot, 0.2, { shootPressed: true, shootHeld: true, x: 1 });
  tick(shot, DT, { shootReleased: true, x: 1 });
  assert.equal(shot.state.ball.owner, null);
  assert.equal(shot.state.ball.flight, 'shot');
  assert.ok(Math.hypot(shot.state.ball.vx, shot.state.ball.vz) > 20);
  assert.equal(shot.state.stats.shots[0], 1);
});

test('goal registers once and resets to conceding team kickoff repeatedly', () => {
  const g = sandbox();
  for (let goal = 1; goal <= 4; goal++) {
    g.state.phase = 'playing'; g.state.restart = null;
    freeBall(g, { x: FIELD.halfLength - 0.2, z: 1, y: 0.5, vx: 28, vy: 0, vz: 0, lastTouch: 0 });
    tick(g, 0.1);
    assert.equal(g.state.phase, 'goal'); assert.equal(g.state.score[0], goal);
    tick(g, 0.5); assert.equal(g.state.score[0], goal, 'no double counting');
    tick(g, 4);
    assert.ok(['kickoff', 'playing'].includes(g.state.phase));
    const restart = g.state.restart as import('../src/types.ts').Restart | null;
    if (restart) assert.equal(restart.team, 1);
  }
});

test('sideline awards opposite last touch; J throws back into play', () => {
  const g = sandbox();
  freeBall(g, { x: 5, z: FIELD.halfWidth - 0.05, y: 0.3, vx: 0, vy: 0, vz: 15, lastTouch: 1 });
  tick(g, 0.1); assert.equal(g.state.phase, 'throwin');
  assert.equal(g.state.restart?.team, 0);
  tick(g, 1.5); tick(g, DT, { pass: true, x: 0, z: -1 });
  assert.equal(g.state.phase, 'playing'); assert.ok(g.state.ball.vz < 0);
  tick(g, 0.5); assert.ok(g.state.ball.z < FIELD.halfWidth);
});

test('goal-line last touch awards corners and goal kicks; both can restart', () => {
  for (const kind of ['corner', 'goalkick'] as const) {
    const g = sandbox();
    const side = kind === 'corner' ? 1 : -1;
    freeBall(g, { x: side * (FIELD.halfLength - 0.05), z: 12, y: 0.3, vx: side * 15, vy: 0, vz: 0, lastTouch: 1 });
    tick(g, 0.1); assert.equal(g.state.phase, kind); assert.equal(g.state.restart?.team, 0);
    tick(g, 1.5);
    tick(g, DT, kind === 'corner' ? { shootPressed: true } : { shootPressed: true });
    assert.equal(g.state.phase, 'playing', `${kind} resumes`);
    assert.equal(g.state.ball.owner, null);
  }
});

test('posts and crossbar rebound instead of counting goals', () => {
  for (const target of [{ z: FIELD.goalHalfWidth, y: 1 }, { z: 0, y: FIELD.goalHeight }]) {
    const g = sandbox();
    freeBall(g, { x: FIELD.halfLength - 0.6, ...target, vx: 28, vy: 0, vz: 0 });
    tick(g, 0.05);
    assert.equal(g.state.score[0], 0);
    assert.ok(g.events.some(e => e.type === 'post') || g.state.ball.vx < 0, 'frame collision rebounds');
  }
});

test('pause freezes clock and ball; half ends once and second half reverses attack', () => {
  const g = sandbox(); g.state.elapsed = 179.9;
  g.state.paused = true;
  const old = JSON.stringify(g.state.ball);
  tick(g, 1); assert.equal(g.state.elapsed, 179.9); assert.equal(JSON.stringify(g.state.ball), old);
  g.state.paused = false; tick(g, 0.2);
  assert.equal(g.state.phase, 'halftime');
  tick(g, 2); assert.equal(g.state.phase, 'halftime');
  g.continueHalf(); assert.equal(g.state.half, 2); assert.equal(g.state.attack[0], -1);
  tick(g, 3); tick(g, DT, { pass: true });
  assert.equal(g.state.phase, 'playing');
  g.state.elapsed = 179.95; tick(g, 0.1);
  assert.equal(g.state.phase, 'fulltime'); tick(g, 2); assert.equal(g.state.phase, 'fulltime');
});

test('manual switch selects a useful nearby defender, close tackles change possession', () => {
  const g = sandbox(); const s = g.state;
  const attacker = s.players.find(p => p.team === 1 && !p.keeper)!;
  attacker.x = 10; attacker.z = 0;
  Object.assign(s.ball, { owner: attacker.id, x: 9.3, z: 0 });
  const defender = s.players.find(p => p.team === 0 && !p.keeper && p.id !== s.controlled)!;
  defender.x = 8; defender.z = 0;
  tick(g, DT, { switchPlayer: true });
  assert.equal(s.controlled, defender.id);
  defender.x = attacker.x - 1.2; defender.facingX = 1; defender.facingZ = 0;
  tick(g, DT, { pass: true });
  assert.ok(s.ball.owner !== attacker.id || s.players[attacker.id].action === 'tackle', 'close challenge disrupts carrier');
});

test('full six-minute match stays finite, attacks, and reaches replay-ready final whistle', () => {
  const g = new MatchEngine(2, 180, 9182);
  const phases = new Set<string>(); let goals = 0, saves = 0, shots = 0;
  let frames = 0;
  while (g.state.phase !== 'fulltime' && frames < 60 * 650) {
    const s = g.state; phases.add(s.phase);
    if (s.phase === 'halftime') { g.continueHalf(); continue; }
    const p = s.players[s.controlled];
    const owned = s.ball.owner !== null && s.players[s.ball.owner].team === s.humanTeam;
    const dx = owned ? s.attack[0] : s.ball.x - p.x;
    const dz = owned ? -p.z * 0.04 : s.ball.z - p.z;
    const norm = Math.hypot(dx, dz) || 1;
    const shoot = owned && p.x * s.attack[0] > 20 && Math.abs(p.z) < 17;
    const input = { ...EMPTY_INPUT, x: dx / norm, z: dz / norm, sprint: owned,
      pass: s.phase !== 'playing' || (!owned && frames % 25 === 0) || (owned && frames % 180 === 0 && !shoot),
      shootPressed: shoot && frames % 80 === 0, shootHeld: shoot && frames % 80 < 14,
      shootReleased: shoot && frames % 80 === 14, switchPlayer: !owned && frames % 120 === 0,
      long: (owned && frames % 420 === 210) || s.phase === 'corner' };
    g.update(DT, input);
    for (const e of g.events.splice(0)) { if (e.type === 'goal') goals++; if (e.type === 'save') saves++; if (e.type === 'shot') shots++; }
    if (frames % 60 === 0) {
      for (const q of [...s.players, s.ball]) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.z));
      assert.ok(Math.abs(s.ball.x) < 60 && Math.abs(s.ball.z) < 40, 'ball remains in stadium');
    }
    frames++;
  }
  assert.equal(g.state.phase, 'fulltime', 'match completes within eleven simulated minutes including restarts');
  assert.ok(phases.has('halftime')); assert.ok(phases.has('kickoff'));
  assert.ok(shots > 2, `regular chances (${shots} shots)`);
  assert.ok(g.state.stats.shots[1] > 0, 'opponent attacks and shoots');
  console.log(JSON.stringify({ seconds: frames / 60, score: g.state.score, shots: g.state.stats.shots, saves, goals, phases: [...phases] }));
});
