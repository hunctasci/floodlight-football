import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds = DT, input: Partial<InputFrame> = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input });
};
function striker(seed = 7, x = 30, z = 0) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  // Everyone far off-lane in the other half: uncontested flight, no chaser
  // can reach the lane before the goal-plane crossing.
  for (const p of s.players) { p.x = -30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  // Keepers parked far from the flight path: P0.4 asserts the shot, not saves.
  for (const k of s.players.filter((q) => q.keeper)) { k.x = -30; k.z = 25; k.think = 100; }
  const p = s.players.find((p) => p.team === 0 && !p.keeper)!;
  s.controlled = p.id; p.x = x; p.z = z; p.facingX = 1; p.facingZ = 0;
  Object.assign(s.ball, { x: x + 0.7, y: FIELD.ballRadius, z, vx: 0, vy: 0, vz: 0, spin: 0, owner: p.id, lastKicker: null, lock: 0, lastTouch: 0, flight: 'roll' });
  return { g, s, p };
}
/** Fires with a hold of `hold` seconds and explicit reticle aim, then returns the launched ball. */
function fire(seed: number, x: number, aim: { aimU: number; aimV: number }, hold: number) {
  const { g, s } = striker(seed, x);
  tick(g, DT, { aimU: aim.aimU, aimV: aim.aimV, shootPressed: true, shootHeld: true });
  tick(g, Math.max(0, hold - DT), { aimU: aim.aimU, aimV: aim.aimV, shootHeld: true });
  tick(g, DT, { aimU: aim.aimU, aimV: aim.aimV, shootReleased: true });
  const b = s.ball;
  assert.equal(b.owner, null, 'shot released');
  assert.equal(b.flight, 'shot', 'shot launched');
  return b;
}
/** Integrated goal-plane crossing (never extrapolated from velocity). */
function crossing(g: MatchEngine, gx: number): { z: number; y: number } {
  const s = g.state;
  let prev = { x: s.ball.x, y: s.ball.y, z: s.ball.z };
  for (let i = 0; i < 240; i++) {
    g.update(DT, { ...EMPTY_INPUT });
    g.events.splice(0);
    const b = s.ball;
    if ((prev.x - gx) * (b.x - gx) <= 0 && Math.abs(b.x - prev.x) > 1e-9) {
      const u = (gx - prev.x) / (b.x - prev.x);
      return { z: prev.z + (b.z - prev.z) * u, y: prev.y + (b.y - prev.y) * u };
    }
    if (s.phase !== 'playing') break;
    prev = { x: b.x, y: b.y, z: b.z };
  }
  assert.fail('ball never reached the goal plane');
}

test('P0.4 charge sets pace only: full-power shots are faster than taps', () => {
  const tap = fire(7, 30, { aimU: 0, aimV: 0 }, 0);
  const full = fire(7, 30, { aimU: 0, aimV: 0 }, 0.45);
  const tapSpeed = Math.hypot(tap.vx, tap.vz), fullSpeed = Math.hypot(full.vx, full.vz);
  assert.ok(tapSpeed >= 24 && tapSpeed <= 27, `tap pace ~25 (${tapSpeed.toFixed(1)})`);
  assert.ok(fullSpeed >= 33 && fullSpeed <= 36, `max pace ~35 (${fullSpeed.toFixed(1)})`);
});

test('P0.4 five sectors land on their reticle endpoints (no keeper)', () => {
  const sectors = [
    { name: 'low left', aimU: -0.65, aimV: 0 },
    { name: 'low center', aimU: 0, aimV: 0 },
    { name: 'low right', aimU: 0.65, aimV: 0 },
    { name: 'high left', aimU: -0.65, aimV: 0.55 },
    { name: 'high right', aimU: 0.65, aimV: 0.55 },
  ];
  for (const { name, aimU, aimV } of sectors) {
    const { g: gg } = striker(7, 30, 0);
    tick(gg, DT, { aimU, aimV, shootPressed: true, shootHeld: true });
    tick(gg, 0.29, { aimU, aimV, shootHeld: true });
    tick(gg, DT, { aimU, aimV, shootReleased: true });
    const c = crossing(gg, FIELD.halfLength);
    const wantZ = aimU * (FIELD.goalHalfWidth + 0.8);
    const wantY = aimV === 0 ? 0.25 : 0.2 + aimV * 3.0;
    assert.ok(Math.abs(c.z - wantZ) < 0.45, `${name}: z=${c.z.toFixed(2)} want ${wantZ.toFixed(2)}`);
    assert.ok(Math.abs(c.y - wantY) < 0.6, `${name}: y=${c.y.toFixed(2)} want ${wantY.toFixed(2)}`);
  }
});

test('P0.4 power changes the arc, not the sector', () => {
  const at = (hold: number) => {
    const { g } = striker(9, 28, 2);
    tick(g, DT, { aimU: -0.6, aimV: 0.1, shootPressed: true, shootHeld: true });
    tick(g, Math.max(0, hold - DT), { aimU: -0.6, aimV: 0.1, shootHeld: true });
    tick(g, DT, { aimU: -0.6, aimV: 0.1, shootReleased: true });
    return crossing(g, FIELD.halfLength);
  };
  const soft = at(0.3), hard = at(0.45);
  assert.ok(Math.hypot(soft.z - hard.z, soft.y - hard.y) < 0.6,
    `same sector at both powers (soft ${soft.z.toFixed(2)},${soft.y.toFixed(2)} vs hard ${hard.z.toFixed(2)},${hard.y.toFixed(2)})`);
});

