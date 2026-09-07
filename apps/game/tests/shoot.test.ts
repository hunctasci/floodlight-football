import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
const tick = (g: MatchEngine, seconds = DT, input: Partial<InputFrame> = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input });
};
function striker(seed = 7, z = 0) {
  const g = new MatchEngine(0, 180, seed);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  for (const p of s.players) { p.x = p.team ? 36 : -36; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const p = s.players.find(p => p.team === 0 && !p.keeper)!;
  s.controlled = p.id; p.x = 6; p.z = z; p.facingX = 1; p.facingZ = 0;
  Object.assign(s.ball, { x: 6.7, y: FIELD.ballRadius, z, vx: 0, vy: 0, vz: 0, spin: 0, owner: p.id, lastKicker: null, lock: 0, lastTouch: 0, flight: 'roll' });
  return g;
}
/** Fires with a hold of `hold` seconds, then returns the launched ball. */
function fire(seed: number, aim: { x: number; z: number }, hold: number, extra: Partial<InputFrame> = {}) {
  const g = striker(seed);
  tick(g, DT, { x: aim.x, z: aim.z, shootPressed: true, shootHeld: true, ...extra });
  tick(g, Math.max(0, hold - DT), { x: aim.x, z: aim.z, shootHeld: true, ...extra });
  tick(g, DT, { x: aim.x, z: aim.z, shootReleased: true, ...extra });
  const b = g.state.ball;
  assert.equal(b.owner, null);
  assert.equal(b.flight, 'shot');
  return b;
}

test('full-power shots are faster than taps (charge = risk/reward power)', () => {
  const tap = fire(7, { x: 1, z: 0 }, 0);
  const full = fire(7, { x: 1, z: 0 }, .55);
  const tapSpeed = Math.hypot(tap.vx, tap.vz), fullSpeed = Math.hypot(full.vx, full.vz);
  assert.ok(fullSpeed > tapSpeed + 6, `charge adds pace (${tapSpeed.toFixed(1)} → ${fullSpeed.toFixed(1)} m/s)`);
});

test('continuous aim reaches the corners of the goal mouth', () => {
  const b = fire(7, { x: .6, z: .8 }, .12);
  const zAtGoal = b.z + b.vz / b.vx * (FIELD.halfLength - b.x);
  assert.ok(Math.abs(zAtGoal) > 2.4, `wide stick aim finds the corner (z=${zAtGoal.toFixed(2)})`);
  assert.ok(Math.abs(zAtGoal) < FIELD.goalHalfWidth, 'aimed shot stays on target');
});

test('sprint+shoot is a flat driven strike', () => {
  const b = fire(7, { x: 1, z: 0 }, .55, { sprint: true });
  const speed = Math.hypot(b.vx, b.vz);
  assert.ok(speed > 28, `driven is fierce (${speed.toFixed(1)} m/s)`);
  assert.ok(b.vy < 1.2, `driven stays flat (vy=${b.vy.toFixed(2)})`);
  assert.ok(Math.abs(b.spin || 0) < .01, 'driven has no curve');
});

test('low wide shots become curlers with Magnus spin', () => {
  const b = fire(7, { x: .6, z: .8 }, .06);
  assert.ok((b.spin || 0) > 1.5, `finesse spins toward the corner (spin=${(b.spin || 0).toFixed(2)})`);
  assert.ok(Math.hypot(b.vx, b.vz) < 26, 'curler is softer than a placed drive');
});

test('spin bends the ball sideways in flight', () => {
  const g = striker(7);
  const b = g.state.ball;
  Object.assign(b, { x: 20, y: 1, z: 0, vx: -18, vy: .5, vz: 0, spin: 4, owner: null, lock: 1, flight: 'shot' });
  const z0 = b.z;
  tick(g, .5);
  assert.ok(Math.abs(b.z - z0) > .4, `spin curls the flight (dz=${(b.z - z0).toFixed(2)} m)`);
  assert.ok(Math.abs(b.spin) < 4, 'spin decays in the air');
});

test('keeper holds shots at his chest and spills full-stretch rockets', () => {
  const attempt = (seed: number, corner: boolean) => {
    const g = new MatchEngine(0, 180, seed);
    const s = g.state;
    s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
    const k = s.players[0];
    k.x = -45.2; k.z = corner ? 0 : 0; k.vx = k.vz = 0; k.cooldown = 0;
    const bz = corner ? 3 : .1;
    Object.assign(s.ball, { x: -41, y: .5, z: bz, vx: corner ? -26 : -16, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 1, lock: 0, lastKicker: null, flight: 'shot' });
    tick(g, .8);
    return s.ball.owner === k.id;
  };
  let chest = 0, corner = 0;
  for (let seed = 1; seed <= 24; seed++) { if (attempt(seed, false)) chest++; if (attempt(seed, true)) corner++; }
  assert.ok(chest > 18, `chest-height saves are held (${chest}/24)`);
  assert.ok(corner < chest - 4, `stretched rockets spill much more (${corner}/24 held)`);
});
