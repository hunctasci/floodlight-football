import type { D1Like } from './d1-store';
import { COUNTRIES } from '../../src/city-league/countries';
import { MatchEngine } from '../../src/engine';
import { decodeInput, INPUT_BYTES } from '../../src/net/codec';
import { getCurrentSeasonKey } from '../../src/city-league/season';
import { makeMatchToken, makeRoomCode } from '../room-logic';
import { CityLeagueError, sha256Hex } from './service';

export const BOT_WAIT_MS = 8000;
export const BOT_HALF_SECONDS = 60;
export const MAX_BOT_TICKS = 36000;
import type { BotAssignment } from '../../src/city-league/bot-match';
const NAMES = ['Alex', 'Dani', 'Max', 'Leo', 'Nico', 'Sam', 'Robin', 'Ari', 'Kai', 'Luca', 'Rafa', 'Mika'];

/** Re-simulate recorded inputs. Scores are calculated here, never accepted
 * from the browser. Halftime is a UI pause, so resume at the next input. */
export function replayBotMatch(seed: number, halfDuration: number, difficulty: number, encoded: string): [number, number] {
  if (typeof encoded !== 'string' || encoded.length > MAX_BOT_TICKS * INPUT_BYTES * 4 / 3 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new CityLeagueError('BAD_REQUEST', 'invalid replay');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)); } catch { throw new CityLeagueError('BAD_REQUEST', 'invalid replay'); }
  if (!bytes.length || bytes.length % INPUT_BYTES || bytes.length > MAX_BOT_TICKS * INPUT_BYTES) throw new CityLeagueError('BAD_REQUEST', 'invalid replay');
  const engine = new MatchEngine(0, halfDuration, seed, difficulty as 0 | 1 | 2);
  for (let i = 0; i < bytes.length; i += INPUT_BYTES) {
    if (engine.state.phase === 'fulltime') throw new CityLeagueError('BAD_REQUEST', 'replay continues after fulltime');
    if (engine.state.phase === 'halftime') engine.continueHalf();
    engine.update(1 / 60, decodeInput(bytes.subarray(i, i + INPUT_BYTES)));
    engine.events.length = 0;
  }
  if (engine.state.phase !== 'fulltime') throw new CityLeagueError('BAD_REQUEST', 'match has not finished');
  return [...engine.state.score];
}

export class BotLeagueService {
  constructor(private db: D1Like, private now = Date.now) {}
  async create(clientId: string, country: string): Promise<BotAssignment> {
    const profile = await this.db.prepare('SELECT city_code FROM players WHERE client_id=?').bind(clientId).first<{ city_code: string }>();
    if (!profile || profile.city_code !== country) throw new CityLeagueError('FORBIDDEN', 'country profile changed');
    const random = crypto.getRandomValues(new Uint32Array(3));
    const candidates = COUNTRIES.filter(c => c.code !== country);
    const opponentCountry = candidates[random[0] % candidates.length].code;
    const seed = random[1] % 1000000, opponentName = NAMES[random[2] % NAMES.length];
    const matchId = crypto.randomUUID(), matchToken = makeMatchToken(), awayClientId = crypto.randomUUID();
    const halfDuration = BOT_HALF_SECONDS, difficulty = 1;
    await this.db.batch([
      this.db.prepare(`INSERT INTO matches(id,room_id,season_key,home_client_id,away_client_id,home_city_code,away_city_code,match_token_hash,status,started_at)
        VALUES(?,?,?,?,?,?,?,?,'pending',?)`).bind(matchId,makeRoomCode(),getCurrentSeasonKey(this.now()),clientId,awayClientId,country,opponentCountry,await sha256Hex(matchToken),this.now()),
      this.db.prepare('INSERT INTO bot_matches(match_id,seed,half_duration,difficulty,opponent_name) VALUES(?,?,?,?,?)').bind(matchId,seed,halfDuration,difficulty,opponentName),
    ]);
    return { matchId, matchToken, homeClientId: clientId, awayClientId, homeCountry: country, opponentCountry, opponentName, seed, halfDuration, difficulty };
  }
  async finish(matchId: string, clientId: string, token: string, replay: string) {
    const row = await this.db.prepare(`SELECT m.*, b.seed,b.half_duration,b.difficulty FROM matches m JOIN bot_matches b ON b.match_id=m.id WHERE m.id=?`).bind(matchId).first<Record<string, any>>();
    if (!row) throw new CityLeagueError('NOT_FOUND', 'match not found');
    if (row.home_client_id !== clientId || typeof token !== 'string' || await sha256Hex(token) !== row.match_token_hash) throw new CityLeagueError('FORBIDDEN', 'invalid match credentials');
    if (row.status === 'confirmed') return { status: 'confirmed', matchId, homeScore: row.home_score, awayScore: row.away_score };
    if (row.status !== 'pending') throw new CityLeagueError('CONFLICT', 'match closed');
    if (this.now() - row.started_at < row.half_duration * 2000) throw new CityLeagueError('BAD_REQUEST', 'match has not finished');
    if (this.now() - row.started_at > 86400000) throw new CityLeagueError('BAD_REQUEST', 'match expired');
    const [homeScore,awayScore] = replayBotMatch(row.seed,row.half_duration,row.difficulty,replay);
    await this.db.prepare("UPDATE matches SET status='confirmed',home_score=?,away_score=?,confirmed_at=? WHERE id=? AND status='pending'")
      .bind(homeScore,awayScore,this.now(),matchId).run();
    const result = await this.db.prepare('SELECT status,home_score,away_score FROM matches WHERE id=?').bind(matchId).first<Record<string, any>>();
    return { status: result!.status, matchId, homeScore: result!.home_score, awayScore: result!.away_score };
  }
}
