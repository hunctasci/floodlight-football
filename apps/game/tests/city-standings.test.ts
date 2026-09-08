import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCityStandings } from '../src/city-league/standings.ts';

const S = '2026-W38';

test('win=3 draw=1 loss=0 with goal difference', () => {
  const table = computeCityStandings(
    [
      { seasonKey: S, status: 'confirmed', homeCityCode: 'TR', awayCityCode: 'DE', homeScore: 3, awayScore: 1 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'US', awayCityCode: 'BR', homeScore: 1, awayScore: 1 },
    ],
    S,
  );
  const ist = table.find((r) => r.cityCode === 'TR')!;
  const ank = table.find((r) => r.cityCode === 'DE')!;
  const riz = table.find((r) => r.cityCode === 'US')!;
  assert.equal(ist.points, 3);
  assert.equal(ank.points, 0);
  assert.equal(riz.points, 1);
  assert.equal(ist.goalDifference, 2);
  assert.equal(ist.played, 1);
  assert.equal(riz.winRate, 0);
});

test('tie-breakers: points → GD → GF → wins', () => {
  const table = computeCityStandings(
    [
      { seasonKey: S, status: 'confirmed', homeCityCode: 'TR', awayCityCode: 'FR', homeScore: 2, awayScore: 0 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'DE', awayCityCode: 'FR', homeScore: 3, awayScore: 0 },
    ],
    S,
  );
  // Both 3 pts; ANK +3 GD beats IST +2.
  assert.equal(table[0].cityCode, 'DE');
  assert.equal(table[1].cityCode, 'TR');
});

test('all 249 countries and territories present even with zero matches', () => {
  const table = computeCityStandings([], S);
  assert.equal(table.length, 249);
  for (const r of table) {
    assert.equal(r.played, 0);
    assert.equal(r.points, 0);
  }
});

test('same-city, pending, disputed and old-season games excluded', () => {
  const table = computeCityStandings(
    [
      { seasonKey: S, status: 'confirmed', homeCityCode: 'TR', awayCityCode: 'TR', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'pending', homeCityCode: 'TR', awayCityCode: 'DE', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'disputed', homeCityCode: 'TR', awayCityCode: 'DE', homeScore: 5, awayScore: 0 },
      { seasonKey: '2026-W37', status: 'confirmed', homeCityCode: 'TR', awayCityCode: 'DE', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'US', awayCityCode: 'DE', homeScore: 2, awayScore: 0 },
    ],
    S,
  );
  const ist = table.find((r) => r.cityCode === 'TR')!;
  const riz = table.find((r) => r.cityCode === 'US')!;
  assert.equal(ist.played, 0, 'friendly/pending/disputed/old-season never count');
  assert.equal(riz.points, 3);
});
