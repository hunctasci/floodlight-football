import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  candidateFamily, netlog, redactCandidate, shortPeer,
} from '../src/net/netlog.ts';
import {
  buildIceServers, fetchEndpointTurnServers, persistTurnConfig, readTurnConfig,
  resolveExtraServers, summarizeStats,
} from '../src/net/transport.ts';

const memStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
  };
};

const here = dirname(fileURLToPath(import.meta.url));
const mainSrc = readFileSync(join(here, '..', 'src', 'main.ts'), 'utf8');
const transportSrc = readFileSync(join(here, '..', 'src', 'net', 'transport.ts'), 'utf8');

// Candidate family classification (mDNS-masked hosts stay "host").
test('candidate families classify without storing addresses', () => {
  assert.equal(candidateFamily('candidate:1 1 udp 2113937151 192.168.1.2 5000 typ host'), 'host');
  assert.equal(candidateFamily('candidate:1 1 udp 2113937151 abc123.local 5000 typ host'), 'host');
  assert.equal(candidateFamily('candidate:2 1 udp 1685987071 203.0.113.1 5000 typ srflx'), 'srflx');
  assert.equal(candidateFamily('candidate:3 1 udp 1685987071 10.0.0.1 5000 typ relay'), 'relay');
  assert.equal(candidateFamily('candidate:4 1 udp 1 1.2.3.4 5000 typ prflx'), 'prflx');
  assert.equal(candidateFamily('garbage'), 'unknown');
});

// Redaction: family + m-line only, never IPs, ports, tokens, SDP.
test('redacted candidates never leak addresses or secrets', () => {
  const out = redactCandidate({
    candidate: 'candidate:1 1 udp 2113937151 192.168.7.77 53421 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
  });
  assert.ok(out.includes('typ=host'), 'family kept for diagnosis');
  assert.ok(!out.includes('192.168.7.77'), 'no IP');
  assert.ok(!out.includes('53421'), 'no port');
  const mdns = redactCandidate({
    candidate: 'candidate:1 1 udp 2113937151 f00b4r.local 5000 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
  });
  assert.ok(mdns.includes('mdns'), 'mDNS masking flagged');
  assert.ok(mdns.includes('typ=host'), 'mDNS hosts still host family');
  // Even hostile inputs stay redacted.
  const evil = redactCandidate({ candidate: 'tok=aabbccddeeff v=0\r\no=- 1', sdpMid: '0', sdpMLineIndex: 0 });
  assert.ok(!evil.includes('aabbccddeeff'), 'no token-shaped secret');
  assert.ok(!evil.includes('v=0'), 'no SDP body');
});

// Log dump: ordered, capped, secret-free by construction.
test('net log dump is ordered and bounded', () => {
  netlog.clear();
  netlog.log('info', 'first');
  netlog.log('ice', 'second typ=host');
  const dump = netlog.dump();
  assert.ok(dump.indexOf('first') < dump.indexOf('second'), 'chronological');
  assert.ok(!dump.includes('matchToken'), 'no token field');
  netlog.clear();
  assert.equal(netlog.dump(), '');
});

// Peer tags stay short (ephemeral ids only).
test('short peer tags truncate', () => {
  assert.equal(shortPeer('abcdef12'), 'abcdef12');
  assert.equal(shortPeer('abcdef123456'), 'abcdef12');
});

// Wiring guards: transport robustness + main diagnostics.
test('transport uses redundant STUN, bundle+MUX and state watchers', () => {
  assert.ok(transportSrc.includes('stun1.l.google.com'), 'STUN fallback');
  assert.ok(transportSrc.includes("bundlePolicy: 'max-bundle'"), 'max-bundle for interop');
  assert.ok(transportSrc.includes('oniceconnectionstatechange'), 'ICE state watcher');
  assert.ok(transportSrc.includes('onsignalingstatechange'), 'signaling state watcher');
  assert.ok(transportSrc.includes('onPcState'), 'diagnostic state hook');
  assert.ok(transportSrc.includes('onIceDebug'), 'redacted ICE hook');
});

// Optional TURN relay: parsed from ?turn* or sticky storage, creds never logged.
test('TURN config parses, validates and prefers explicit params', () => {
  assert.equal(readTurnConfig('', memStore()), null, 'absent → no relay');
  assert.deepEqual(
    readTurnConfig('?turn=turn:127.0.0.1:3478&turnuser=u&turnpass=p', memStore()),
    { urls: 'turn:127.0.0.1:3478', username: 'u', credential: 'p' },
  );
  assert.deepEqual(
    readTurnConfig('?turn=turns:relay.example.com:5349&turnuser=u&turnpass=p', memStore())?.urls,
    'turns:relay.example.com:5349',
  );
  assert.equal(readTurnConfig('?turn=turn:127.0.0.1:3478', memStore()), null, 'username+password required');
  assert.equal(
    readTurnConfig('?turn=https://evil.example/x&turnuser=u&turnpass=p', memStore()),
    null,
    'only turn:/turns: schemes accepted',
  );
  const store = memStore();
  store.setItem('floodlight-turn-url', 'turn:10.0.0.9:3478');
  store.setItem('floodlight-turn-user', 'stored');
  store.setItem('floodlight-turn-pass', 's3cret');
  assert.equal(readTurnConfig('', store)?.username, 'stored', 'storage fallback works');
  assert.equal(
    readTurnConfig('?turn=turn:127.0.0.1:3478&turnuser=param&turnpass=pw', store)?.username,
    'param',
    'explicit params win over storage',
  );
});

