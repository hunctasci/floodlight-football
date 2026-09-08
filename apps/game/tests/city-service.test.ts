import test from 'node:test';
import assert from 'node:assert/strict';
import { CityLeagueService } from '../worker/city-league/service.ts';
import { MemoryCityLeagueStore } from '../worker/city-league/store.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

function svc(now = Date.UTC(2026, 8, 16, 12)) {
  return new CityLeagueService(new MemoryCityLeagueStore(), { now: () => now });
}

async function makeMatch(s: CityLeagueService, home = A, away = B, hc = 'TR', ac = 'US') {
  await s.upsertProfile({ clientId: home, displayName: 'Home', cityCode: hc });
  await s.upsertProfile({ clientId: away, displayName: 'Away', cityCode: ac });
  return s.createMatch({ roomCode: 'ABCDEF', homeClientId: home, awayClientId: away, homeCityCode: hc, awayCityCode: ac });
}

test('new player created; invalid city rejected', async () => {
  const s = svc();
  const p = await s.upsertProfile({ clientId: A, displayName: 'Hunc', cityCode: 'TR' });
  assert.equal(p.cityCode, 'TR');
  await assert.rejects(s.upsertProfile({ clientId: B, displayName: 'X', cityCode: 'TR' }), /invalid name/);
  await assert.rejects(s.upsertProfile({ clientId: B, displayName: 'Mehmet', cityCode: 'NOPE' }), /invalid city/);
});

test('city locked for the active season, free next season', async () => {
  const t0 = Date.UTC(2026, 8, 16, 12);
  const s = new CityLeagueService(new MemoryCityLeagueStore(), { now: () => t0 });
  await s.upsertProfile({ clientId: A, displayName: 'Hunc', cityCode: 'TR' });
  await assert.rejects(s.upsertProfile({ clientId: A, displayName: 'Hunc', cityCode: 'US' }), /locked/);
  const s2 = new CityLeagueService(
    // Share the same store across the season boundary.
    (s as unknown as { store: MemoryCityLeagueStore }).store,
    { now: () => t0 + 8 * 86400_000 },
  );
  const p2 = await s2.upsertProfile({ clientId: A, displayName: 'Hunc', cityCode: 'US' });
  assert.equal(p2.cityCode, 'US');
});

test('first submission leaves match pending', async () => {
  const s = svc();
  const m = await makeMatch(s);
  const r = await s.submitResult(m.matchId, { clientId: A, matchToken: m.matchToken, homeScore: 2, awayScore: 1 });
  assert.equal(r.status, 'pending');
});

test('identical dual submissions confirm the match', async () => {
  const s = svc();
  const m = await makeMatch(s);
  await s.submitResult(m.matchId, { clientId: A, matchToken: m.matchToken, homeScore: 2, awayScore: 3 });
  const r = await s.submitResult(m.matchId, { clientId: B, matchToken: m.matchToken, homeScore: 2, awayScore: 3 });
  assert.equal(r.status, 'confirmed');
  assert.equal(r.homeScore, 2);
  const table = await s.getTable();
  const riz = table.standings.find((x) => x.cityCode === 'US')!;
  assert.equal(riz.points, 3);
});

test('conflicting dual submissions mark disputed (no points)', async () => {
  const s = svc();
  const m = await makeMatch(s);
  await s.submitResult(m.matchId, { clientId: A, matchToken: m.matchToken, homeScore: 3, awayScore: 1 });
  const r = await s.submitResult(m.matchId, { clientId: B, matchToken: m.matchToken, homeScore: 2, awayScore: 1 });
  assert.equal(r.status, 'disputed');
  const table = await s.getTable();
  assert.equal(table.standings.find((x) => x.cityCode === 'TR')!.points, 0);
});

test('invalid participant and invalid token rejected', async () => {
  const s = svc();
  const m = await makeMatch(s);
  await assert.rejects(
    s.submitResult(m.matchId, { clientId: C, matchToken: m.matchToken, homeScore: 1, awayScore: 0 }),
    /only the two sides/,
  );
  await assert.rejects(
    s.submitResult(m.matchId, { clientId: A, matchToken: '0'.repeat(64), homeScore: 1, awayScore: 0 }),
    /invalid token/,
  );
});

test('same player cannot represent both submissions', async () => {
  const s = svc();
  await assert.rejects(
    s.createMatch({ roomCode: 'ABCDEF', homeClientId: A, awayClientId: A, homeCityCode: 'TR', awayCityCode: 'US' }),
    /both sides/,
  );
});

test('rematch creates a new match identity (never overwrites)', async () => {
  const s = svc();
  const m1 = await makeMatch(s);
  const m2 = await makeMatch(s);
  assert.notEqual(m1.matchId, m2.matchId);
  assert.notEqual(m1.matchToken, m2.matchToken);
});
