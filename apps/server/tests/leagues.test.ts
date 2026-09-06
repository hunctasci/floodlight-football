import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LeagueError, LeagueManager, MemoryLeagueStore, computeStandings, roundRobin,
} from '../src/leagues.ts';

const A = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const B = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
const C = 'cccccccc-0000-4000-8000-cccccccccccc';
const D = 'dddddddd-0000-4000-8000-dddddddddddd';
const TOKEN = '0'.repeat(32);

function manager() {
  let n = 0;
  const codes = ['ABCDEF', 'GHJKLM'];
  return new LeagueManager(new MemoryLeagueStore(() => 1000), {
    codeGen: () => codes[n++ % codes.length],
    idGen: () => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    now: () => 1000,
  });
}

test('round-robin pairs everyone once, no byes for even counts', () => {
  const fx = roundRobin([A, B, C, D]);
  assert.equal(fx.length, 6, '4 players → 6 fixtures');
  const pairs = new Set(fx.map((f) => [f.home, f.away].sort().join('v')));
  assert.equal(pairs.size, 6, 'every pairing exactly once');
  assert.deepEqual([...new Set(fx.map((f) => f.round))].sort(), [1, 2, 3]);
});

test('round-robin handles odd counts with byes (one rest per round)', () => {
  const fx = roundRobin([A, B, C]);
  assert.equal(fx.length, 3, '3 players → 3 fixtures');
  const pairs = new Set(fx.map((f) => [f.home, f.away].sort().join('v')));
  assert.equal(pairs.size, 3);
});

test('create allocates a code and seats the creator; join is idempotent', async () => {
  const m = manager();
  const { id, code } = await m.create('Saturday', A, 'Hün');
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await m.join(code, B, 'Efe');
  const again = await m.join(code, B, 'Efe II');
  assert.equal(again.id, id);
  const league = await m.getLeague(code);
  assert.deepEqual(league.members.map((x) => x.displayName), ['Hün', 'Efe II']);
  assert.equal(league.status, 'lobby');
});

test('join rejects unknown codes and started leagues', async () => {
  const m = manager();
  await assert.rejects(m.join('ZZZZZZ', A, 'x'), (e: unknown) => e instanceof LeagueError && e.code === 'NOT_FOUND');
  const { code } = await m.create('L', A, 'a');
  await m.join(code, B, 'b');
  await m.start((await m.getLeague(code)).id, A);
  await assert.rejects(m.join(code, C, 'c'), (e: unknown) => e instanceof LeagueError && e.code === 'BAD_STATE');
});

test('start needs the creator and 2+ players, then emits fixtures', async () => {
  const m = manager();
  const { code } = await m.create('L', A, 'a');
  const id = (await m.getLeague(code)).id;
  await assert.rejects(m.start(id, A), (e: unknown) => e instanceof LeagueError && e.code === 'BAD_STATE');
  await assert.rejects(m.start(id, B), (e: unknown) => e instanceof LeagueError && e.code === 'FORBIDDEN');
  await m.join(code, B, 'b');
  await m.join(code, C, 'c');
  const rows = await m.start(id, A);
  assert.equal(rows.length, 3);
  const league = await m.getLeague(code);
  assert.equal(league.status, 'active');
  await assert.rejects(m.start(id, A), (e: unknown) => e instanceof LeagueError && e.code === 'BAD_STATE');
});

test('dual-submit: single side waits, agreement confirms, mismatch disputes', async () => {
  const m = manager();
  const { code } = await m.create('L', A, 'a');
  await m.join(code, B, 'b');
  const [fx] = await m.start((await m.getLeague(code)).id, A);
  let r = await m.submit(fx.id, fx.homeClientId, 2, 1, TOKEN);
  assert.equal(r.status, 'pending');
  r = await m.submit(fx.id, fx.awayClientId, 2, 1, TOKEN);
  assert.equal(r.status, 'confirmed');
  assert.deepEqual([r.homeScore, r.awayScore], [2, 1]);
  // Confirmed fixtures are locked.
  const locked = await m.submit(fx.id, fx.homeClientId, 5, 5, TOKEN);
  assert.equal(locked.homeScore, 2);

  const { code: code2 } = await m.create('M', A, 'a');
  await m.join(code2, B, 'b');
  const [fx2] = await m.start((await m.getLeague(code2)).id, A);
  await m.submit(fx2.id, fx2.homeClientId, 3, 0, TOKEN);
  r = await m.submit(fx2.id, fx2.awayClientId, 1, 1, TOKEN);
  assert.equal(r.status, 'disputed');
  // Strangers cannot submit.
  await assert.rejects(
    m.submit(fx2.id, C, 0, 0, TOKEN),
    (e: unknown) => e instanceof LeagueError && e.code === 'NOT_MEMBER',
  );
});

