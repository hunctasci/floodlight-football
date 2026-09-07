import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  candidateFamily, netlog, redactCandidate, shortPeer,
} from '../src/net/netlog.ts';

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

test('main exposes copyable redacted diagnostics, never secrets', () => {
  assert.ok(mainSrc.includes('COPY DEBUG LOG'), 'player-facing log action');
  assert.ok(mainSrc.includes('doCopyLog'), 'copy handler');
  assert.ok(mainSrc.includes('getNetLog'), 'test hook for the log');
  const hookStart = mainSrc.indexOf('__floodlightTest');
  const hookEnd = mainSrc.indexOf('});', hookStart);
  const hookBlock = mainSrc.slice(hookStart, hookEnd);
  assert.ok(!hookBlock.includes('matchToken'), 'token never via test hook');
});
