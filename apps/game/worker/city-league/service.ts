/**
 * City League service — business rules (single backend authority).
 *
 * - Profile upsert with weekly city lock (city_season_key).
 * - Match creation: fresh matchId + 256-bit token per game (rematches never
 *   reuse); only the SHA-256 hash is persisted.
 * - Dual-submit (ADR-004): first report → pending; matching pair →
 *   confirmed; mismatch → disputed (no points). Participant + token + score
 *   validated; same player cannot cover both sides.
 * - Standings derive from confirmed cross-city matches of the active season
 *   (no standings table).
 *
 * Pure except for injected store/clock/random. No SQL here.
 */

import { isValidCityCode } from '../../src/city-league/cities';
import { getCurrentSeasonEnd, getCurrentSeasonKey, getCurrentSeasonStart } from '../../src/city-league/season';
import { computeCityStandings, type CityStanding } from '../../src/city-league/standings';
import type { CityLeagueStore, MatchStatus } from './store';

export class CityLeagueError extends Error {
  constructor(
    public code: 'BAD_REQUEST' | 'NOT_FOUND' | 'FORBIDDEN' | 'LOCKED' | 'CONFLICT',
    message: string,
  ) {
    super(message);
  }
}

export const CLIENT_ID_RE = /^[0-9a-f-]{8,64}$/i;
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const SEASON_KEY_RE = /^\d{4}-W\d{2}$/;

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 16) return null;
  return s;
}

function validScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return hex(new Uint8Array(digest));
}

