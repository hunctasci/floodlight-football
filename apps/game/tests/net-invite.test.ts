import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildInviteUrl, friendlyNetError, inviteCodeFromSearch, normalizeRoomCode, parseInviteUrl,
  withRelayHint,
} from '../src/net/invite.ts';
import { isValidSignalPayload, parseInbound, addMember, MAX_MEMBERS } from '../worker/room-logic.ts';
import { isValidSignalPayload as isValidClientPayload } from '../src/net/transport.ts';
import { CloudflareSignalingClient, SignalError } from '../src/net/cloudflare-signal.ts';
import { LoopbackTransport } from '../src/net/transport.ts';
import { NetDriver } from '../src/net/driver.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, '..', 'src', 'main.ts'), 'utf8');

// 1. Invitation URL encodes room identity correctly: code only, current
// origin, no SDP / tokens / Durable Object ids, messaging-app safe.
test('invite URL carries the room code only (no SDP, secrets or DO ids)', () => {
  const url = buildInviteUrl('https://play.example.com', '/', 'abcdef');
  assert.equal(url, 'https://play.example.com/?room=ABCDEF');
  assert.equal(buildInviteUrl('https://h:443/', '/game/', 'ABCDEF'), 'https://h:443/game/?room=ABCDEF');
  assert.throws(() => buildInviteUrl('https://h', '/', 'nope!!'));
  // Shareable without manual editing: the code value is plain alphanumerics
  // (no base64 padding, slashes or spaces), one query param only.
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get('room'), 'ABCDEF');
  assert.ok(/^[A-Za-z0-9]+$/.test(parsed.searchParams.get('room') ?? ''), 'code value needs no editing');
  assert.ok(!url.includes(' '), 'no spaces to escape');
  assert.equal(parseInviteUrl(url), 'ABCDEF');
  // No secret material ever lands in the URL.
  assert.ok(!url.includes('0'.repeat(8)), 'no token-shaped secret in the URL');
});

// 2. Opening an invitation URL routes directly into joining.
test('invite search string resolves straight to a join code', () => {
  assert.equal(inviteCodeFromSearch('?room=abcdef'), 'ABCDEF');
  assert.equal(inviteCodeFromSearch('?room=ABCDEF&x=1'), 'ABCDEF');
  assert.equal(inviteCodeFromSearch('?room=nope'), null);
  assert.equal(inviteCodeFromSearch(''), null);
  // Legacy SDP invite blobs are not valid room invites.
  assert.equal(inviteCodeFromSearch('?invite=QUJDRA'), null);
});

// 3. Invite link and typed code converge on one join implementation.
test('link taps and typed codes normalize to the same room identity', () => {
  const fromLink = parseInviteUrl('https://play.example.com/?room=abcdef');
  const typed = normalizeRoomCode(' abcdef ');
  assert.equal(fromLink, 'ABCDEF');
  assert.equal(typed, 'ABCDEF');
  assert.equal(fromLink, typed);
  assert.equal(normalizeRoomCode('ABC01I'), null, 'lookalikes rejected on both paths');
});

// 4. No reply-code step exists in the normal player UI.
test('normal UI has no SDP / reply-code / server-URL ceremony', () => {
  for (const banned of [
    'CREATE INVITE LINK', 'SEND THE REPLY BACK', 'PASTE THE REPLY', 'PASTE THE INVITE',
    'invite-answer', 'invite-open', 'invitehost', 'invitejoin', 'netcreate', 'netjoin',
    '?invite=${', 'VIA ${', 'VIA server', 'CHANGE IN LEAGUE',
  ]) {
    assert.ok(!mainSrc.includes(banned), `normal UI must not contain ${JSON.stringify(banned)}`);
  }
  assert.ok(mainSrc.includes('PLAY WITH A FRIEND'), 'new online menu entry');
  assert.ok(mainSrc.includes('JOIN WITH CODE'), 'manual fallback entry');
  assert.ok(mainSrc.includes('COPY LINK'), 'copy affordance is implemented');
  assert.ok(mainSrc.includes('navigator.share') || mainSrc.includes('canShare'), 'share affordance');
});

