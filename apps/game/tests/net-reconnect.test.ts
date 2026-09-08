import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_INPUT } from '../src/types.ts';
import { LoopbackTransport } from '../src/net/transport.ts';
import { NetDriver } from '../src/net/driver.ts';

/**
 * Second-connect regression suite: a teardown must fully detach the dead
 * session (transport callbacks, driver events, signaling waiters) so a fresh
 * handshake on new transports always succeeds — the reported "connects once,
 * never twice" class of bug.
 */

function handshake(duration = 60): { host: NetDriver; guest: NetDriver } {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true, duration });
  const guest = new NetDriver(tb, { host: false, duration: 300 });
  ta.open(); tb.open();
  assert.ok(host.events.some((e) => e.type === 'connected'), 'host connected');
  assert.ok(guest.events.some((e) => e.type === 'connected'), 'guest connected');
  return { host, guest };
}

function playSome(host: NetDriver, guest: NetDriver, frames = 30) {
  for (let f = 0; f < frames; f++) {
    host.frame({ ...EMPTY_INPUT, x: 1 }, 1 / 60);
    guest.frame({ ...EMPTY_INPUT, x: -1 }, 1 / 60);
    host.poll(); guest.poll();
  }
  assert.ok((host.session?.tick ?? 0) > 0, 'first session actually stepped');
}

/** Drain in-flight inputs so both ends quiesce at the same tick, then compare.
 *  Only the behind side steps (both sides stepping preserves any gap). */
function assertQuiesced(host: NetDriver, guest: NetDriver, label: string) {
  for (let f = 0; f < 30 && host.session!.tick !== guest.session!.tick; f++) {
    const behind = host.session!.tick < guest.session!.tick ? host : guest;
    behind.frame({ ...EMPTY_INPUT }, 1 / 60);
  }
  assert.equal(host.session!.tick, guest.session!.tick, `${label}: ticks converge`);
  assert.equal(host.session!.hash(), guest.session!.hash(), `${label}: hashes agree`);
}

test('quit + close fully detaches: second handshake on fresh transports works', () => {
  const first = handshake();
  first.host.setReady(); first.guest.setReady();
  assert.ok(first.host.events.some((e) => e.type === 'started'), 'first match started');
  playSome(first.host, first.guest);

  // Full teardown, both orders (quit sends the packet, close detaches).
  first.host.quit();
  first.guest.close();
  first.host.close();

  const second = handshake();
  second.host.setReady(); second.guest.setReady();
  assert.ok(second.host.events.some((e) => e.type === 'started'), 'second match started');
  assert.ok(second.guest.events.some((e) => e.type === 'started'), 'second guest started');
  playSome(second.host, second.guest);
  assertQuiesced(second.host, second.guest, 'second session');
  second.host.close(); second.guest.close();
});

test('closed driver detaches transport callbacks (late bytes go nowhere)', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const host = new NetDriver(ta, { host: true });
  const guest = new NetDriver(tb, { host: false });
  ta.open(); tb.open();
  host.close(); guest.close();
  assert.equal(ta.onmessage, null, 'host transport detached');
  assert.equal(ta.onstate, null, 'host state detached');
  assert.equal(tb.onmessage, null, 'guest transport detached');
  assert.equal(host.state, 'closed');
  // Late delivery after close must not throw or resurrect the session.
  tb.open();
  ta.send(new Uint8Array([9, 9, 9]));
});

test('abandoned lobby (close before ready) never starts or leaks into the next session', () => {
  const first = handshake();
  // Guest vanishes before anyone presses ready.
  first.guest.close();
  first.host.close();
  assert.ok(!first.host.events.some((e) => e.type === 'started'), 'abandoned lobby never starts');

  const second = handshake();
  second.host.setReady(); second.guest.setReady();
  assert.ok(second.host.events.some((e) => e.type === 'started'), 'next session starts clean');
  assert.ok(second.guest.events.some((e) => e.type === 'started'), 'next guest starts clean');
  second.host.close(); second.guest.close();
});