export function makeMatchId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${hex(crypto.getRandomValues(new Uint8Array(8)))}`;
  }
}

export function makeCityMatchToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export interface ServiceOpts {
  now?: () => number;
}

export class CityLeagueService {
  private now: () => number;

  constructor(private store: CityLeagueStore, opts: ServiceOpts = {}) {
    this.now = opts.now ?? Date.now;
  }

  currentSeasonKey(nowMs?: number): string {
    return getCurrentSeasonKey(nowMs ?? this.now());
  }

  async upsertProfile(input: { clientId: string; displayName: string; cityCode: string }): Promise<{
    clientId: string;
    displayName: string;
    cityCode: string;
    citySeasonKey: string;
  }> {
    if (!CLIENT_ID_RE.test(input.clientId)) throw new CityLeagueError('BAD_REQUEST', 'invalid client');
    const name = sanitizeName(input.displayName);
    if (!name) throw new CityLeagueError('BAD_REQUEST', 'invalid name');
    if (!isValidCityCode(input.cityCode)) throw new CityLeagueError('BAD_REQUEST', 'invalid city');

    const seasonKey = this.currentSeasonKey();
    const existing = await this.store.getPlayer(input.clientId);
    const t = this.now();
    if (existing && existing.city_season_key === seasonKey && existing.city_code !== input.cityCode) {
      throw new CityLeagueError('LOCKED', 'city locked for this season');
    }
    const row = {
      client_id: input.clientId,
      display_name: name,
      city_code: input.cityCode,
      city_season_key: seasonKey,
      created_at: existing?.created_at ?? t,
      updated_at: t,
    };
    await this.store.upsertPlayer(row);
    return { clientId: row.client_id, displayName: row.display_name, cityCode: row.city_code, citySeasonKey: row.city_season_key };
  }

  async createMatch(input: {
    roomCode: string;
    homeClientId: string;
    awayClientId: string;
    homeCityCode: string;
    awayCityCode: string;
  }): Promise<{ matchId: string; matchToken: string; seasonKey: string }> {
    const room = typeof input.roomCode === 'string' ? input.roomCode.trim().toUpperCase() : '';
    if (!ROOM_CODE_RE.test(room)) throw new CityLeagueError('BAD_REQUEST', 'invalid room');
    if (!CLIENT_ID_RE.test(input.homeClientId) || !CLIENT_ID_RE.test(input.awayClientId)) {
      throw new CityLeagueError('BAD_REQUEST', 'invalid client');
    }
    if (input.homeClientId === input.awayClientId) {
      throw new CityLeagueError('BAD_REQUEST', 'same player cannot represent both sides');
    }
    if (!isValidCityCode(input.homeCityCode) || !isValidCityCode(input.awayCityCode)) {
      throw new CityLeagueError('BAD_REQUEST', 'invalid city');
    }

    const [homePlayer, awayPlayer] = await Promise.all([this.store.getPlayer(input.homeClientId), this.store.getPlayer(input.awayClientId)]);
    if (!homePlayer || !awayPlayer || homePlayer.city_code !== input.homeCityCode || awayPlayer.city_code !== input.awayCityCode) {
      throw new CityLeagueError('FORBIDDEN', 'country must match each saved player profile');
    }
    const seasonKey = this.currentSeasonKey();
    const matchId = makeMatchId();
    const matchToken = makeCityMatchToken();
    await this.store.createMatch({
      id: matchId,
      room_id: room,
      season_key: seasonKey,
      home_client_id: input.homeClientId,
      away_client_id: input.awayClientId,
      home_city_code: input.homeCityCode,
      away_city_code: input.awayCityCode,
      match_token_hash: await sha256Hex(matchToken),
      started_at: this.now(),
    });
    return { matchId, matchToken, seasonKey };
  }

  async submitResult(
    matchId: string,
    input: { clientId: string; matchToken: string; homeScore: number; awayScore: number },
  ): Promise<{ status: MatchStatus; matchId: string; homeScore: number | null; awayScore: number | null }> {
    const match = await this.store.getMatch(matchId);
    if (!match) throw new CityLeagueError('NOT_FOUND', 'match not found');
    if (input.clientId !== match.home_client_id && input.clientId !== match.away_client_id) {
      throw new CityLeagueError('FORBIDDEN', 'only the two sides submit this match');
    }
    if (typeof input.matchToken !== 'string' || input.matchToken.length < 16) {
      throw new CityLeagueError('FORBIDDEN', 'invalid token');
    }
    if (!validScore(input.homeScore) || !validScore(input.awayScore)) {
      throw new CityLeagueError('BAD_REQUEST', 'invalid score');
    }
    const presented = await sha256Hex(input.matchToken);
    if (presented !== match.match_token_hash) {
      throw new CityLeagueError('FORBIDDEN', 'invalid token');
    }
    if (match.status === 'confirmed' || match.status === 'disputed' || match.status === 'abandoned') {
      return { status: match.status, matchId: match.id, homeScore: match.home_score, awayScore: match.away_score };
    }


    const submission = {
      match_id: matchId,
      client_id: input.clientId,
      home_score: input.homeScore,
      away_score: input.awayScore,
      submitted_at: this.now(),
    };

    if (this.store.submitAndResolve) {
      const resolved = await this.store.submitAndResolve(submission);
      return { status: resolved.status, matchId: resolved.id, homeScore: resolved.home_score, awayScore: resolved.away_score };
    }
    // Inspect both sides including this new report.
    const existing = await this.store.listSubmissions(matchId);
    const byClient = new Map(existing.map((s) => [s.client_id, s]));
    byClient.set(submission.client_id, submission);
    const home = byClient.get(match.home_client_id);
    const away = byClient.get(match.away_client_id);

    if (home && away) {
      if (home.home_score === away.home_score && home.away_score === away.away_score) {
        const t = this.now();
        await this.store.finalizeWithSubmission(submission, matchId, 'confirmed', home.home_score, home.away_score, t);
        return { status: 'confirmed', matchId, homeScore: home.home_score, awayScore: home.away_score };
      }
      await this.store.finalizeWithSubmission(submission, matchId, 'disputed', null, null, null);
      return { status: 'disputed', matchId, homeScore: null, awayScore: null };
    }

    await this.store.upsertSubmission(submission);
    return { status: 'pending', matchId, homeScore: null, awayScore: null };
  }

  async getTable(nowMs?: number): Promise<{
    season: { key: string; startsAt: number; endsAt: number };
    standings: CityStanding[];
  }> {
    const t = nowMs ?? this.now();
    const key = getCurrentSeasonKey(t);
    const startsAt = getCurrentSeasonStart(t);
    const endsAt = getCurrentSeasonEnd(t);
    const rows = await this.store.listSeasonMatches(key);
    const standings = computeCityStandings(
      rows.map((m) => ({
        seasonKey: m.season_key,
        status: m.status,
        homeCityCode: m.home_city_code,
        awayCityCode: m.away_city_code,
        homeScore: m.home_score,
        awayScore: m.away_score,
      })),
      key,
    );
    return { season: { key, startsAt, endsAt }, standings };
  }
}
