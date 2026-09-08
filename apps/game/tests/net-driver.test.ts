import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_INPUT, type InputFrame } from '../src/types.ts';
import { LoopbackTransport } from '../src/net/transport.ts';
import { HASH_EVERY } from '../src/net/session.ts';
import { NetDriver } from '../src/net/driver.ts';

/** Delay loopback delivery by `latency()` frames (deterministic, frame-counted). */
function latencyPipe(t: LoopbackTransport, latency: () => number, now: () => number) {
  const orig = t.send.bind(t);
  const q: Array<{ at: number; d: Uint8Array }> = [];
  (t as { send: (d: Uint8Array) => void }).send = (d) => q.push({ at: now(), d: d.slice() });
  return () => {
    for (let i = q.length - 1; i >= 0; i--) {
      if (now() - q[i].at >= latency()) {
        const m = q.splice(i, 1)[0];
        orig(new Uint8Array(m.d));
      }
    }
  };
}

function driveInput(frame: number, flip: boolean): InputFrame {
  const s = flip ? -1 : 1;
  return {
    ...EMPTY_INPUT, x: s * 1, z: frame % 120 < 60 ? 0.2 : -0.2,
    sprint: frame % 3 === 0, pass: frame % 200 === 60,
    shootPressed: frame % 260 === 200, shootHeld: frame % 260 >= 200 && frame % 260 < 210,
    shootReleased: frame % 260 === 210,
  };
}

function pairHosts(openOrder: 'host-first' | 'guest-first', duration = 60) {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration });
  const guest = new NetDriver(tb, { host: false, duration: 300 });
  if (openOrder === 'host-first') { ta.open(); tb.open(); }
  else {
    tb.open(); // hello sent while host is down: dropped, retry covers it
    ta.open();
    guest.poll(Date.now() + 1000);
  }
  return { host, guest };
}

/** Both users pressed READY: the only path to a started match. */
function bothReady(host: NetDriver, guest: NetDriver) {
  host.setReady(); guest.setReady();
}

function kickFor(d: NetDriver): Partial<InputFrame> {
  const r = d.session?.engine.state.restart;
  if (!r) return {};
  const mine = r.team === d.myTeam;
  return { pass: mine, x: d.myTeam === 0 ? 1 : -1, z: 0 };
}

test('handshake agrees seed/teams regardless of open order', () => {
  for (const order of ['host-first', 'guest-first'] as const) {
    const { host, guest } = pairHosts(order);
    assert.ok(host.events.some((e) => e.type === 'connected'), `${order}: host connected`);
    assert.ok(guest.events.some((e) => e.type === 'connected'), `${order}: guest connected`);
    bothReady(host, guest);
    const hs = host.events.find((e) => e.type === 'started');
    const gs = guest.events.find((e) => e.type === 'started');
    assert.ok(hs && hs.type === 'started' && gs && gs.type === 'started', `${order}: both started`);
    assert.equal(hs.seed, gs.seed);
    assert.equal(hs.myTeam, 0); assert.equal(gs.myTeam, 1);
    assert.equal(guest.session?.engine.state.halfDuration, 60, 'guest adopts host duration');
    host.close(); guest.close();
  }
});

test('match starts only after both sides press ready', () => {
  const { host, guest } = pairHosts('host-first');
  assert.ok(!host.events.some((e) => e.type === 'started'), 'connected but not started');
  host.setReady();
  assert.ok(!host.events.some((e) => e.type === 'started'), 'one ready is not enough');
  assert.ok(guest.events.some((e) => e.type === 'peerReady'), 'guest sees host ready');
  assert.ok(!guest.events.some((e) => e.type === 'started'), 'guest waits for its own user');
  guest.setReady();
  assert.ok(host.events.some((e) => e.type === 'started'), 'host starts on second ready');
  assert.ok(guest.events.some((e) => e.type === 'started'), 'guest starts on second ready');
  host.close(); guest.close();
});

test('handshake refuses a peer from another room (token mismatch)', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, matchToken: '0'.repeat(32) });
  const guest = new NetDriver(tb, { host: false, matchToken: '1'.repeat(32) });
  ta.open(); tb.open();
  assert.ok(host.events.some((e) => e.type === 'error'), 'host rejects the stray peer');
  assert.ok(!host.events.some((e) => e.type === 'started'), 'no match with a stranger');
  host.close(); guest.close();
});

