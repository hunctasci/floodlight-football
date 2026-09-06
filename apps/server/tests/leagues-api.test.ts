import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { MemoryStore } from '../src/store.ts';
import { MemoryLeagueStore } from '../src/leagues.ts';
import { createApp } from '../src/server.ts';
import { loadConfig } from '../src/config.ts';
import { createLogger } from '../src/log.ts';

const log = createLogger('fatal');
const TOKEN = '0'.repeat(32);

const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';

async function boot() {
  const config = loadConfig({ ...process.env, PORT: '0' });
  const app = createApp(new MemoryStore(), config, log, () => false, new MemoryLeagueStore());
  await new Promise<void>((res) => app.http.listen(0, res));
  const port = (app.http.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const post = async (path: string, body: unknown) => {
    const r = await fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json() as Record<string, unknown> };
  };
  const get = async (path: string) => {
    const r = await fetch(base + path);
    return { status: r.status, json: await r.json() as Record<string, unknown> };
  };
  return { app, post, get };
}

test('league lifecycle over REST: create, join, start, submit, standings', async (t) => {
  const { app, post, get } = await boot();
  t.after(() => app.close());

  const bad = await post('/api/leagues', { name: '   ', clientId: A, displayName: 'Ann' });
  assert.equal(bad.status, 400);

  const created = await post('/api/leagues', { name: 'Saturday', clientId: A, displayName: 'Ann' });
  assert.equal(created.status, 201);
  const code = created.json.code as string;
  const id = created.json.id as string;
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);

  const missing = await post('/api/leagues/join', { code: 'ZZZZZZ', clientId: B, displayName: 'Bob' });
  assert.equal(missing.status, 404);

  const joined = await post('/api/leagues/join', { code, clientId: B, displayName: 'Bob' });
  assert.equal(joined.status, 200);

  const solo = await post('/api/leagues', { name: 'Solo', clientId: A, displayName: 'Ann' });
  const soloStart = await post(`/api/leagues/${solo.json.id}/start`, { clientId: A });
  assert.equal(soloStart.status, 409, 'one player cannot start');

  const notCreator = await post(`/api/leagues/${id}/start`, { clientId: B });
  assert.equal(notCreator.status, 403);

  const started = await post(`/api/leagues/${id}/start`, { clientId: A });
  assert.equal(started.status, 200);
  const fixtures = started.json.fixtures as Array<{ id: string; homeClientId: string; awayClientId: string }>;
  assert.equal(fixtures.length, 1, '2 players → 1 fixture');

  const fx = fixtures[0].id;
  const home = fixtures[0].homeClientId, away = fixtures[0].awayClientId;
  const first = await post(`/api/fixtures/${fx}/submit`, { clientId: home, homeScore: 2, awayScore: 1, matchToken: TOKEN });
  assert.equal((first.json.fixture as { status: string }).status, 'pending');
  const second = await post(`/api/fixtures/${fx}/submit`, { clientId: away, homeScore: 2, awayScore: 1, matchToken: TOKEN });
  assert.equal((second.json.fixture as { status: string }).status, 'confirmed');

  const league = await get(`/api/leagues/${code}`);
  assert.equal(league.status, 200);
  const dto = league.json as {
    members: Array<{ displayName: string }>; standings: Array<{ displayName: string; points: number; played: number }>;
  };
  assert.deepEqual(dto.members.map((m) => m.displayName).sort(), ['Ann', 'Bob']);
  assert.equal(dto.standings[0].points, 3);
  assert.equal(dto.standings[0].played, 1);
});

test('disputed fixtures resolve through the creator only', async (t) => {
  const { app, post } = await boot();
  t.after(() => app.close());

  const created = await post('/api/leagues', { name: 'Cup', clientId: A, displayName: 'Ann' });
  const { code, id } = created.json as { code: string; id: string };
  await post('/api/leagues/join', { code, clientId: B, displayName: 'Bob' });
  const started = await post(`/api/leagues/${id}/start`, { clientId: A });
  const fx = (started.json.fixtures as Array<{ id: string; homeClientId: string; awayClientId: string }>)[0];
  await post(`/api/fixtures/${fx.id}/submit`, { clientId: fx.homeClientId, homeScore: 3, awayScore: 0, matchToken: TOKEN });
  const clash = await post(`/api/fixtures/${fx.id}/submit`, { clientId: fx.awayClientId, homeScore: 0, awayScore: 3, matchToken: TOKEN });
  assert.equal((clash.json.fixture as { status: string }).status, 'disputed');

  const stranger = await post(`/api/fixtures/${fx.id}/resolve`, {
    clientId: fx.awayClientId, homeScore: 0, awayScore: 3,
  });
  assert.equal(stranger.status, 403);
  const ruling = await post(`/api/fixtures/${fx.id}/resolve`, { clientId: A, homeScore: 1, awayScore: 1 });
  assert.equal(ruling.status, 200);
  assert.equal((ruling.json.fixture as { status: string }).status, 'confirmed');
});

test('league routes reject garbage and unknown paths', async (t) => {
  const { app, post, get } = await boot();
  t.after(() => app.close());
  const badScore = await post('/api/fixtures/00000000-0000-4000-8000-000000000000/submit', {
    clientId: A, homeScore: 1, awayScore: -1, matchToken: TOKEN,
  });
  assert.equal(badScore.status, 400);
  const noFixture = await post('/api/fixtures/00000000-0000-4000-8000-000000000000/submit', {
    clientId: A, homeScore: 1, awayScore: 1, matchToken: TOKEN,
  });
  assert.equal(noFixture.status, 404);
  const noLeague = await get('/api/leagues/ZZZZZZ');
  assert.equal(noLeague.status, 404);
});
