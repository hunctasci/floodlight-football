import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  isValidTurnUrl, mintCoturnCredentials, normalizeTurnUrl, parseTurnUrls, resolveTurnServers,
} from '../worker/turn.ts';

test('TURN URLs accept only turn:/turns: with a port', () => {
  assert.ok(isValidTurnUrl('turn:127.0.0.1:3478'));
  assert.ok(isValidTurnUrl('turns:relay.example.com:5349'));
  assert.ok(!isValidTurnUrl('https://evil.example/x'));
  assert.ok(!isValidTurnUrl('turn:127.0.0.1'));
  assert.ok(!isValidTurnUrl('stun:stun.l.google.com:19302'));
  assert.ok(!isValidTurnUrl(42));
  assert.equal(normalizeTurnUrl('  turn:127.0.0.1:3478  '), 'turn:127.0.0.1:3478');
  assert.equal(normalizeTurnUrl('http://x'), null);
});

test('TURN_URLS parses comma lists, dedupes, drops garbage', () => {
  assert.deepEqual(
    parseTurnUrls('turn:10.0.0.1:3478, turns:relay.example.com:5349,http://x,turn:10.0.0.1:3478'),
    ['turn:10.0.0.1:3478', 'turns:relay.example.com:5349'],
  );
  assert.deepEqual(parseTurnUrls(''), []);
  assert.deepEqual(parseTurnUrls(undefined), []);
});

test('coturn REST credentials match the RFC-style HMAC vector', async () => {
  const secret = 'test-secret';
  const nowMs = 1_700_000_000_000;
  const got = await mintCoturnCredentials(secret, 3600, nowMs);
  const expiry = Math.floor(nowMs / 1000) + 3600;
  assert.equal(got.username, `${expiry}:floodlight`);
  const expected = createHmac('sha1', secret).update(got.username).digest('base64');
  assert.equal(got.password, expected);
  assert.equal(got.expiresAt, expiry);
  // TTL clamps to [60, 86400].
  const short = await mintCoturnCredentials(secret, 5, nowMs);
  assert.equal(short.expiresAt, Math.floor(nowMs / 1000) + 60);
});

test('env resolution prefers static creds, then REST, then off', async () => {
  const off = await resolveTurnServers({});
  assert.deepEqual(off, { servers: [], source: 'off' });

  const noUrls = await resolveTurnServers({ TURN_SHARED_SECRET: 's' });
  assert.equal(noUrls.source, 'off');

  const stat = await resolveTurnServers({
    TURN_URLS: 'turn:10.0.0.1:3478',
    TURN_USERNAME: 'u',
    TURN_PASSWORD: 'p',
    TURN_SHARED_SECRET: 's',
  });
  assert.equal(stat.source, 'static');
  assert.equal(stat.servers.length, 1);

  const rest = await resolveTurnServers({
    TURN_URLS: 'turn:10.0.0.1:3478',
    TURN_SHARED_SECRET: 's',
  });
  assert.equal(rest.source, 'rest');
  const srv = rest.servers[0] as { username: string; credential: string };
  assert.match(srv.username, /^\d+:floodlight$/);
  assert.ok(srv.credential.length >= 20, 'HMAC-derived password present');
});