test('TURN persist stores params per-browser, credentials stay out of logs', () => {
  const store = memStore();
  assert.equal(persistTurnConfig('', store), false, 'nothing to persist');
  assert.equal(
    persistTurnConfig('?turn=turn:127.0.0.1:3478&turnuser=u&turnpass=p', store),
    true,
  );
  assert.equal(store.getItem('floodlight-turn-url'), 'turn:127.0.0.1:3478');
  netlog.clear();
  netlog.log('info', `turn=${readTurnConfig('', store) ? 'on' : 'off'}`);
  const dump = netlog.dump();
  assert.ok(dump.includes('turn=on'), 'relay presence is diagnosable');
  assert.ok(!dump.includes('floodlight-turn-pass'), 'no credential keys in logs');
  netlog.clear();
});

test('ICE servers always include STUN, TURN only when configured', () => {
  const plain = buildIceServers('stun:stun.l.google.com:19302', null);
  assert.ok(plain.some((s) => String(s.urls).includes('stun.l.google.com')), 'STUN present');
  assert.ok(!plain.some((s) => String(s.urls).startsWith('turn')), 'no relay by default');
  const relayed = buildIceServers('stun:stun.l.google.com:19302', {
    urls: 'turn:127.0.0.1:3478', username: 'u', credential: 'p',
  });
  const turn = relayed.find((s) => String(s.urls).startsWith('turn'));
  assert.ok(turn, 'relay appended when configured');
  assert.equal((turn as { username: string }).username, 'u');
});

test('endpoint TURN fetch is fail-open and validates shapes', async () => {
  const ok = (async () => ({
    ok: true,
    json: async () => ({ iceServers: [{ urls: 'turn:10.0.0.1:3478', username: 'u', credential: 'p' }] }),
  })) as unknown as (url: string, init?: RequestInit) => Promise<Response>;
  assert.equal((await fetchEndpointTurnServers('https://g.example', ok)).length, 1);

  const evil = (async () => ({
    ok: true,
    json: async () => ({ iceServers: [{ urls: 'https://evil.example/x', username: 'u', credential: 'p' }] }),
  })) as unknown as (url: string, init?: RequestInit) => Promise<Response>;
  assert.deepEqual(await fetchEndpointTurnServers('https://g.example', evil), [], 'non-turn URLs dropped');

  const down = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  assert.deepEqual(await fetchEndpointTurnServers('https://g.example', down), [], 'HTTP errors → STUN-only');

  const dead = (async () => { throw new Error('down'); }) as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  assert.deepEqual(await fetchEndpointTurnServers('https://g.example', dead, 10), [], 'network errors → STUN-only');
});

test('session relay resolution merges endpoint servers, fail-open', async () => {
  const withRelay = (async () => ({
    ok: true,
    json: async () => ({ iceServers: [{ urls: 'turn:10.0.0.9:3478', username: 'u', credential: 'p' }] }),
  })) as unknown as (url: string, init?: RequestInit) => Promise<Response>;
  const got = await resolveExtraServers('https://g.example', withRelay);
  assert.equal(got.source, 'endpoint');
  assert.equal(got.servers.length, 1);

  const bare = (async () => ({ ok: true, json: async () => ({ iceServers: [] }) })) as unknown as (
    url: string,
    init?: RequestInit,
  ) => Promise<Response>;
  const off = await resolveExtraServers('https://g.example', bare);
  assert.deepEqual(off, { servers: [], source: 'off' });
});

test('stats summaries name the pair without addresses', async () => {
  const empty = await summarizeStats({ getStats: async () => [] });
  assert.equal(empty, 'pairs=0 (no checks started)');

  const report = [
    { type: 'local-candidate', id: 'l1', candidateType: 'host' },
    { type: 'remote-candidate', id: 'r1', candidateType: 'srflx' },
    {
      type: 'candidate-pair', id: 'p1', localCandidateId: 'l1', remoteCandidateId: 'r1',
      protocol: 'udp', state: 'in-progress', nominated: true,
      currentRoundTripTime: 0.012, bytesSent: 10, bytesReceived: 0,
    },
  ];
  const sum = await summarizeStats({ getStats: async () => report });
  assert.ok(sum.includes('pair=host-srflx/udp'), `names families: ${sum}`);
  assert.ok(sum.includes('state=in-progress'), 'pair state present');
  assert.ok(sum.includes('12ms'), 'RTT rendered');
  assert.ok(!sum.includes('192.168'), 'no addresses leak');
});

test('main exposes copyable redacted diagnostics, never secrets', () => {
  assert.ok(mainSrc.includes('COPY DEBUG LOG'), 'player-facing log action');
  assert.ok(mainSrc.includes('doCopyLog'), 'copy handler');
  assert.ok(mainSrc.includes('getNetLog'), 'test hook for the log');
  const hookStart = mainSrc.indexOf('__floodlightTest');
  const hookEnd = mainSrc.indexOf('});', hookStart);
  const hookBlock = mainSrc.slice(hookStart, hookEnd);
  assert.ok(!hookBlock.includes('matchToken'), 'token never via test hook');
  assert.ok(!hookBlock.includes('turnpass'), 'relay credentials never via test hook');
  assert.ok(mainSrc.includes('relay source='), 'relay source logged per session');
  assert.ok(mainSrc.includes('persistTurnConfig(location.search)'), 'relay params persist before invites clear the query');
  assert.ok(mainSrc.includes('resolveExtraServers(location.origin)'), 'relay resolved alongside signaling');
  assert.ok(mainSrc.includes('summarizeStats('), 'nominated-pair snapshots wired');
  assert.ok(mainSrc.includes('startStatsWatch('), 'periodic stats watch during negotiation');
});
