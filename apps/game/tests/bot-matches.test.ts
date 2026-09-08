import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchEngine } from '../src/engine.ts';
import { EMPTY_INPUT } from '../src/types.ts';
import { encodeInput, decodeInput } from '../src/net/codec.ts';
import { replayBotMatch } from '../worker/city-league/bots.ts';
import { countryTeams } from '../src/city-league/kits.ts';

test('country bot replay reproduces final score and rejects incomplete or extra inputs', () => {
  const engine = new MatchEngine(0, 2, 124, 1);
  engine.state.teams = countryTeams('TR', 'BR');
  const bytes: number[] = [];
  for (let tick = 0; tick < 20000 && engine.state.phase !== 'fulltime'; tick++) {
    if (engine.state.phase === 'halftime') engine.continueHalf();
    const encoded = encodeInput({ ...EMPTY_INPUT, pass: tick % 60 === 0, x: .123, z: -.345 });
    bytes.push(...encoded);
    engine.update(1 / 60, decodeInput(encoded));
    engine.events.length = 0;
  }
  assert.equal(engine.state.phase, 'fulltime');
  const replay = Buffer.from(bytes).toString('base64');
  assert.deepEqual(replayBotMatch(124, 2, 1, replay), engine.state.score);
  assert.throws(() => replayBotMatch(124, 2, 1, Buffer.from(bytes.slice(0, -6)).toString('base64')), /not finished/);
  assert.throws(() => replayBotMatch(124, 2, 1, Buffer.from([...bytes,0,0,0,0,0,0]).toString('base64')), /after fulltime/);
  assert.throws(() => replayBotMatch(124, 2, 1, '!'), /invalid replay/);
});

import { computeCityStandings } from '../src/city-league/standings.ts';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { BotLeagueService, chooseBotDifficulty } from '../worker/city-league/bots.ts';

test('bot results persist once, require credentials, and credit both countries through confirmed matches', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_city_league.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0003_bot_matches.sql', import.meta.url), 'utf8'));
  const db = {
    prepare(query: string) {
      let args: any[] = [];
      return { bind(...values: any[]) { args = values; return this; },
        async first() { return sql.prepare(query).get(...args) ?? null; },
        async all() { return { results: sql.prepare(query).all(...args) }; },
        async run() { return sql.prepare(query).run(...args); } };
    },
    async batch(statements: any[]) { return Promise.all(statements.map(s => s.run())); },
  };
  sql.prepare('INSERT INTO players VALUES(?,?,?,?,?,?)').run('home','Tester','TR','season',0,0);
  let now = Date.now();
  const service = new BotLeagueService(db as any, () => now);
  const match = await service.create('home','TR');
  assert.notEqual(match.opponentCountry, 'TR');
  sql.prepare('UPDATE bot_matches SET half_duration=2 WHERE match_id=?').run(match.matchId);
  const engine = new MatchEngine(0,2,match.seed,match.difficulty as 0 | 1 | 2), bytes: number[] = [];
  for (let tick=0; tick<20000 && engine.state.phase !== 'fulltime'; tick++) {
    if (engine.state.phase === 'halftime') engine.continueHalf();
    const input = encodeInput({ ...EMPTY_INPUT, pass: tick%60===0 });
    bytes.push(...input); engine.update(1/60,decodeInput(input)); engine.events.length=0;
  }
  const replay = Buffer.from(bytes).toString('base64');
  await assert.rejects(service.finish(match.matchId,'home',match.matchToken,replay), /not finished/);
  now += 120000;
  await assert.rejects(service.finish(match.matchId,'other',match.matchToken,replay), /credentials/);
  const result = await service.finish(match.matchId,'home',match.matchToken,replay);
  assert.equal(result.status,'confirmed');
  assert.deepEqual([result.homeScore,result.awayScore], engine.state.score);
  assert.deepEqual(await service.finish(match.matchId,'home',match.matchToken,replay), result);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM matches WHERE status='confirmed' AND home_city_code != away_city_code").get()?.n, 1);
  const row = sql.prepare('SELECT * FROM matches').get()!;
  const table = computeCityStandings([{ seasonKey: String(row.season_key), status: 'confirmed', homeCityCode: 'TR', awayCityCode: match.opponentCountry, homeScore: result.homeScore, awayScore: result.awayScore }], String(row.season_key));
  assert.equal(table.find(r => r.cityCode === 'TR')?.points, result.homeScore > result.awayScore ? 3 : result.homeScore === result.awayScore ? 1 : 0);
  assert.equal(table.find(r => r.cityCode === match.opponentCountry)?.points, result.awayScore > result.homeScore ? 3 : result.homeScore === result.awayScore ? 1 : 0);
  sql.close();
});


test('difficulty protects newcomers and losing players; strong players get occasional hard opponents', () => {
  const win = { home_score: 2, away_score: 0 }, loss = { home_score: 0, away_score: 2 };
  assert.equal(chooseBotDifficulty([], .99), 0);
  assert.equal(chooseBotDifficulty([win,win], 0), 0);
  assert.equal(chooseBotDifficulty([loss,loss,win,win,win], .99), 0);
  assert.equal(chooseBotDifficulty([win,loss,win], .2), 0);
  assert.equal(chooseBotDifficulty([win,loss,win], .8), 1);
  assert.equal(chooseBotDifficulty([win,win,win,win,loss], .1), 2);
  assert.equal(chooseBotDifficulty([win,win,win,win,loss], .8), 1);
});
