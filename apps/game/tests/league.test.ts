import test from 'node:test';
import assert from 'node:assert/strict';
import { LeagueApi, LeagueApiError, getClientId, normalizeCode, parseScore, tableLine } from '../src/league.ts';

test('league codes normalize strictly (uppercase, no 0/O/1/I)', () => {
  assert.equal(normalizeCode(' abc123 '), null, '1 is not in the alphabet');
  assert.equal(normalizeCode('abcdef'), 'ABCDEF');
  assert.equal(normalizeCode('AB CDE F'), 'ABCDEF');
  assert.equal(normalizeCode('ABCDE'), null);
  assert.equal(normalizeCode('ABCOEF'), null, 'O rejected');
});

test('scores accept 0-99 only, never clamped', () => {
  assert.equal(parseScore('2'), 2);
  assert.equal(parseScore(' 0 '), 0);
  assert.equal(parseScore('99'), 99);
  assert.equal(parseScore('100'), null);
  assert.equal(parseScore('-1'), null);
  assert.equal(parseScore('x'), null);
  assert.equal(parseScore(''), null);
});

test('guest id is stable per device and hex-shaped', () => {
  const ids: string[] = [];
  const g = globalThis as Record<string, unknown>;
  const real = g.localStorage;
  const mem = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
  };
  try {
    ids.push(getClientId(), getClientId());
  } finally {
    if (real === undefined) delete g.localStorage; else g.localStorage = real;
  }
  assert.equal(ids[0], ids[1], 'minted once');
  assert.match(ids[0], /^[0-9a-f]{8}$/);
});

test('standings one-liners truncate long names', () => {
  assert.equal(tableLine(1, 'Ann', 2, 4, 3, 1), '1. ANN 4 PTS · 2P · 3-1');
  assert.equal(tableLine(2, 'Very Long Nickname Here', 0, 0, 0, 0), '2. VERY LONG NI 0 PTS · 0P · 0-0');
});

test('league api maps server errors and outages to messages', async () => {
  const okFetch = (async (url: string) => {
    if (url.endsWith('/api/leagues')) {
      return new Response(JSON.stringify({ id: '1', code: 'ABCDEF' }), { status: 201 });
    }
    throw new Error('unexpected ' + url);
  }) as typeof fetch;
  const api = new LeagueApi('http://x', okFetch);
  assert.deepEqual(await api.createLeague('L', 'a', 'Ann'), { id: '1', code: 'ABCDEF' });

  const errFetch = (async () => new Response(JSON.stringify({ error: 'league not found' }), { status: 404 })) as typeof fetch;
  await assert.rejects(apiWith(errFetch).getLeague('ZZZZZZ'),
    (e: unknown) => e instanceof LeagueApiError && e.message === 'LEAGUE NOT FOUND' && e.status === 404);

  const downFetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  await assert.rejects(apiWith(downFetch).getLeague('ABCDEF'),
    (e: unknown) => e instanceof LeagueApiError && e.message === 'SERVER UNREACHABLE' && e.status === 0);
});

function apiWith(f: typeof fetch): LeagueApi {
  return new LeagueApi('http://x', f);
}
