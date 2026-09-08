import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCityStandings } from '../src/city-league/standings.ts';

const S = '2026-W38';

test('win=3 draw=1 loss=0 with goal difference', () => {
  const table = computeCityStandings(
    [
      { seasonKey: S, status: 'confirmed', homeCityCode: 'IST', awayCityCode: 'ANK', homeScore: 3, awayScore: 1 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'RIZ', awayCityCode: 'IZM', homeScore: 1, awayScore: 1 },
    ],
    S,
  );
  const ist = table.find((r) => r.cityCode === 'IST')!;
  const ank = table.find((r) => r.cityCode === 'ANK')!;
  const riz = table.find((r) => r.cityCode === 'RIZ')!;
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
      { seasonKey: S, status: 'confirmed', homeCityCode: 'IST', awayCityCode: 'BUR', homeScore: 2, awayScore: 0 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'ANK', awayCityCode: 'BUR', homeScore: 3, awayScore: 0 },
    ],
    S,
  );
  // Both 3 pts; ANK +3 GD beats IST +2.
  assert.equal(table[0].cityCode, 'ANK');
  assert.equal(table[1].cityCode, 'IST');
});

test('all 8 cities present even with zero matches', () => {
  const table = computeCityStandings([], S);
  assert.equal(table.length, 8);
  for (const r of table) {
    assert.equal(r.played, 0);
    assert.equal(r.points, 0);
  }
});

test('same-city, pending, disputed and old-season games excluded', () => {
  const table = computeCityStandings(
    [
      { seasonKey: S, status: 'confirmed', homeCityCode: 'IST', awayCityCode: 'IST', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'pending', homeCityCode: 'IST', awayCityCode: 'ANK', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'disputed', homeCityCode: 'IST', awayCityCode: 'ANK', homeScore: 5, awayScore: 0 },
      { seasonKey: '2026-W37', status: 'confirmed', homeCityCode: 'IST', awayCityCode: 'ANK', homeScore: 5, awayScore: 0 },
      { seasonKey: S, status: 'confirmed', homeCityCode: 'RIZ', awayCityCode: 'ANK', homeScore: 2, awayScore: 0 },
    ],
    S,
  );
  const ist = table.find((r) => r.cityCode === 'IST')!;
  const riz = table.find((r) => r.cityCode === 'RIZ')!;
  assert.equal(ist.played, 0, 'friendly/pending/disputed/old-season never count');
  assert.equal(riz.points, 3);
});
