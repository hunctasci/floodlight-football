import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_INPUT, type InputFrame } from '../src/types.ts';
import { INPUT_BYTES, decodeInput, encodeInput } from '../src/net/codec.ts';
import { HASH_EVERY, LockstepSession } from '../src/net/session.ts';

test('codec round-trips buttons and analog axes in 3 bytes', () => {
  const f: InputFrame = {
    ...EMPTY_INPUT, x: 0.6, z: -0.8, sprint: true, pass: true,
    shootPressed: true, shootHeld: true, switchPlayer: true,
  };
  const b = encodeInput(f);
  assert.equal(b.length, INPUT_BYTES);
  const d = decodeInput(b);
  assert.ok(Math.abs(d.x - 0.6) < 0.01 && Math.abs(d.z + 0.8) < 0.01);
  for (const k of ['sprint', 'pass', 'shootPressed', 'shootHeld', 'switchPlayer'] as const) assert.ok(d[k]);
  for (const k of ['through', 'cross', 'shootReleased'] as const) assert.ok(!d[k]);
});

test('codec clamps out-of-range axes', () => {
  const d = decodeInput(encodeInput({ ...EMPTY_INPUT, x: 5, z: -5 }));
  assert.ok(Math.abs(d.x) <= 1.27 && Math.abs(d.z) <= 1.27);
});

function driveInput(frame: number, flip: boolean): InputFrame {
  const s = flip ? -1 : 1;
  return {
    ...EMPTY_INPUT, x: s * 1, z: frame % 120 < 60 ? 0.2 : -0.2,
    sprint: frame % 3 === 0, pass: frame % 200 === 60,
    shootPressed: frame % 260 === 200, shootHeld: frame % 260 >= 200 && frame % 260 < 210,
    shootReleased: frame % 260 === 210,
  };
}

test('two lockstep sessions stay in sync over simulated latency', () => {
  const a = new LockstepSession(4242, 180, 0, 0, 3);
  const b = new LockstepSession(4242, 180, 1, 0, 3);
  // Startup burst: both sides pre-send their first `delay` ticks as EMPTY.
  const idle = encodeInput(EMPTY_INPUT);
  for (let t = 0; t < 3; t++) { a.receiveRemote(t, idle); b.receiveRemote(t, idle); }
  // Outboxes keyed by send tick; delivered after LATENCY ticks (<= delay).
  const LATENCY = 2;
  const outA: Array<{ at: number; tick: number; bytes: Uint8Array }> = [];
  const outB: Array<{ at: number; tick: number; bytes: Uint8Array }> = [];
  // Deterministic restart kicks so both leave kickoff identically.
  const kick = (s: LockstepSession): Partial<InputFrame> =>
    s.engine.state.restart ? { pass: s.engine.state.restart.team === s.myTeam, x: s.myTeam === 0 ? 1 : -1, z: 0 } : {};
  let now = 0;
  const hashesA: number[] = [], hashesB: number[] = [];
  for (let step = 0; step < 400; step++) {
    for (const [s, flip, out] of [[a, false, outA], [b, true, outB]] as const) {
      const base = driveInput(s.tick + 3, flip);
      const k = kick(s);
      // sendLocal targets tick+delay; capture what it queued.
      s.sendLocal({ ...base, ...k });
      const queued = (s as unknown as { local: Map<number, Uint8Array> }).local;
      const t = s.tick + 3;
      const bytes = queued.get(t)!;
      assert.ok(bytes, 'local input queued');
      out.push({ at: now, tick: t, bytes });
    }
    for (const [out, to] of [[outA, b], [outB, a]] as const) {
      for (let i = out.length - 1; i >= 0; i--) {
        if (now - out[i].at >= LATENCY) {
          const m = out.splice(i, 1)[0];
          to.receiveRemote(m.tick, m.bytes);
        }
      }
    }
    assert.ok(a.step(), 'A advances');
    assert.ok(b.step(), 'B advances');
    // Hash exchange every HASH_EVERY ticks.
    if (a.tick % HASH_EVERY === 0) {
      const ha = a.hash(), hb = b.hash();
      hashesA.push(ha); hashesB.push(hb);
      a.receiveHash(b.tick, hb);
      b.receiveHash(a.tick, ha);
    }
    now++;
  }
  assert.deepEqual(hashesA, hashesB, 'peers hash equal through 400 ticks');
  assert.equal(a.desyncs, 0); assert.equal(b.desyncs, 0);
  assert.ok(a.lastAgreeTick >= 0 && b.lastAgreeTick >= 0);
});

test('step stalls without remote input and resumes when it arrives', () => {
  const a = new LockstepSession(7, 180, 0, 0, 2);
  a.sendLocal({ ...EMPTY_INPUT });
  assert.equal(a.step(), false, 'stalled: no remote bytes yet');
  // Peer's startup burst arrives; local ticks 0..1 were prefilled EMPTY.
  const E = encodeInput(EMPTY_INPUT);
  a.receiveRemote(0, E); a.receiveRemote(1, E);
  assert.equal(a.step(), true);
  assert.equal(a.tick, 1);
  // Steady state: each frame delivers the current tick and sends ahead.
  for (let f = 0; f < 5; f++) {
    a.receiveRemote(a.tick, E);
    a.sendLocal({ ...EMPTY_INPUT });
    assert.equal(a.step(), true, `frame ${f} advances`);
  }
  assert.equal(a.tick, 6);
});

test('desync is detected and host snapshot recovers it', () => {
  const a = new LockstepSession(99, 180, 0);
  const b = new LockstepSession(99, 180, 1);
  const idle = encodeInput(EMPTY_INPUT);
  for (let t = 0; t < 3; t++) { a.receiveRemote(t, idle); b.receiveRemote(t, idle); }
  const getLocal = (s: LockstepSession, t: number) =>
    (s as unknown as { local: Map<number, Uint8Array> }).local.get(t)!;
  for (let f = 0; f < 60; f++) {
    a.sendLocal(driveInput(f, false)); b.sendLocal(driveInput(f, true));
    a.receiveRemote(a.tick + 3, getLocal(b, b.tick + 3));
    b.receiveRemote(b.tick + 3, getLocal(a, a.tick + 3));
    assert.ok(a.step() && b.step());
    if (a.tick % HASH_EVERY === 0) {
      // Quiescent point: both stepped the same ticks, hashes must agree.
      a.receiveHash(a.tick, b.hash());
      b.receiveHash(b.tick, a.hash());
    }
  }
  assert.equal(a.hash(), b.hash());
  assert.ok(a.lastAgreeTick >= 0 && b.lastAgreeTick >= 0);
  assert.equal(a.desyncs, 0); assert.equal(b.desyncs, 0);
  // Corrupt B with an extra unsanctioned tick.
  b.engine.update(1 / 60, { ...EMPTY_INPUT, x: 1 });
  assert.notEqual(a.hash(), b.hash());
  b.receiveHash(b.tick, a.hash());
  assert.equal(b.desyncs, 1, 'live divergence detected');
  // Host recovery: adopt A's snapshot.
  const snap = a.engine.snapshot();
  b.applySnapshot(snap, a.tick);
  assert.equal(a.hash(), b.hash(), 'recovered to identical state');
  assert.equal(b.tick, a.tick);
});
