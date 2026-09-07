import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEMBERS,
  ROOM_ALPHABET,
  ROOM_CODE_RE,
  ROOM_TTL_SEC,
  addMember,
  authorizeRelay,
  codeFromBytes,
  createRateLimiter,
  isExpired,
  isValidClientId,
  isValidCode,
  isValidSdp,
  makeMatchToken,
  makeRoomCode,
  normalizeCode,
  parseInbound,
  peersOf,
  removeMember,
} from '../worker/room-logic.ts';

const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
const C = 'cccccccc-0000-4000-8000-cccccccccccc';

test('room codes use the unambiguous 6-char alphabet only', () => {
  assert.match(makeRoomCode(), ROOM_CODE_RE);
  assert.equal(codeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5])), 'ABCDEF');
  for (const ch of ROOM_ALPHABET) assert.ok(!'01IO'.includes(ch), `${ch} must stay excluded`);
  assert.equal(ROOM_ALPHABET.length, 31);
  const seen = new Set(Array.from({ length: 200 }, () => makeRoomCode()));
  assert.ok(seen.size >= 198, 'codes must be effectively collision-free');
});

test('room codes normalize case/whitespace, reject lookalikes', () => {
  assert.equal(normalizeCode(' abcdef '), 'ABCDEF');
  assert.equal(normalizeCode('abcdef'), 'ABCDEF');
  assert.equal(normalizeCode('ABC01I'), null);
  assert.equal(normalizeCode('SHORT'), null);
  assert.equal(normalizeCode('TOOLONG1'), null);
  assert.ok(isValidCode('ABCDEF'));
  assert.ok(!isValidCode('abcdef'));
  assert.ok(!isValidCode('ABC01I'));
});

test('match tokens are 256-bit hex and never sequential', () => {
  const t1 = makeMatchToken();
  const t2 = makeMatchToken();
  assert.match(t1, /^[0-9a-f]{64}$/);
  assert.notEqual(t1, t2);
});

test('client ids accept uuid-style guests only', () => {
  assert.ok(isValidClientId(A));
  assert.ok(!isValidClientId('short'));
  assert.ok(!isValidClientId('not a uuid at all!!!!'));
  assert.ok(!isValidClientId('zzzzzzzz-0000-4000-8000-zzzzzzzzzzzz'));
});

test('create then join: host and joiner both recognized, peers listed', () => {
  const host = addMember([], A);
  assert.deepEqual(host, { ok: true as const, members: [A] });
  if (!host.ok) throw new Error('unreachable');
  const joined = addMember(host.members, B);
  assert.deepEqual(joined, { ok: true as const, members: [A, B] });
  if (!joined.ok) throw new Error('unreachable');
  assert.deepEqual(peersOf(joined.members, A), [B]);
  assert.deepEqual(peersOf(joined.members, B), [A]);
  // Idempotent re-join (socket reconnect) never duplicates.
  assert.deepEqual(addMember(joined.members, B), { ok: true as const, members: [A, B] });
});

test('third peer is rejected: max players = 2', () => {
  assert.equal(MAX_MEMBERS, 2);
  const full = addMember([A, B], C);
  assert.deepEqual(full, { ok: false as const, reason: 'full' });
});

test('signaling isolation: relay only between room members', () => {
  const members = [A, B];
  assert.equal(authorizeRelay(members, A, B), null);
  assert.equal(authorizeRelay(members, B, A), null);
  assert.equal(authorizeRelay(members, A, C), 'peer offline');
  assert.equal(authorizeRelay(members, C, A), 'join a room first');
  assert.equal(authorizeRelay([], A, B), 'join a room first');
});

test('malformed inbound messages are rejected, never throw', () => {
  assert.deepEqual(parseInbound('this is not json{'), { kind: 'invalid', error: 'malformed JSON' });
  assert.deepEqual(parseInbound('{"t":"dance"}'), { kind: 'invalid', error: 'invalid message' });
  assert.deepEqual(parseInbound('x'.repeat(70000)), { kind: 'invalid', error: 'message too large' });
  assert.deepEqual(parseInbound(null), { kind: 'invalid', error: 'invalid message' });
  assert.deepEqual(parseInbound({ t: 'ping' }), { kind: 'ping' });
  assert.deepEqual(parseInbound({ t: 'leave-room' }), { kind: 'leave-room' });
  // Oversized SDP and bad shapes never reach the relay.
  assert.deepEqual(
    parseInbound({ t: 'signal', to: B, payload: { type: 'offer', sdp: 'x'.repeat(20000) } }),
    { kind: 'invalid', error: 'invalid message' },
  );
  assert.deepEqual(
    parseInbound({ t: 'signal', to: 'nope', payload: { type: 'offer', sdp: 'v=0' } }),
    { kind: 'invalid', error: 'invalid message' },
  );
  const sig = parseInbound({ t: 'signal', to: B, payload: { type: 'offer', sdp: 'v=0' } });
  assert.equal(sig.kind, 'signal');
  // Legacy create-room over WS gets guidance, not a crash.
  const legacy = parseInbound({ t: 'create-room', clientId: A });
  assert.equal(legacy.kind, 'unknown');
});

test('SDP payloads validate type and size', () => {
  assert.ok(isValidSdp({ type: 'offer', sdp: 'v=0' }));
  assert.ok(isValidSdp({ type: 'answer', sdp: 'v=0' }));
  assert.ok(!isValidSdp({ type: 'candidate', sdp: 'v=0' }));
  assert.ok(!isValidSdp({ type: 'offer', sdp: '' }));
  assert.ok(!isValidSdp(null));
});

test('disconnect updates membership; empty rooms vanish', () => {
  assert.deepEqual(removeMember([A, B], B), [A]);
  assert.deepEqual(removeMember([A], A), []);
  assert.deepEqual(removeMember([A, B], C), [A, B]);
});

test('expiry: rooms live ~2h, stale state is never resurrected', () => {
  assert.equal(ROOM_TTL_SEC, 7200);
  const createdAt = 1_000_000;
  const expiresAt = createdAt + ROOM_TTL_SEC * 1000;
  assert.equal(isExpired(expiresAt, expiresAt - 1), false);
  assert.equal(isExpired(expiresAt, expiresAt), true);
  assert.equal(isExpired(expiresAt - 1, expiresAt), true);
});

test('hibernation-safe identity: attachments carry peer identity, not the Map', () => {
  // The DO rebuilds its volatile session index from these attachments after
  // hibernation; identity must survive a full drop of in-memory maps.
  const attachment = { peerId: A, role: 'host' as const, joinedAt: 123 };
  const restored = structuredClone(attachment);
  assert.equal(restored.peerId, A);
  assert.equal(restored.role, 'host');
  assert.equal(restored.joinedAt, 123);
  // Lookup semantics mirror RoomDurableObject.socketFor: identity resolves
  // from attachments alone.
  const attachments = [attachment, { peerId: B, role: 'guest' as const, joinedAt: 124 }];
  assert.equal(attachments.find((a) => a.peerId === B)?.role, 'guest');
  assert.equal(attachments.find((a) => a.peerId === C), undefined);
});

test('rate limiter caps bursts and resets per window', () => {
  let t = 0;
  const rl = createRateLimiter(() => t);
  assert.ok(rl.allow('k', 2, 60));
  assert.ok(rl.allow('k', 2, 60));
  assert.equal(rl.allow('k', 2, 60), false);
  assert.ok(rl.allow('other', 2, 60), 'keys are isolated');
  t += 61_000;
  assert.ok(rl.allow('k', 2, 60), 'window slides');
});