test('creator resolves disputes; confirmed fixtures stand', async () => {
  const m = manager();
  const { code } = await m.create('L', A, 'a');
  await m.join(code, B, 'b');
  const [fx] = await m.start((await m.getLeague(code)).id, A);
  await m.submit(fx.id, fx.homeClientId, 3, 0, TOKEN);
  await m.submit(fx.id, fx.awayClientId, 0, 3, TOKEN);
  await assert.rejects(
    m.resolve(fx.id, B, 1, 1),
    (e: unknown) => e instanceof LeagueError && e.code === 'FORBIDDEN',
  );
  const r = await m.resolve(fx.id, A, 2, 2);
  assert.equal(r.status, 'confirmed');
  assert.deepEqual([r.homeScore, r.awayScore], [2, 2]);
  await assert.rejects(
    m.resolve(fx.id, A, 1, 0),
    (e: unknown) => e instanceof LeagueError && e.code === 'BAD_STATE',
  );
});

test('standings count confirmed fixtures: Pts, then GD, then GF', async () => {
  const m = manager();
  const { code } = await m.create('L', A, 'Ann');
  await m.join(code, B, 'Bob');
  await m.join(code, C, 'Cem');
  const id = (await m.getLeague(code)).id;
  await m.start(id, A);
  // Submit a final score regardless of who is home: scores are home-relative.
  const play = async (winner: string, loser: string, winnerGoals: number, loserGoals: number) => {
    const league = await m.getLeague(code);
    const fx = league.fixtures.find((f) =>
      [f.homeClientId, f.awayClientId].sort().join() === [winner, loser].sort().join()
      && f.status !== 'confirmed')!;
    const hs = fx.homeClientId === winner ? winnerGoals : loserGoals;
    const as = fx.homeClientId === winner ? loserGoals : winnerGoals;
    await m.submit(fx.id, fx.homeClientId, hs, as, TOKEN);
    await m.submit(fx.id, fx.awayClientId, hs, as, TOKEN);
  };
  const draw = async (x: string, y: string) => {
    const league = await m.getLeague(code);
    const fx = league.fixtures.find((f) =>
      [f.homeClientId, f.awayClientId].sort().join() === [x, y].sort().join()
      && f.status !== 'confirmed')!;
    await m.submit(fx.id, fx.homeClientId, 1, 1, TOKEN);
    await m.submit(fx.id, fx.awayClientId, 1, 1, TOKEN);
  };
  // Ann beats Bob 2-0, draws Cem 1-1; Bob beats Cem 3-0.
  await play(A, B, 2, 0);
  await draw(A, C);
  await play(B, C, 3, 0);

  const table = (await m.getLeague(code)).standings;
  assert.deepEqual(table.map((r) => r.displayName), ['Ann', 'Bob', 'Cem']);
  assert.deepEqual(table.map((r) => r.points), [4, 3, 1]);
  assert.equal(table[0].played, 2);
});

test('computeStandings ignores pending and disputed fixtures', () => {
  const members = [
    { clientId: A, displayName: 'a', joinedAt: 1 },
    { clientId: B, displayName: 'b', joinedAt: 2 },
  ];
  const base = { id: 'x', leagueId: 'y', round: 1, homeClientId: A, awayClientId: B };
  const table = computeStandings(members, [
    { ...base, id: '1', status: 'pending', homeScore: null, awayScore: null },
    { ...base, id: '2', status: 'disputed', homeScore: null, awayScore: null },
  ]);
  assert.deepEqual(table.map((r) => r.played), [0, 0]);
});
