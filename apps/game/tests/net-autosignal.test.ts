import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoSignal, SignalError } from '../src/net/autosignal.ts';

/** Scripted fake WebSocket: the test plays the server. */
class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  private handlers = new Map<string, Array<(e: unknown) => void>>();

  addEventListener(type: string, fn: (e: unknown) => void) {
    const a = this.handlers.get(type) ?? [];
    a.push(fn);
    this.handlers.set(type, a);
  }

  emit(type: string, e: unknown = {}) {
    for (const fn of this.handlers.get(type) ?? []) fn(e);
  }

  open() {
    this.readyState = 1;
    this.emit('open');
  }

  serverSend(o: unknown) {
    this.emit('message', { data: JSON.stringify(o) });
  }

  send(s: string) { this.sent.push(s); }
  close() { this.readyState = 3; this.emit('close'); }
  lastSent<T>(): T { return JSON.parse(this.sent[this.sent.length - 1]) as T; }
}

const TOKEN = '0'.repeat(32);

test('socketUrl derives the signal endpoint from the http base', () => {
  assert.equal(AutoSignal.socketUrl('http://127.0.0.1:8080'), 'ws://127.0.0.1:8080/socket');
  assert.equal(AutoSignal.socketUrl('https://play.example.com/'), 'wss://play.example.com/socket');
});

test('host creates a room and learns code + token', async () => {
  const sock = new FakeSocket();
  const sig = new AutoSignal(() => sock as unknown as WebSocket);
  const connecting = sig.connect('http://x');
  sock.open();
  await connecting;
  const creating = sig.createRoom('aaaaaaaa');
  assert.deepEqual(sock.lastSent(), { t: 'create-room', clientId: 'aaaaaaaa' });
  sock.serverSend({ t: 'room-created', roomCode: 'ABCDEF', matchToken: TOKEN });
  assert.deepEqual(await creating, { roomCode: 'ABCDEF', matchToken: TOKEN });
  sig.close();
});

test('joiner lands in the room with peers + token', async () => {
  const sock = new FakeSocket();
  const sig = new AutoSignal(() => sock as unknown as WebSocket);
  const connecting = sig.connect('http://x');
  sock.open();
  await connecting;
  const joining = sig.joinRoom('ABCDEF', 'bbbbbbbb');
  assert.deepEqual(sock.lastSent(), { t: 'join-room', code: 'ABCDEF', clientId: 'bbbbbbbb' });
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: ['aaaaaaaa'], matchToken: TOKEN });
  assert.deepEqual(await joining, { roomCode: 'ABCDEF', peers: ['aaaaaaaa'], matchToken: TOKEN });
  sig.close();
});

test('relayed SDP and presence route to callbacks, not waiters', async () => {
  const sock = new FakeSocket();
  const sig = new AutoSignal(() => sock as unknown as WebSocket);
  const connecting = sig.connect('http://x');
  sock.open();
  await connecting;
  const signals: unknown[] = [];
  const joined: unknown[] = [];
  sig.onPeerSignal = (from, sdp) => signals.push([from, sdp]);
  sig.onPeerJoined = (id) => joined.push(id);
  sock.serverSend({ t: 'peer-joined', clientId: 'aaaaaaaa' });
  sock.serverSend({ t: 'signaled', from: 'aaaaaaaa', payload: { type: 'offer', sdp: 'v=0' } });
  assert.deepEqual(joined, ['aaaaaaaa']);
  assert.deepEqual(signals, [['aaaaaaaa', { type: 'offer', sdp: 'v=0' }]]);
  sig.sendSignal('aaaaaaaa', { type: 'answer', sdp: 'v=0' });
  assert.deepEqual(sock.lastSent(), { t: 'signal', to: 'aaaaaaaa', payload: { type: 'answer', sdp: 'v=0' } });
  sig.close();
});

test('server errors surface as messages; outages as unreachable', async () => {
  const sock = new FakeSocket();
  const sig = new AutoSignal(() => sock as unknown as WebSocket);
  const connecting = sig.connect('http://x');
  sock.open();
  await connecting;
  const joining = sig.joinRoom('ZZZZZZ', 'bbbbbbbb');
  sock.serverSend({ t: 'error', message: 'room not found or expired' });
  await assert.rejects(joining, (e: unknown) =>
    e instanceof SignalError && e.message === 'ROOM NOT FOUND OR EXPIRED');

  const dead = new AutoSignal(() => { throw new Error('no network'); });
  await assert.rejects(dead.connect('http://x'), (e: unknown) =>
    e instanceof SignalError && e.message === 'SERVER UNREACHABLE');
  sig.close();
});

test('malformed server replies are rejected, never trusted', async () => {
  const sock = new FakeSocket();
  const sig = new AutoSignal(() => sock as unknown as WebSocket);
  const connecting = sig.connect('http://x');
  sock.open();
  await connecting;
  const creating = sig.createRoom('aaaaaaaa');
  sock.serverSend({ t: 'room-created', roomCode: 'nope', matchToken: 'short' });
  await assert.rejects(creating, (e: unknown) =>
    e instanceof SignalError && e.message === 'BAD SERVER REPLY');
  sig.close();
});
