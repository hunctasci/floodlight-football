import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getProfile,
  hasProfile,
  isCityLocked,
  saveProfile,
  sanitizeDisplayName,
} from '../src/city-league/profile.ts';
import { getCurrentSeasonEnd, getCurrentSeasonKey, getCurrentSeasonStart } from '../src/city-league/season.ts';

function mockStorage() {
  const mem = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const real = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
  };
  return () => {
    if (real === undefined) delete g.localStorage;
    else g.localStorage = real;
  };
}

test('nickname sanitized: 3-16 chars, trimmed', () => {
  assert.equal(sanitizeDisplayName('  Hunç  '), 'Hunç');
  assert.equal(sanitizeDisplayName('ab'), null);
  assert.equal(sanitizeDisplayName('a'.repeat(17)), null);
  assert.equal(sanitizeDisplayName('Mehmet'), 'Mehmet');
  assert.equal(sanitizeDisplayName('<script>'), 'script');
  assert.equal(sanitizeDisplayName('  a  b  c  '), 'a b c');
});

test('new player sees setup (no profile), returning bypasses onboarding', () => {
  const restore = mockStorage();
  try {
    assert.equal(getProfile(), null);
    assert.equal(hasProfile(), false);
    const p = saveProfile({ displayName: 'Hunç', cityCode: 'IST', seasonKey: '2026-W38', existing: null });
    assert.equal(p.displayName, 'Hunç');
    assert.equal(p.cityCode, 'IST');
    assert.ok(hasProfile());
    assert.deepEqual(getProfile(), p);
  } finally {
    restore();
  }
});

test('invalid city rejected', () => {
  const restore = mockStorage();
  try {
    assert.throws(() => saveProfile({ displayName: 'Mehmet', cityCode: 'XXX', seasonKey: '2026-W38', existing: null }), /CITY/);
    assert.throws(() => saveProfile({ displayName: 'Mehmet', cityCode: 'Real Madrid', seasonKey: '2026-W38', existing: null }), /CITY/);
  } finally {
    restore();
  }
});

test('city can be chosen first time, locked during season, changeable next season', () => {
  const restore = mockStorage();
  try {
    const season = '2026-W38';
    const p1 = saveProfile({ displayName: 'Hunc', cityCode: 'IST', seasonKey: season, existing: null });
    assert.equal(isCityLocked(p1, season), true);
    // Same-season change rejected.
    assert.throws(
      () => saveProfile({ displayName: 'Hunc', cityCode: 'RIZ', seasonKey: season, existing: p1 }),
      /LOCKED/,
    );
    // Next season free.
    const nextStart = getCurrentSeasonStart(Date.UTC(2026, 8, 14, 12)) + 7 * 86400_000;
    const nextKey = getCurrentSeasonKey(nextStart + 1000);
    assert.notEqual(nextKey, season);
    const p2 = saveProfile({ displayName: 'Hunc', cityCode: 'RIZ', seasonKey: nextKey, existing: p1 });
    assert.equal(p2.cityCode, 'RIZ');
    assert.equal(p2.clientId, p1.clientId, 'same device keeps its id');
    void getCurrentSeasonEnd;
  } finally {
    restore();
  }
});
