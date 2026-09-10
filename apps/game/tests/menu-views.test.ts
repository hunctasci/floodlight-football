import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCityStandings } from '../src/city-league/standings';
import { filterStandings, leaderboardView, lobbyView, onboardingView, standingsRows } from '../src/ui/menu-views';
import type { CityLeagueResponse } from '../src/city-league/api';

const table: CityLeagueResponse = {
  season: { key: '2026-W37', startsAt: 0, endsAt: Date.now() + 86_400_000 },
  standings: computeCityStandings([
    { seasonKey: '2026-W37', status: 'confirmed', homeCityCode: 'TR', awayCityCode: 'BR', homeScore: 2, awayScore: 0 },
  ], '2026-W37'),
};
const profile = { clientId: '01234567', displayName: 'Player', cityCode: 'BR', citySeasonKey: '2026-W37' };

test('country search is case/diacritic insensitive and retains official ranks', () => {
  const before = structuredClone(table.standings);
  const brazil = table.standings.find(row => row.cityCode === 'BR')!;
  assert.deepEqual(filterStandings(table.standings, '  brAzIl '), [brazil]);
  assert.equal(filterStandings(table.standings, 'TR')[0].cityCode, 'TR');
  assert.equal(filterStandings(table.standings, 'turkiye')[0].cityCode, 'TR');
  assert.equal(filterStandings(table.standings, 'no-such-country').length, 0);
  assert.equal(filterStandings(table.standings, '').length, 249);
  assert.deepEqual(table.standings, before);
  const html = standingsRows([brazil], 'BR');
  assert.ok(html.includes(`class="rank-cell">${brazil.rank}</td>`));
  assert.ok(html.includes('class="is-yours"'));
});

test('guest input, search text and returned country names cannot inject menu HTML', () => {
  const payload = '\"><img src=x onerror=alert(1)>';
  const setup = onboardingView(payload, 'TR', '<script>bad()</script>', false);
  const unsafeTable = { ...table, standings: table.standings.map(row => ({ ...row, cityName: payload })) };
  const board = leaderboardView({ table: unsafeTable, profile, busy: false, error: '' }, payload);
  const lobby = lobbyView({ table: unsafeTable, profile: { ...profile, displayName: payload }, busy: false, error: '' }, 0, payload, false);
  for (const html of [setup, board, lobby]) {
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;img'));
  }
});

test('empty, loading and failed standings remain distinct from real leaders', () => {
  const state = { table: null, profile, busy: true, error: '' };
  assert.ok(lobbyView(state, 0, '', false).includes('Loading the world table'));
  const empty = { ...table, standings: computeCityStandings([], '2026-W37') };
  const html = leaderboardView({ ...state, table: empty, busy: false }, '');
  assert.ok(html.includes('EVERY COUNTRY STARTS AT ZERO'));
  assert.ok(!html.includes('leaders-podium'));
  const loaded = leaderboardView({ ...state, table, busy: false }, '');
  assert.ok(loaded.includes('leaders-podium'));
  const failed = leaderboardView({ ...state, table, busy: false, error: 'offline' }, '');
  assert.ok(failed.includes('Showing the last available standings'));
  assert.ok(failed.includes('TRY AGAIN'));
  assert.ok(failed.includes('standings-table'));
});

test('new player friend invites are explained without adding a second setup step', () => {
  const view = onboardingView('Rival', 'TR', '', true);
  assert.ok(view.includes('FRIEND INVITE RECEIVED'));
  assert.ok(view.includes('JOIN FRIEND’S MATCH'));
  assert.ok(view.includes('id="onboard-form"'));
  assert.ok(view.includes('PLAY FOR YOUR COUNTRY'));
  assert.ok(view.includes('CHALLENGE A FRIEND · 1V1'));
});
