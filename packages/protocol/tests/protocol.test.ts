import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientMsgSchema, CreateLeagueSchema, JoinLeagueSchema, RoomCodeSchema, SubmitResultSchema, parseClientMsg, ServerMsgSchema } from '../src/index.ts';

test('room codes accept the unambiguous alphabet only', () => {
  assert.ok(RoomCodeSchema.safeParse('ABCDEFGH'.slice(0, 6)).success);
  assert.ok(!RoomCodeSchema.safeParse('ABC01I').success, '0/1/I rejected');
  assert.ok(!RoomCodeSchema.safeParse('abc123').success, 'lowercase rejected');
  assert.ok(!RoomCodeSchema.safeParse('ABCDE').success, 'length enforced');
});

test('client messages validate by shape', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  assert.ok(ClientMsgSchema.safeParse({ t: 'create-room', clientId: id }).success);
  assert.ok(ClientMsgSchema.safeParse({ t: 'join-room', code: 'ABCDEF', clientId: id }).success);
  assert.ok(!ClientMsgSchema.safeParse({ t: 'join-room', code: 'ABCDEF' }).success, 'clientId required');
  assert.ok(!ClientMsgSchema.safeParse({ t: 'dance' }).success, 'unknown type rejected');
  assert.ok(!ClientMsgSchema.safeParse({
    t: 'signal', to: id, payload: { type: 'offer', sdp: 'x'.repeat(20000) },
  }).success, 'SDP size capped');
});

test('parseClientMsg never throws and reports errors', () => {
  assert.deepEqual(parseClientMsg('nope{'), { ok: false, error: 'malformed JSON' });
  assert.deepEqual(parseClientMsg({ t: 'ping' }), { ok: true, msg: { t: 'ping' } });
  const bad = parseClientMsg([1, 2, 3]);
  assert.equal(bad.ok, false);
});

test('server messages cover the room lifecycle', () => {
  for (const m of [
    { t: 'room-created', roomCode: 'ABCDEF', matchToken: '0'.repeat(32) },
    { t: 'room-joined', roomCode: 'ABCDEF', peers: [] },
    { t: 'peer-joined', clientId: 'a'.repeat(8) },
    { t: 'peer-left', clientId: 'a'.repeat(8) },
    { t: 'pong' },
    { t: 'error', message: 'nope' },
  ]) assert.ok(ServerMsgSchema.safeParse(m).success, JSON.stringify(m));
});

test('league DTOs validate names, scores and codes', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  assert.ok(CreateLeagueSchema.safeParse({ name: '  Saturday  ', clientId: id, displayName: 'Hün' }).success);
  assert.ok(!CreateLeagueSchema.safeParse({ name: '   ', clientId: id, displayName: 'Hün' }).success, 'blank name rejected');
  assert.ok(!CreateLeagueSchema.safeParse({ name: 'x'.repeat(49), clientId: id, displayName: 'Hün' }).success, 'name capped');
  assert.ok(SubmitResultSchema.safeParse({ clientId: id, homeScore: 2, awayScore: 1, matchToken: '0'.repeat(32) }).success);
  assert.ok(!SubmitResultSchema.safeParse({ clientId: id, homeScore: 100, awayScore: 0, matchToken: '0'.repeat(32) }).success, 'score capped');
  assert.ok(!SubmitResultSchema.safeParse({ clientId: id, homeScore: 1, awayScore: 1, matchToken: 'short' }).success, 'token floored');
  assert.ok(!JoinLeagueSchema.safeParse({ code: 'abcdef', clientId: id, displayName: 'Hün' }).success, 'code uppercase');
});
