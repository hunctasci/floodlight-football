import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT, FIELD, type InputFrame } from '../src/types.ts';

const DT = 1 / 60;
const tick2 = (g: MatchEngine, seconds: number, input: Partial<InputFrame> = {}, peer: Partial<InputFrame> = {}) => {
  for (let i = 0; i < Math.ceil(seconds / DT); i++) g.update(DT, { ...EMPTY_INPUT, ...input }, { ...EMPTY_INPUT, ...peer });
};
function versus(seed = 77) {
  const g = new MatchEngine(0, 180, seed);
  g.setRemoteTeam(1);
  const s = g.state;
  s.phase = 'playing'; s.phaseTime = 0; s.restart = null; s.paused = false;
  return g;
}

test('two humans drive their own teams independently', () => {
  const g = versus(); const s = g.state;
  const me = s.players[s.controlled], peer = s.players[s.peerControlled];
  assert.equal(me.team, 0); assert.equal(peer.team, 1);
  me.x = 0; me.z = 0; me.vx = me.vz = 0;
  peer.x = 10; peer.z = 0; peer.vx = peer.vz = 0;
  Object.assign(s.ball, { x: 0.7, z: 0, owner: me.id, lastKicker: null, lock: 0 });
  tick2(g, 0.5, { x: 1, z: 0 }, { x: -1, z: 0 });
  assert.ok(me.x > 2, `local moved +x (${me.x.toFixed(2)})`);
  assert.ok(peer.x < 8, `peer moved -x (${peer.x.toFixed(2)})`);
  assert.equal(s.controlled, me.id);
  assert.equal(s.peerControlled, peer.id);
});

test('peer pass auto-switches peer control only', () => {
  const g = versus(); const s = g.state;
  for (const p of s.players) { p.x = p.team === 0 ? -30 : 30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  const carrier = s.players[s.peerControlled];
  carrier.x = 20; carrier.z = 0; carrier.facingX = -1; carrier.facingZ = 0;
  const rec = s.players[20]; rec.x = 12; rec.z = 0; rec.vx = rec.vz = 0;
  Object.assign(s.ball, { x: 19.3, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: carrier.id, lastKicker: null, lock: 0, lastTouch: 1, flight: 'roll' });
  s.controlled = 10; s.players[10].x = -20; s.players[10].z = 0;
  tick2(g, DT, {}, { x: -1, z: 0, pass: true });
  assert.equal(s.peerTarget, rec.id);
  assert.equal(s.controlled, 10, 'local control untouched by peer pass');
  tick2(g, 1.2);
  assert.equal(s.ball.owner, rec.id, 'peer receiver takes the ball');
  assert.equal(s.peerControlled, rec.id);
  // Idle local control may have followed a closer chaser (arcade
  // auto-switch) — but it always stays a team-0 outfielder, never the peer's.
  const mine = s.players[s.controlled];
  assert.equal(mine.team, 0, 'local control stays on our team');
  assert.equal(mine.keeper, false, 'local control stays outfield');
});

test('idle local control follows the closest defender (arcade auto-switch)', () => {
  const g = versus(); const s = g.state;
  for (const p of s.players) { p.x = p.team === 0 ? -30 : 30; p.z = -25 + (p.id % 11) * 4.5; p.vx = p.vz = 0; p.cooldown = 0; p.think = 100; }
  // Foe owns the ball upfield; our pick idles far from it while a teammate
  // chases near it. Idle hands lose control to the closer man.
  const foe = s.players.find((p) => p.team === 1 && !p.keeper)!;
  foe.x = 20; foe.z = 0;
  Object.assign(s.ball, { x: 20.7, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: foe.id, lastKicker: null, lock: 0, lastTouch: 1, flight: 'roll' });
  s.controlled = 10; s.players[10].x = -20; s.players[10].z = 0;
  const chaser = s.players[1]; chaser.x = 14; chaser.z = 0; chaser.vx = chaser.vz = 0;
  tick2(g, 0.5);
  assert.equal(s.controlled, chaser.id, 'idle control follows the closest defender');
  // …but actively steering the stick keeps the current pick.
  s.controlled = 10;
  tick2(g, 0.5, { x: 1, z: 0 });
  assert.equal(s.controlled, 10, 'steering keeps manual control');
});

test('peer keeper distributes on peer input', () => {
  const g = versus(); const s = g.state;
  const k = s.players[11];
  k.x = k.homeX; k.z = 0; k.vx = k.vz = 0; k.cooldown = 0;
  Object.assign(s.ball, { x: k.x - 0.6, z: 0, y: FIELD.ballRadius, vx: 0, vy: 0, vz: 0, owner: k.id, lastTouch: 1, lock: 0, lastKicker: null, flight: 'roll' });
  tick2(g, DT, {}, { x: -1, z: 0, pass: true });
  assert.equal(s.ball.owner, null);
  assert.equal(s.ball.flight, 'pass');
  assert.notEqual(s.peerTarget, null);
});

test('deterministic across instances; snapshot/restore resumes identically', () => {
  const drive = (frame: number) => ({
    input: { x: 1, z: frame % 120 < 60 ? 0.2 : -0.2, sprint: frame % 3 === 0, pass: frame % 200 === 60, shootPressed: frame % 260 === 200, shootHeld: frame % 260 >= 200 && frame % 260 < 210, shootReleased: frame % 260 === 210 } as Partial<InputFrame>,
    peer: { x: -1, z: frame % 90 < 45 ? -0.2 : 0.2, sprint: frame % 4 === 0, long: frame % 230 === 100 } as Partial<InputFrame>,
  });
  const run = (frames: number, from?: MatchEngine) => {
    const g = from ?? new MatchEngine(0, 180, 99);
    if (!from) g.setRemoteTeam(1);
    const hashes: number[] = [];
    for (let f = 0; f < frames; f++) {
      const d = drive(f);
      // Kick off restarts deterministically on both sides.
      const r = g.state.restart;
      const kick = r ? { pass: r.team === 0, long: r.team === 0 && g.state.phase === 'corner', shootPressed: false, x: 1, z: 0 } : {};
      const pkick = r ? { pass: r.team === 1, long: false, shootPressed: r.team === 1 && g.state.phase === 'goalkick', x: -1, z: 0 } : {};
      g.update(DT, { ...EMPTY_INPUT, ...d.input, ...kick }, { ...EMPTY_INPUT, ...d.peer, ...pkick });
      g.events.splice(0);
      if ((f + 1) % 30 === 0) hashes.push(g.hash());
    }
    return { g, hashes };
  };
  const a = run(300), b = run(300);
  assert.deepEqual(a.hashes, b.hashes, 'identical inputs+seed hash equal');

  const c0 = new MatchEngine(0, 180, 99); c0.setRemoteTeam(1);
  const mid = run(150, c0);
  const snap = mid.g.snapshot();
  const d0 = new MatchEngine(0, 999, 12345);
  d0.restore(snap);
  assert.equal(d0.hash(), mid.g.hash(), 'restored engine hashes equal at resume point');
  const c = run(150, mid.g), d = run(150, d0);
  assert.deepEqual(c.hashes, d.hashes, 'resumed run matches uninterrupted run');
});
