import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  attachNegotiationTransport,
  createNegotiationState,
  createSessionPeerId,
  detectControlPlane,
  effectiveOnlineDuration,
  flushNegotiationCandidates,
  ingestRemoteCandidate,
  isE2EMode,
  resetNegotiationState,
} from '../src/net/online-session.ts';
import type { SignalPayload } from '../src/net/transport.ts';
import { formatRoomCode, friendlyNetError, normalizeRoomCode } from '../src/net/invite.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, '..', 'src', 'main.ts'), 'utf8');
const swSrc = readFileSync(join(here, '..', 'public', 'sw.js'), 'utf8');

// Fake trickle sink: records every candidate delivered to the transport.
class FakeSink {
  received: SignalPayload[] = [];
  async addIceCandidate(p: SignalPayload): Promise<void> {
    this.received.push(p);
  }
}

const ice = (n: number): SignalPayload =>
  ({ type: 'candidate', candidate: `candidate:${n} 1 udp 1 1.2.3.4 500${n} typ host`, sdpMid: '0', sdpMLineIndex: 0 }) as SignalPayload;

// --- Unified UX: one host action, no SDP ceremony ---------------------------

test('normal UI has ONE host action and no SDP/reply ceremony', () => {
  for (const banned of [
    'CREATE INVITE LINK',
    'CREATE ROOM',
    'SEND THE REPLY BACK',
    'PASTE THE REPLY',
    'PASTE THE INVITE',
    'invite-answer',
    'invite-open',
    'PASTE THE REPLY CODE',
  ]) {
    assert.ok(!mainSrc.includes(banned), `normal UI must not contain ${JSON.stringify(banned)}`);
  }
  assert.ok(mainSrc.includes('PLAY WITH A FRIEND'), 'host action exists');
  assert.ok(mainSrc.includes('JOIN WITH CODE'), 'code-only join exists');
  // Single join implementation: the typed code converges on cloudJoin.
  const joins = mainSrc.match(/cloudJoin\(/g) ?? [];
  assert.ok(joins.length >= 2, `expected single join path (found ${joins.length} cloudJoin refs)`);
  assert.ok(mainSrc.includes('doJoin'), 'typed-code join present');
  assert.ok(!mainSrc.includes('pendingInvite'), 'no link auto-join state');
  assert.ok(!mainSrc.includes('?room='), 'no link-join query handling');
});

test('main uses per-session peer ids, never persistent id for signaling', () => {
  assert.ok(mainSrc.includes('createSessionPeerId'), 'per-session id factory used');
  assert.ok(mainSrc.includes('myPeerId = createSessionPeerId'), 'fresh id per attempt');
  // Signaling create/join must use the session id, leagues keep getClientId.
  assert.ok(mainSrc.includes('signal.createRoom(myPeerId)'), 'host creates room with session id');
  assert.ok(mainSrc.includes('signal.joinRoom(normalized, myPeerId)'), 'guest joins with session id');
  assert.ok(!mainSrc.includes('signal.createRoom(getClientId'), 'host must not use persistent id');
  assert.ok(!mainSrc.includes('signal.joinRoom(normalized, getClientId'), 'guest must not use persistent id');
});

test('main keeps the negotiation transport after the answer (no null-on-answer)', () => {
  // Regression guard for the old `netOffer = null` bug that dropped late ICE.
  assert.ok(!mainSrc.includes('netOffer = null'), 'must not null the transport on answer');
  assert.ok(!mainSrc.includes('if (!alive() || from !== peerId || !netOffer)'), 'host must not gate ICE on transport null');
  assert.ok(!mainSrc.includes('|| net || answered'), 'guest must not gate ICE on answered/net');
  assert.ok(mainSrc.includes('ingestRemoteCandidate(neg'), 'candidates route through the negotiation state');
  assert.ok(mainSrc.includes('attachNegotiationTransport(neg'), 'transport attach flushes queued candidates');
});

test('production signaling is explicit (no silent Cloudflare->legacy swap)', () => {
  assert.ok(mainSrc.includes('detectControlPlane'), 'control plane is probed explicitly');
  assert.ok(!mainSrc.includes('not a Cloudflare control plane — try the Node reference'), 'silent fallback comment gone');
});

test('lobby drives the NetDriver handshake (no stuck-at-CONNECTED)', () => {
  // Regression: net.poll() used to run only on screen==='match', so a lost
  // hello or a never-opening DataChannel left host/guest on CONNECTED forever
  // with no READY and no error. The lobby must pump the handshake so retries
  // fire and the 20s timeout surfaces CONNECTION FAILED instead of hanging.
  assert.ok(
    mainSrc.includes("screen==='host'||screen==='join'||screen==='netready'"),
    'frame pumps net.poll() in lobby screens',
  );
  // SDP done must not masquerade as driver-ready; READY appears only on the
  // driver's 'connected' event → netready screen.
  assert.ok(!mainSrc.includes("netStatus = 'CONNECTED'"), 'no premature CONNECTED status');
});

// --- Room code: readable, code-only --------------------------------------------

test('host screen shows the grouped code for read-out', () => {
  assert.equal(formatRoomCode('ABCDEF'), 'ABC DEF');
  assert.ok(mainSrc.includes('formatRoomCode(roomCode)'), 'host renders the grouped code');
  assert.ok(mainSrc.includes('READ THE CODE'), 'read-out-first copy');
});

test('typed codes normalize tolerantly (case/space/dash)', () => {
  assert.equal(normalizeRoomCode(' abcdef '), 'ABCDEF');
  assert.equal(normalizeRoomCode('ABC-DEF'), 'ABCDEF');
  assert.equal(normalizeRoomCode('ABCDEF'), 'ABCDEF');
  assert.equal(normalizeRoomCode('nope'), null);
  assert.equal(normalizeRoomCode('abc01i'), null);
});

// --- Trickle ICE lifecycle ---------------------------------------------------

test('host ordering: offer, ICE, ICE, answer, ICE, ICE all reach the transport', async () => {
  const neg = createNegotiationState();
  const sink = new FakeSink();
  // Host attaches its offer transport first (created on peer-joined).
  attachNegotiationTransport(neg, sink);
  await ingestRemoteCandidate(neg, ice(1));
  await ingestRemoteCandidate(neg, ice(2));
  // Answer SDP arrives (handled by main, transport NOT nulled).
  neg.answerHandled = true;
  // Late candidates after the answer must still be delivered.
  await ingestRemoteCandidate(neg, ice(3));
  await ingestRemoteCandidate(neg, ice(4));
  assert.deepEqual(sink.received.map((c) => (c as { candidate: string }).candidate), [
    (ice(1) as { candidate: string }).candidate,
    (ice(2) as { candidate: string }).candidate,
    (ice(3) as { candidate: string }).candidate,
    (ice(4) as { candidate: string }).candidate,
  ]);
  assert.equal(neg.pendingCandidates.length, 0, 'nothing left queued');
});

test('guest ordering: ICE before offer is queued, flushed, then live', async () => {
  const neg = createNegotiationState();
  // Reordered relay: candidates arrive before the offer/transport exists.
  assert.equal(await ingestRemoteCandidate(neg, ice(1)), 'queued');
  assert.equal(await ingestRemoteCandidate(neg, ice(2)), 'queued');
  assert.equal(neg.pendingCandidates.length, 2);
  // Offer handled -> transport created -> flush in order.
  neg.offerHandled = true;
  const sink = new FakeSink();
  const queued = attachNegotiationTransport(neg, sink);
  assert.equal(queued.length, 2);
  for (const c of queued) await sink.addIceCandidate(c);
  // Candidates after the offer go straight to the live transport.
  await ingestRemoteCandidate(neg, ice(3));
  neg.answerHandled = true; // answer sent; negotiation continues
  await ingestRemoteCandidate(neg, ice(4));
  assert.equal(sink.received.length, 4);
});

test('candidates arriving during async SDP work are never dropped', async () => {
  const neg = createNegotiationState();
  neg.offerHandled = true; // offer seen, transport not yet ready (async)
  await ingestRemoteCandidate(neg, ice(9));
  assert.equal(neg.pendingCandidates.length, 1);
  const sink = new FakeSink();
  const queued = attachNegotiationTransport(neg, sink);
  for (const c of queued) await sink.addIceCandidate(c);
  assert.equal(sink.received.length, 1);
  await ingestRemoteCandidate(neg, ice(10));
  assert.equal(sink.received.length, 2);
  const flushed = await flushNegotiationCandidates(neg);
  assert.equal(flushed, 0, 'flush with live transport delivers nothing extra');
});

test('reset clears negotiation ownership deterministically', () => {
  const neg = createNegotiationState();
  neg.remotePeerId = 'x';
  neg.offerHandled = true;
  neg.pendingCandidates.push(ice(1));
  resetNegotiationState(neg);
  assert.equal(neg.transport, null);
  assert.equal(neg.remotePeerId, null);
  assert.equal(neg.offerHandled, false);
  assert.equal(neg.pendingCandidates.length, 0);
});

// --- Identity ----------------------------------------------------------------

test('two online sessions get distinct peer ids even with one persistent id', () => {
  const a = createSessionPeerId();
  const b = createSessionPeerId();
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.match(b, /^[0-9a-f]{8}$/);
  assert.notEqual(a, b, 'per-session ids must differ');
  const seen = new Set(Array.from({ length: 50 }, () => createSessionPeerId()));
  assert.ok(seen.size >= 49, 'ids must be effectively unique');
});

// --- Explicit control-plane selection ----------------------------------------

test('detectControlPlane selects Cloudflare only on explicit CF health', async () => {
  const cfFetch = (async () => ({ ok: true, json: async () => ({ status: 'ok', service: 'floodlight' }) })) as unknown as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  assert.equal(await detectControlPlane('https://game.example.com', cfFetch), 'cloudflare');

  const legacyFetch = (async () => ({ ok: false, status: 404, json: async () => ({ error: 'not found' }) })) as unknown as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  assert.equal(await detectControlPlane('http://127.0.0.1:8080', legacyFetch), 'legacy');

  const wrongBody = (async () => ({ ok: true, json: async () => ({ status: 'ok' }) })) as unknown as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  assert.equal(await detectControlPlane('https://other.example', wrongBody), 'legacy');

  const down = (async () => {
    throw new Error('down');
  }) as (url: string, init?: RequestInit) => Promise<Response>;
  await assert.rejects(detectControlPlane('https://game.example.com', down), /SERVER UNREACHABLE/);
});

// --- Test-only duration cannot leak into production --------------------------

test('short E2E match is test-only (?e2e)', () => {
  assert.equal(isE2EMode('?e2e=1'), true);
  assert.equal(isE2EMode('?room=ABCDEF'), false);
  assert.equal(isE2EMode(''), false);
  assert.equal(effectiveOnlineDuration(90, '?e2e=1'), 30);
  assert.equal(effectiveOnlineDuration(90, ''), 90);
  assert.equal(effectiveOnlineDuration(180, '?foo=ABCDEF'), 180);
});

// --- Error UX -----------------------------------------------------------------

test('lobby errors stay player-friendly, never leak SDP/ICE/DO internals', () => {
  assert.equal(friendlyNetError(new Error('room is full')), 'ROOM IS FULL');
  assert.equal(friendlyNetError(new Error('room not found or expired')), 'INVITE EXPIRED — ASK FOR A NEW LINK');
  assert.equal(friendlyNetError(new Error('SERVER UNREACHABLE')), 'CONNECTION FAILED — CHECK INTERNET');
  assert.equal(friendlyNetError(new Error('rtc offer failed')), 'CONNECTION FAILED — TRY AGAIN');
  assert.equal(friendlyNetError(new Error('ice gathering failed')), 'CONNECTION FAILED — TRY AGAIN');
  assert.equal(friendlyNetError(new Error('FRIEND LEFT')), 'FRIEND LEFT');
  for (const msg of ['ROOM IS FULL', 'INVITE EXPIRED — ASK FOR A NEW LINK', 'CONNECTION FAILED — TRY AGAIN']) {
    assert.ok(!/sdp|ice|websocket|durable|stack/i.test(msg), `${msg} leaks internals`);
  }
});

// --- Service worker cannot strand players on old multiplayer UI ---------------

test('service worker is network-first for navigation, never caches /api', () => {
  assert.ok(swSrc.includes('floodlight-v'), 'versioned cache namespace');
  assert.ok(!swSrc.includes('floodlight-v1'), 'old cache version evicted (bumped past v1)');
  assert.ok(swSrc.includes('skipWaiting'), 'new deploys activate immediately');
  assert.ok(swSrc.includes('clients.claim'), 'new worker takes control');
  assert.ok(swSrc.includes("request.mode === 'navigate'"), 'navigation handled separately');
  assert.ok(swSrc.includes('/api/'), 'control plane bypassed');
});

// --- Test instrumentation exists but hides secrets ----------------------------

test('test instrumentation exposes state without secrets', () => {
  assert.ok(mainSrc.includes('__floodlightTest'), 'diagnostics hook exists');
  for (const getter of ['getScreen', 'getRoomCode', 'getOnlinePeerId', 'getNetState', 'getSimulationState']) {
    assert.ok(mainSrc.includes(getter), `hook exposes ${getter}`);
  }
  // The hook object itself must never return the private token (a nearby code
  // comment mentioning matchToken is documentation, not exposure).
  const hookStart = mainSrc.indexOf('__floodlightTest');
  const hookEnd = mainSrc.indexOf('});', hookStart);
  const hookBlock = mainSrc.slice(hookStart, hookEnd);
  assert.ok(!hookBlock.includes('matchToken'), 'matchToken never exposed via test hook');
  assert.ok(!hookBlock.includes('sdp') && !hookBlock.includes('candidate'), 'SDP/ICE never exposed via test hook');
  assert.ok(mainSrc.includes('import.meta.env.DEV || e2eMode'), 'hook is dev/test-only');
});
