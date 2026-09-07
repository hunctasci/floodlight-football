import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareSignalingClient, SignalError } from '../src/net/cloudflare-signal.ts';

/** Scripted fake WebSocket: the test plays the Durable Object. */
class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  url: string;
  private handlers = new Map<string, Array<(e: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
  }

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

const TOKEN = '0'.repeat(64);
const okHealth = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) }) as Promise<Response>;

function clientWith(sock: FakeSocket, fetchFn: (url: string, init?: RequestInit) => Promise<Response> = (() =>
  okHealth()) as (url: string, init?: RequestInit) => Promise<Response>) {
  return new CloudflareSignalingClient(((u: string) => {
    assert.match(u, /\/api\/rooms\/[A-Z0-9]{6}\/socket\?clientId=/);
    (sock as unknown as { url: string }).url = u;
    return sock as unknown as WebSocket;
  }) as (u: string) => WebSocket, fetchFn);
}

test('socketUrl targets the per-room Durable Object endpoint', () => {
  assert.equal(
    CloudflareSignalingClient.socketUrl('http://127.0.0.1:8787', 'ABCDEF', 'aaaaaaaa'),
    'ws://127.0.0.1:8787/api/rooms/ABCDEF/socket?clientId=aaaaaaaa',
  );
  assert.equal(
    CloudflareSignalingClient.socketUrl('https://play.example.com/', 'ABCDEF', 'aaaaaaaa'),
    'wss://play.example.com/api/rooms/ABCDEF/socket?clientId=aaaaaaaa',
  );
});

test('connect probes the control plane, fails without it', async () => {
  const sig = new CloudflareSignalingClient(
    (() => { throw new Error('unreachable'); }) as unknown as (u: string) => WebSocket,
    (() => okHealth()) as unknown as (url: string, init?: RequestInit) => Promise<Response>,
  );
  await sig.connect('https://play.example.com');
  sig.close();

  const dead = new CloudflareSignalingClient(
    (() => { throw new Error('nope'); }) as unknown as (u: string) => WebSocket,
    (async () => { throw new Error('down'); }) as (url: string, init?: RequestInit) => Promise<Response>,
  );
  await assert.rejects(dead.connect('https://play.example.com'), (e: unknown) =>
    e instanceof SignalError && e.message === 'SERVER UNREACHABLE');

  const wrong = new CloudflareSignalingClient(
    (() => { throw new Error('nope'); }) as unknown as (u: string) => WebSocket,
    (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as (
      url: string, init?: RequestInit,
    ) => Promise<Response>,
  );
  await assert.rejects(wrong.connect('https://play.example.com'), (e: unknown) =>
    e instanceof SignalError && e.message === 'SERVER UNREACHABLE');
});

const tick = () => new Promise<void>((r) => setImmediate(r));

test('host creates a room over REST then joins its socket', async () => {
  const sock = new FakeSocket('');
  const posts: unknown[] = [];
  const sig = clientWith(sock, (async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/health')) return okHealth();
    posts.push(JSON.parse((init?.body as string) ?? '{}'));
    return { ok: true, status: 201, json: async () => ({ roomCode: 'ABCDEF', matchToken: TOKEN }) };
  }) as (url: string, init?: RequestInit) => Promise<Response>);
  await sig.connect('https://play.example.com');
  const creating = sig.createRoom('aaaaaaaa');
  await tick(); // let the POST resolve and the socket listeners register
  sock.open();
  await tick(); // let the open resolve and the join waiter register
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: [], matchToken: TOKEN });
  assert.deepEqual(posts, [{ clientId: 'aaaaaaaa' }]);
  assert.deepEqual(await creating, { roomCode: 'ABCDEF', matchToken: TOKEN });
  assert.match(sock.url, /ABCDEF/);
  sig.close();
});

test('joiner lands in the room with peers + token', async () => {
  const sock = new FakeSocket('');
  const sig = clientWith(sock);
  await sig.connect('https://play.example.com');
  const joining = sig.joinRoom('ABCDEF', 'bbbbbbbb');
  sock.open();
  await tick();
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: ['aaaaaaaa'], matchToken: TOKEN });
  assert.deepEqual(await joining, { roomCode: 'ABCDEF', peers: ['aaaaaaaa'], matchToken: TOKEN });
  sig.close();
});

test('bad codes never reach the network', async () => {
  const sock = new FakeSocket('');
  const sig = clientWith(sock);
  await sig.connect('https://play.example.com');
  await assert.rejects(sig.joinRoom('nope!!', 'bbbbbbbb'), (e: unknown) =>
    e instanceof SignalError && /BAD CODE/.test(e.message));
  assert.equal(sock.sent.length, 0);
  sig.close();
});

test('relayed SDP and presence route to callbacks, not waiters', async () => {
  const sock = new FakeSocket('');
  const sig = clientWith(sock);
  await sig.connect('https://play.example.com');
  const joining = sig.joinRoom('ABCDEF', 'bbbbbbbb');
  sock.open();
  await tick();
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: [], matchToken: TOKEN });
  await joining;
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

test('server errors surface as messages; mismatched tokens rejected', async () => {
  const sock = new FakeSocket('');
  const sig = clientWith(sock);
  await sig.connect('https://play.example.com');
  const joining = sig.joinRoom('ZZZZZZ', 'bbbbbbbb');
  sock.open();
  await tick();
  sock.serverSend({ t: 'error', message: 'room not found or expired' });
  await assert.rejects(joining, (e: unknown) =>
    e instanceof SignalError && e.message === 'ROOM NOT FOUND OR EXPIRED');

  const sock2 = new FakeSocket('');
  const sig2 = clientWith(sock2);
  await sig2.connect('https://play.example.com');
  const joining2 = sig2.joinRoom('ABCDEF', 'bbbbbbbb');
  sock2.open();
  await tick();
  sock2.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: [], matchToken: 'short' });
  await assert.rejects(joining2, (e: unknown) =>
    e instanceof SignalError && e.message === 'BAD SERVER REPLY');
  sig.close();
  sig2.close();
});