// 5. Host creates the Cloudflare room before producing an invitation.
test('host POSTs /api/rooms before opening the room socket', async () => {
  const order: string[] = [];
  const sockets: string[] = [];
  const sock = new FakeSock();
  const fetchFn = (async (url: string) => {
    order.push(url);
    if (url.endsWith('/api/health')) return okHealth();
    assert.match(url, /\/api\/rooms$/);
    return { ok: true, status: 201, json: async () => ({ roomCode: 'ABCDEF', matchToken: '0'.repeat(64) }) };
  }) as (url: string, init?: RequestInit) => Promise<Response>;
  const sig = new CloudflareSignalingClient(((u: string) => {
    sockets.push(u);
    return sock as unknown as WebSocket;
  }) as (u: string) => WebSocket, fetchFn);
  await sig.connect('https://play.example.com');
  const creating = sig.createRoom('aaaaaaaa');
  await tick();
  sock.open();
  await tick();
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: [], matchToken: '0'.repeat(64) });
  const created = await creating;
  // The invite URL is derived from the created room — never before it.
  const invite = buildInviteUrl('https://play.example.com', '/', created.roomCode);
  assert.equal(invite, 'https://play.example.com/?room=ABCDEF');
  assert.deepEqual(order, ['https://play.example.com/api/health', 'https://play.example.com/api/rooms']);
  assert.match(sockets[0] ?? '', /\/api\/rooms\/ABCDEF\/socket/);
  sig.close();
});

// 6. Guest joining triggers automatic signaling (offer routes to a callback,
// no manual step) — including trickle ICE candidates.
test('guest join auto-delivers offers and ICE candidates', async () => {
  const sock = new FakeSock();
  const sig = new CloudflareSignalingClient(
    (() => sock as unknown as WebSocket) as (u: string) => WebSocket,
    (() => okHealth()) as (url: string, init?: RequestInit) => Promise<Response>,
  );
  await sig.connect('https://play.example.com');
  const joining = sig.joinRoom('ABCDEF', 'bbbbbbbb');
  sock.open();
  await tick();
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: ['aaaaaaaa'], matchToken: '0'.repeat(64) });
  await joining;
  const seen: unknown[] = [];
  sig.onPeerSignal = (from, payload) => seen.push([from, payload]);
  sock.serverSend({ t: 'signaled', from: 'aaaaaaaa', payload: { type: 'offer', sdp: 'v=0' } });
  sock.serverSend({
    t: 'signaled', from: 'aaaaaaaa',
    payload: { type: 'candidate', candidate: 'candidate:1 1 udp 1 1.2.3.4 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 },
  });
  assert.equal(seen.length, 2, 'offer + candidate both auto-delivered');
  sig.close();
});

// 6b. Fast room-joined (sent before waitForJoin registers) still resolves.
test('early room-joined is buffered, never lost to a race', async () => {
  const sock = new FakeSock();
  const sig = new CloudflareSignalingClient(
    (() => sock as unknown as WebSocket) as (u: string) => WebSocket,
    (() => okHealth()) as (url: string, init?: RequestInit) => Promise<Response>,
  );
  await sig.connect('https://play.example.com');
  const joining = sig.joinRoom('ABCDEF', 'bbbbbbbb');
  sock.open();
  // Server answers instantly — before the join waiter registered.
  sock.serverSend({ t: 'room-joined', roomCode: 'ABCDEF', peers: [], matchToken: '0'.repeat(64) });
  const joined = await joining;
  assert.equal(joined.roomCode, 'ABCDEF');
  sig.close();
});

