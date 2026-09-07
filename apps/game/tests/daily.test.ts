import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyKey, dailySeed, setDailyBest, getDailyBest } from '../src/league.ts';

test('daily seed is deterministic per calendar day and never zero', () => {
  const d = new Date(2026, 8, 7);
  assert.equal(dailySeed(d), dailySeed(new Date(2026, 8, 7)), 'same day, same seed');
  assert.notEqual(dailySeed(d), dailySeed(new Date(2026, 8, 8)), 'next day, new match');
  assert.ok(dailySeed(d) > 0, 'seed never zero (LCG guard)');
});

test('daily key names one score slot per day', () => {
  assert.equal(dailyKey(new Date(2026, 8, 7)), 'floodlight-daily-20260907');
  assert.notEqual(dailyKey(new Date(2026, 8, 7)), dailyKey(new Date(2026, 8, 8)));
});

test('daily best only moves upward', () => {
  const g = globalThis as Record<string, unknown>;
  const real = g.localStorage;
  const mem = new Map<string, string>();
  g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  try {
    const d = new Date(2026, 8, 7);
    setDailyBest(2, d); setDailyBest(5, d); setDailyBest(3, d);
    assert.equal(getDailyBest(d), 5, 'a worse score never lowers the best');
  } finally {
    if (real === undefined) delete g.localStorage; else g.localStorage = real;
  }
});
