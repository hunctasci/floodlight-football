import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentSeasonEnd,
  getCurrentSeasonKey,
  getCurrentSeasonStart,
  getSeasonInfo,
} from '../src/city-league/season.ts';

const MON_2026_09_14_IST = Date.UTC(2026, 8, 13, 21, 0, 0); // Mon 00:00 Istanbul = Sun 21:00Z

test('current season starts Monday 00:00 Istanbul', () => {
  // Monday 2026-09-14 00:00 Istanbul sharp.
  assert.equal(getCurrentSeasonStart(MON_2026_09_14_IST), MON_2026_09_14_IST);
  assert.equal(getCurrentSeasonEnd(MON_2026_09_14_IST), MON_2026_09_14_IST + 7 * 86400_000);
  // Mid-week stays in the same season.
  const wed = MON_2026_09_14_IST + 2 * 86400_000 + 12 * 3600_000;
  assert.equal(getCurrentSeasonStart(wed), MON_2026_09_14_IST);
  assert.equal(getCurrentSeasonKey(wed), getCurrentSeasonKey(MON_2026_09_14_IST));
});

test('season rollover on next Monday', () => {
  const before = MON_2026_09_14_IST + 7 * 86400_000 - 1;
  const after = MON_2026_09_14_IST + 7 * 86400_000;
  assert.equal(getCurrentSeasonStart(before), MON_2026_09_14_IST);
  assert.equal(getCurrentSeasonStart(after), after);
  assert.notEqual(getCurrentSeasonKey(before), getCurrentSeasonKey(after));
  assert.match(getCurrentSeasonKey(after), /^\d{4}-W\d{2}$/);
});

test('Sunday night Istanbul still belongs to the old week', () => {
  // Sunday 23:59 Istanbul = Sunday 20:59Z.
  const sunLate = Date.UTC(2026, 8, 20, 20, 59, 0);
  assert.equal(getCurrentSeasonStart(sunLate), MON_2026_09_14_IST);
});

test('season info bundles key + bounds', () => {
  const info = getSeasonInfo(MON_2026_09_14_IST);
  assert.equal(info.startsAt, MON_2026_09_14_IST);
  assert.equal(info.endsAt, MON_2026_09_14_IST + 7 * 86400_000);
  assert.match(info.key, /^\d{4}-W\d{2}$/);
});