test('matching room tokens pass the handshake', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const token = 'a'.repeat(32);
  const host = new NetDriver(ta, { host: true, matchToken: token });
  const guest = new NetDriver(tb, { host: false, matchToken: token });
  ta.open(); tb.open();
  bothReady(host, guest);
  assert.ok(host.events.some((e) => e.type === 'started'), 'same room starts');
  assert.ok(!host.events.some((e) => e.type === 'error'), 'no false mismatch');
  host.close(); guest.close();
});

test('drivers stay in sync over latency, hashes flowing', () => {
  const { host, guest } = pairHosts('host-first');
  let now = 0;
  const pipeA = latencyPipe(
    (host as unknown as { transport: LoopbackTransport }).transport, () => 2, () => now);
  const pipeB = latencyPipe(
    (guest as unknown as { transport: LoopbackTransport }).transport, () => 2, () => now);
  const ha: number[] = [], hb: number[] = [];
  let sampled = -1;
  for (let f = 0; f < 400; f++) {
    pipeA(); pipeB();
    host.poll(); guest.poll();
    const ia = { ...driveInput(f, false), ...kickFor(host) };
    const ib = { ...driveInput(f, true), ...kickFor(guest) };
    host.frame(ia); guest.frame(ib);
    const t = host.session!.tick;
    if (t === guest.session!.tick && t % HASH_EVERY === 0 && t > sampled) {
      sampled = t;
      ha.push(host.session!.hash()); hb.push(guest.session!.hash());
    }
    now++;
  }
  // Drain in-flight packets so both ends quiesce at the same tick.
  for (let f = 0; f < 12; f++) {
    pipeA(); pipeB();
    host.frame({ ...EMPTY_INPUT }); guest.frame({ ...EMPTY_INPUT });
  }
  assert.ok(ha.length > 5, 'sampled several agreed ticks');
  assert.deepEqual(ha, hb, 'hashes equal through 400 frames');
  assert.equal(host.session!.tick, guest.session!.tick);
  assert.equal(host.session!.desyncs, 0); assert.equal(guest.session!.desyncs, 0);
  assert.ok(host.session!.lastAgreeTick > 0 && guest.session!.lastAgreeTick > 0, 'hash exchange agrees');
  host.close(); guest.close();
});

test('pause/resume round-trips and freezes both sims', () => {
  const { host, guest } = pairHosts('host-first');
  host.setPaused(true);
  assert.equal(host.session?.engine.state.paused, true);
  assert.equal(guest.session?.engine.state.paused, true, 'guest paused by packet');
  assert.ok(guest.events.some((e) => e.type === 'peerPaused' && (e as { paused: boolean }).paused));
  const t0 = host.session!.tick;
  host.frame({ ...EMPTY_INPUT }); guest.frame({ ...EMPTY_INPUT });
  assert.equal(host.session!.tick, t0, 'no steps while paused');
  guest.setPaused(false);
  assert.equal(host.session?.engine.state.paused, false);
  host.close(); guest.close();
});

test('quit notifies the peer; drop falls back to AI and continues', () => {
  const { host, guest } = pairHosts('host-first');
  guest.quit();
  assert.ok(host.events.some((e) => e.type === 'peerQuit'));
  host.close();

  const p2 = pairHosts('host-first');
  // Advance a little so the match is live.
  for (let f = 0; f < 30; f++) {
    p2.host.frame({ ...driveInput(f, false), ...kickFor(p2.host) });
    p2.guest.frame({ ...driveInput(f, true), ...kickFor(p2.guest) });
  }
  const t0 = p2.host.session!.tick;
  assert.ok(t0 > 0);
  // Guest link dies silently (no packets either way): host must notice via
  // stall detection, fall back to AI, and keep the match going.
  for (let f = 0; f < NetDriver.DROP_AFTER_STALL + 30; f++) {
    p2.host.frame(driveInput(100 + (f % 200), false));
  }
  assert.ok(p2.host.events.some((e) => e.type === 'peerDropped'));
  assert.equal(p2.host.session?.engine.state.remoteTeam, null);
  assert.ok(p2.host.session!.tick > t0 + 10, 'match continues vs AI after drop');
  p2.host.close();
});