// Signaling schema relays ICE candidates (worker + client agree).
test('control plane accepts SDP and trickle ICE, rejects garbage', () => {
  const offer = { type: 'offer', sdp: 'v=0' };
  const ice = { type: 'candidate', candidate: 'candidate:1 1 udp 1 1.2.3.4 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  assert.ok(isValidSignalPayload(offer));
  assert.ok(isValidSignalPayload(ice));
  assert.ok(isValidClientPayload(offer));
  assert.ok(isValidClientPayload(ice));
  assert.ok(!isValidSignalPayload({ type: 'candidate', candidate: '' }));
  assert.ok(!isValidSignalPayload({ type: 'offer', sdp: '' }));
  assert.ok(!isValidSignalPayload({ type: 'candidate' }));
  const parsed = parseInbound({ t: 'signal', to: 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb', payload: ice });
  assert.equal(parsed.kind, 'signal');
  assert.deepEqual(
    parseInbound({ t: 'signal', to: 'nope', payload: offer }),
    { kind: 'invalid', error: 'invalid message' },
  );
});

// 7. A third player is rejected: rooms hold exactly two peers.
test('third peer cannot enter a full room', () => {
  assert.equal(MAX_MEMBERS, 2);
  const a = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
  const b = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
  const c = 'cccccccc-0000-4000-8000-cccccccccccc';
  const full = addMember([a, b], c);
  assert.deepEqual(full, { ok: false, reason: 'full' });
});

// 8. A relayed offer/answer pair reaches the NetDriver handshake (lockstep).
test('matched room tokens drive two NetDrivers to READY', () => {
  const [ta, tb] = LoopbackTransport.pair();
  const token = 'a'.repeat(32);
  const host = new NetDriver(ta, { host: true, matchToken: token });
  const guest = new NetDriver(tb, { host: false, matchToken: token });
  ta.open(); tb.open();
  assert.ok(host.events.some((e) => e.type === 'connected'), 'host handshake done');
  assert.ok(guest.events.some((e) => e.type === 'connected'), 'guest handshake done');
  host.setReady(); guest.setReady();
  assert.ok(host.events.some((e) => e.type === 'started'), 'host reaches READY');
  assert.ok(guest.events.some((e) => e.type === 'started'), 'guest reaches READY');
  host.close(); guest.close();
});

// Error states stay player-friendly: no raw control-plane text leaks.
test('lobby errors are player-friendly', () => {
  assert.equal(friendlyNetError(new SignalError('room not found or expired')), 'INVITE EXPIRED — ASK FOR A NEW LINK');
  assert.equal(friendlyNetError(new SignalError('room is full')), 'ROOM IS FULL');
  assert.equal(friendlyNetError(new SignalError('SERVER UNREACHABLE')), 'CONNECTION FAILED — CHECK INTERNET');
  assert.equal(friendlyNetError(new SignalError('BAD SERVER REPLY')), 'INVITE EXPIRED — ASK FOR A NEW LINK');
  assert.equal(friendlyNetError(new Error('rtc failed')), 'CONNECTION FAILED — TRY AGAIN');
});

// STUN-only direct-path failure says what helps (another network / TURN),
// instead of a dishonest "try again". With a relay configured, pass through.
test('no-path failure hints at TURN only when relay is off', () => {
  assert.equal(
    withRelayHint('CONNECTION LOST', 'off'),
    'NO DIRECT PATH — TRY ANOTHER NETWORK OR ADD TURN (?turn=…)',
  );
  assert.equal(
    withRelayHint('PEER HANDSHAKE TIMEOUT', 'off'),
    'NO DIRECT PATH — TRY ANOTHER NETWORK OR ADD TURN (?turn=…)',
  );
  assert.equal(withRelayHint('CONNECTION LOST', 'endpoint'), 'CONNECTION LOST');
  assert.equal(withRelayHint('ROOM IS FULL', 'off'), 'ROOM IS FULL');
});

// ---- scripted fake (the tests play the Durable Object) ----

class FakeSock {
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
}

const okHealth = () =>
  Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) }) as Promise<Response>;
const tick = () => new Promise<void>((r) => setImmediate(r));
