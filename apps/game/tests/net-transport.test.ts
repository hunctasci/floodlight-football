import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopbackTransport, RTCTransport, type TransportState } from '../src/net/transport.ts';
import { answerHello, decideSeed, decodeCode, encodeCode, localVersions, makeClientId, makeSeedPart, NET_PROTO, type HelloMsg } from '../src/net/signal.ts';
import { decodePacket, encodeHashPacket, encodeInputPacket, encodeSnapshotPacket } from '../src/net/proto.ts';
import { encodeInput } from '../src/net/codec.ts';
import { EMPTY_INPUT } from '../src/types.ts';

test('loopback pair echoes both ways in order, gated on open', () => {
  const [a, b] = LoopbackTransport.pair();
  const states: TransportState[] = [];
  a.onstate = (s) => states.push(s);
  const gotA: number[][] = [], gotB: number[][] = [];
  a.onmessage = (d) => gotA.push([...d]);
  b.onmessage = (d) => gotB.push([...d]);
  a.send(new Uint8Array([1])); // dropped: not open
  assert.equal(gotB.length, 0);
  a.open(); b.open();
  assert.deepEqual(states, ['open']);
  a.send(new Uint8Array([1, 2])); a.send(new Uint8Array([3]));
  b.send(new Uint8Array([9]));
  assert.deepEqual(gotB, [[1, 2], [3]]);
  assert.deepEqual(gotA, [[9]]);
  // Payloads are copied, not shared.
  const buf = new Uint8Array([7]);
  a.send(buf); buf[0] = 0;
  assert.deepEqual(gotB[2], [7]);
  a.close();
  b.send(new Uint8Array([5]));
  assert.equal(gotA.length, 1, 'closed peer receives nothing');
});

test('room codes round-trip arbitrary JSON and reject garbage', () => {
  const obj = { sdp: { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1' }, n: 42 };
  const code = encodeCode(obj);
  assert.ok(!/[+/=]/.test(code), 'url-safe, unpadded');
  assert.deepEqual(decodeCode(code), obj);
  assert.throws(() => decodeCode('!!!not-a-code!!!'));
  assert.throws(() => decodeCode(''));
});

test('seed negotiation is deterministic, shared and nonzero', () => {
  assert.equal(decideSeed(0, 0), 1);
  assert.equal(decideSeed(12345, 67890), decideSeed(67890, 12345), 'order-independent');
  const hello: HelloMsg = { t: 'hello', proto: NET_PROTO, seedPart: 777, clientId: 'abcdef01', ...localVersions() };
  const w = answerHello(1234, hello);
  assert.equal(w.t, 'welcome'); assert.equal(w.proto, NET_PROTO);
  assert.equal(w.yourTeam, 1); assert.equal(w.seed, decideSeed(1234, 777));
  assert.throws(() => answerHello(1, { ...hello, proto: 999 }));
  const id = makeClientId();
  assert.ok(/^[0-9a-f]{8}$/.test(id));
  const part = makeSeedPart();
  assert.ok(Number.isInteger(part) && part >= 0 && part <= 0xffffffff);
});

test('match packets round-trip; malformed input is unknown, never throws', () => {
  const bytes = encodeInput({ ...EMPTY_INPUT, x: 1, pass: true });
  const p0 = decodePacket(encodeInputPacket(77, bytes));
  assert.equal(p0.kind, 'input');
  if (p0.kind === 'input') { assert.equal(p0.tick, 77); assert.deepEqual([...p0.bytes], [...bytes]); }
  const p1 = decodePacket(encodeHashPacket(300, 0xdeadbeef));
  assert.deepEqual(p1, { kind: 'hash', tick: 300, hash: 0xdeadbeef });
  const p2 = decodePacket(encodeSnapshotPacket(12, '{"score":[1,0]}'));
  assert.deepEqual(p2, { kind: 'snapshot', tick: 12, json: '{"score":[1,0]}' });
  for (const bad of [new Uint8Array([]), new Uint8Array([0, 1]), new Uint8Array([9, 9, 9]),
    new Uint8Array([2, 0, 0, 0, 12, 1, 2]), encodeHashPacket(1, 2).subarray(0, 5)]) {
    assert.equal(decodePacket(bad).kind, 'unknown');
  }
});

test('RTC transport refuses to build without browser WebRTC', async () => {
  assert.equal(typeof RTCPeerConnection, 'undefined', 'node has no WebRTC');
  await assert.rejects(RTCTransport.createOffer());
});