test('handshake timeout errors when the peer never opens', () => {
  const [ta] = LoopbackTransport.pair();
  const d = new NetDriver(ta, { host: false, openTimeoutMs: -1 });
  d.poll();
  assert.ok(d.events.some((e) => e.type === 'error'));
  assert.equal(d.state, 'closed');
});

test('early half-time signal is remembered, not dropped (fast host, slow guest)', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration: 20 });
  const guest = new NetDriver(tb, { host: false, duration: 20 });
  ta.open(); tb.open();
  host.setReady(); guest.setReady();
  const he = host.session!.engine, ge = guest.session!.engine;
  for (const e of [he, ge]) { e.state.phase = 'playing'; e.state.phaseTime = 0; e.state.restart = null; }
  // Guest still playing half 1 while the host already continued.
  he.state.elapsed = he.state.halfDuration;
  he.update(1 / 60, { ...EMPTY_INPUT });
  assert.equal(he.state.phase, 'halftime', 'host reached halftime');
  assert.equal(ge.state.phase, 'playing', 'guest still playing');
  he.continueHalf();
  host.broadcastHalf();
  // Signal arrived early: guest engine untouched, still playing.
  assert.equal(ge.state.phase, 'playing', 'early signal does not disturb live play');
  // Guest reaches the boundary on its own time; the next pumped frame
  // consumes the remembered signal — no stuck HALF TIME. (Both sides keep
  // framing so lockstep inputs keep flowing, as in a live match.)
  ge.state.elapsed = ge.state.halfDuration;
  for (let f = 0; f < 120 && (ge.state.phase as string) !== 'halftime'; f++) {
    host.frame({ ...EMPTY_INPUT }, 1 / 60);
    guest.frame({ ...EMPTY_INPUT }, 1 / 60);
  }
  assert.equal(ge.state.phase, 'halftime');
  host.frame({ ...EMPTY_INPUT }, 1 / 60);
  guest.frame({ ...EMPTY_INPUT }, 1 / 60);
  assert.equal(ge.state.phase, 'kickoff', 'remembered signal continues the guest');
  assert.equal(ge.state.half, 2);
  host.close(); guest.close();
});

test('host-driven half-time converges via broadcast plus resync healing', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration: 20 });
  const guest = new NetDriver(tb, { host: false, duration: 20 });
  ta.open(); tb.open();
  assert.ok(host.session && guest.session);
  // Fast-forward both to half-time; take restarts on the taker's side.
  const kick = (d: typeof host): object => {
    const r = d.session!.engine.state.restart;
    if (!r) return {};
    return r.team === d.myTeam ? { pass: true, x: d.myTeam === 0 ? 1 : -1, z: 0 } : {};
  };
  for (let f = 0; f < 60 * 30 && host.session!.engine.state.phase !== 'halftime'; f++) {
    host.frame({ ...EMPTY_INPUT, ...kick(host) });
    guest.frame({ ...EMPTY_INPUT, ...kick(guest) });
  }
  assert.equal(host.session!.engine.state.phase, 'halftime');
  assert.equal(guest.session!.engine.state.phase, 'halftime');
  // Host continues immediately; guest follows a few frames later via packet.
  // (A tick of skew may heal via snapshot resync first — also correct.)
  host.session!.engine.continueHalf();
  host.broadcastHalf();
  for (let f = 0; f < 10; f++) {
    host.frame({ ...EMPTY_INPUT });
    guest.frame({ ...EMPTY_INPUT });
  }
  assert.ok(['kickoff', 'playing'].includes(guest.session!.engine.state.phase),
    `guest left halftime via broadcast/heal (got ${guest.session!.engine.state.phase})`);
  // Short-term skew heals: keep pumping (taking restarts, re-continuing any
  // re-reached halftime together), hashes must agree again.
  for (let f = 0; f < 900; f++) {
    host.frame({ ...EMPTY_INPUT, ...kick(host) });
    guest.frame({ ...EMPTY_INPUT, ...kick(guest) });
    const hs = host.session!.engine.state, gs = guest.session!.engine.state;
    if (hs.phase === 'halftime' && gs.phase === 'halftime') {
      hs.phase === 'halftime' && host.session!.engine.continueHalf();
      host.broadcastHalf();
    }
  }
  assert.equal(host.session!.hash(), guest.session!.hash(), 'post-half states converge');
  host.close(); guest.close();
});