test('P0.4 both ends and mirrored geometry agree', () => {
  const shootAt = (seed: number, x: number, z: number, dir: 1 | -1, aimU: number) => {
    const g = new MatchEngine(0, 180, seed);
    const s = g.state;
    s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
    if (dir < 0) { s.phase = 'halftime'; g.continueHalf(); s.phase = 'playing'; s.restart = null; }
    // Off-lane parking on the opposite end: uncontested at either goal.
    for (const p of s.players) { p.x = -dir * 30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
    for (const k of s.players.filter((q) => q.keeper)) { k.x = -dir * 30; k.z = 25; k.think = 100; }
    const p = s.players.find((q) => q.team === 0 && !q.keeper)!;
    s.controlled = p.id; p.x = x; p.z = z; p.facingX = dir; p.facingZ = 0;
    Object.assign(s.ball, { x: x + dir * 0.7, y: FIELD.ballRadius, z, vx: 0, vy: 0, vz: 0, spin: 0, owner: p.id, lastKicker: null, lock: 0, lastTouch: 0, flight: 'roll' });
    tick(g, DT, { aimU, aimV: 0.1, shootPressed: true, shootHeld: true });
    tick(g, 0.2, { aimU, aimV: 0.1, shootHeld: true });
    tick(g, DT, { aimU, aimV: 0.1, shootReleased: true });
    const gx = dir > 0 ? FIELD.halfLength : -FIELD.halfLength;
    return crossing(g, gx);
  };
  const l = shootAt(11, 30, 2, 1, -0.6);
  const r = shootAt(11, 30, -2, 1, 0.6);
  assert.ok(Math.abs(l.z + r.z) < 0.3, `mirrored z agrees (${l.z.toFixed(2)} vs ${r.z.toFixed(2)})`);
  assert.ok(Math.abs(l.y - r.y) < 0.3, `mirrored height agrees (${l.y.toFixed(2)} vs ${r.y.toFixed(2)})`);
  const back = shootAt(11, -30, 2, -1, -0.6);
  assert.ok(Math.abs(back.z - l.z) < 0.4, `far end matches near end (${back.z.toFixed(2)} vs ${l.z.toFixed(2)})`);
  assert.ok(back.y < FIELD.goalHeight, 'far-end finish stays under the bar');
});

test('P0.4 no remote kicks: release with the ball metres away cancels', () => {
  const { g, s, p } = striker(13, 20, 0);
  Object.assign(s.ball, { x: 24, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: null, lock: 0, flight: 'roll' });
  p.x = 20;
  tick(g, DT, { aimU: 0, aimV: 0, shootPressed: true, shootHeld: true });
  tick(g, 0.1, { aimU: 0, aimV: 0, shootHeld: true });
  tick(g, DT, { aimU: 0, aimV: 0, shootReleased: true });
  tick(g, 0.3);
  assert.notEqual(s.ball.flight, 'shot', 'no strike without foot contact');
  assert.equal(s.ball.owner, null, 'ball untouched');
});

test('P0.4 imminent contact buffers and strikes first-time', () => {
  const { g, s, p } = striker(14, 20, 0);
  // Ball rolling toward the striker, ~130ms out at release: buffered, then struck.
  Object.assign(s.ball, { x: 21.8, z: 0, y: FIELD.ballRadius, vx: -6, vy: 0, vz: 0, owner: null, lock: 0, lastTouch: 1, flight: 'pass' });
  p.x = 20; p.facingX = 1;
  tick(g, DT, { aimU: 0, aimV: 0, shootPressed: true, shootHeld: true });
  tick(g, DT, { aimU: 0, aimV: 0, shootReleased: true });
  let struck = s.ball.flight === 'shot';
  for (let i = 0; i < 20 && !struck; i++) {
    tick(g, DT);
    struck = s.ball.flight === 'shot';
  }
  assert.ok(struck, 'buffered first-time finish fires on arrival');
});

test('P0.4 pressure scuffs pace without moving placement', () => {
  const run = (marker: boolean) => {
    const { g, s, p } = striker(15, 30, 0);
    if (marker) {
      // Tight marker facing away: pressure without an instant tackle, so the
      // strike still happens but scuffed.
      const foe = s.players.find((q) => q.team === 1 && !q.keeper)!;
      foe.x = p.x - 1.0; foe.z = 0; foe.vx = foe.vz = 0;
      foe.facingX = -1; foe.facingZ = 0; foe.think = 100;
    }
    tick(g, DT, { aimU: 0.5, aimV: 0, shootPressed: true, shootHeld: true });
    tick(g, 0.2, { aimU: 0.5, aimV: 0, shootHeld: true });
    tick(g, DT, { aimU: 0.5, aimV: 0, shootReleased: true });
    return { speed: Math.hypot(s.ball.vx, s.ball.vz), cross: crossing(g, FIELD.halfLength) };
  };
  const free = run(false), pressed = run(true);
  assert.ok(pressed.speed < free.speed - 3, `marker takes pace off (${free.speed.toFixed(1)} → ${pressed.speed.toFixed(1)})`);
  assert.ok(Math.abs(pressed.cross.z - free.cross.z) < 0.8, 'placement sector survives pressure');
});

test('P0.4 spin physics retained: spin bends flight and decays', () => {
  const { g } = striker(7);
  const b = g.state.ball;
  Object.assign(b, { x: 20, y: 1, z: 0, vx: -18, vy: .5, vz: 0, spin: 4, owner: null, lock: 1, flight: 'shot' });
  const z0 = b.z;
  tick(g, .5);
  assert.ok(Math.abs(b.z - z0) > .4, `spin curls the flight (dz=${(b.z - z0).toFixed(2)} m)`);
  assert.ok(Math.abs(b.spin) < 4, 'spin decays in the air');
});
