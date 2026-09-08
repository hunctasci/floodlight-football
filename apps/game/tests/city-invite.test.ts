import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChallengeMessage,
  buildInviteUrl,
  clearPendingInvite,
  getInviteCodeFromLocation,
  getPendingInvite,
  normalizeInviteCode,
  savePendingInvite,
} from '../src/city-league/invite.ts';
import { getProfile, hasProfile, saveProfile } from '../src/city-league/profile.ts';

function mockStorage() {
  const mem = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const realLocal = g.localStorage;
  const realSession = g.sessionStorage;
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
  g.localStorage = store;
  g.sessionStorage = store;
  return () => {
    if (realLocal === undefined) delete g.localStorage; else g.localStorage = realLocal;
    if (realSession === undefined) delete g.sessionStorage; else g.sessionStorage = realSession;
  };
}

test('invite codes normalize strictly', () => {
  assert.equal(normalizeInviteCode(' abc-def '), 'ABCDEF');
  assert.equal(normalizeInviteCode('abc123'), null);
  assert.equal(normalizeInviteCode('short'), null);
});

test('invite URL parsing covers /friend/ + query aliases', () => {
  assert.equal(getInviteCodeFromLocation('?join=abcdef', '/', ''), 'ABCDEF');
  assert.equal(getInviteCodeFromLocation('', '/friend/abcdef', ''), 'ABCDEF');
  assert.equal(getInviteCodeFromLocation('?room=ABCDEF', '/', ''), 'ABCDEF');
  assert.equal(getInviteCodeFromLocation('', '/', '#join=ABCDEF'), 'ABCDEF');
  assert.equal(getInviteCodeFromLocation('', '/', ''), null);
});

test('canonical invite URL shape', () => {
  assert.equal(buildInviteUrl('https://play.example.com/', 'abcdef'), 'https://play.example.com/friend/ABCDEF');
});

test('whatsapp challenge copy stays simple', () => {
  const msg = buildChallengeMessage('İstanbul', 'https://x/friend/ABCDEF');
  assert.match(msg, /meydan okuyorum/);
  assert.match(msg, /İstanbul/);
  assert.match(msg, /https:\/\/x\/friend\/ABCDEF/);
});

test('invitation survives first-time setup (pending → profile → join)', () => {
  const restore = mockStorage();
  try {
    // Fresh guest opens /friend/ABCDEF with no profile.
    assert.equal(hasProfile(), false);
    const code = getInviteCodeFromLocation('', '/friend/ABCDEF', '');
    assert.equal(code, 'ABCDEF');
    savePendingInvite(code!);
    assert.equal(getPendingInvite(), 'ABCDEF');

    // Onboarding completes; the pending invite is still there for auto-join.
    const profile = saveProfile({ displayName: 'Mehmet', cityCode: 'RIZ', seasonKey: '2026-W38', existing: null });
    assert.equal(getProfile()?.clientId, profile.clientId);
    assert.equal(getPendingInvite(), 'ABCDEF');

    // After continuing into the room the pending flag clears.
    clearPendingInvite();
    assert.equal(getPendingInvite(), null);
  } finally {
    restore();
  }
});

test('returning player bypasses onboarding', () => {
  const restore = mockStorage();
  try {
    saveProfile({ displayName: 'Hunc', cityCode: 'IST', seasonKey: '2026-W38', existing: null });
    assert.equal(hasProfile(), true);
  } finally {
    restore();
  }
});
