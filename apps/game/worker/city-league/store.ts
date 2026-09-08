/**
 * City League persistence seam — Worker side.
 *
 * Route/handler → CityLeagueService → CityLeagueStore → D1.
 * No raw SQL outside the store implementations. An in-memory store backs
 * unit tests and local dev without D1; D1CityLeagueStore owns production.
 */

export type MatchStatus = 'pending' | 'confirmed' | 'disputed' | 'abandoned';

export interface PlayerRow {
  client_id: string;
  display_name: string;
  city_code: string;
  city_season_key: string;
  created_at: number;
  updated_at: number;
}

export interface MatchRow {
  id: string;
  room_id: string;
  season_key: string;
  home_client_id: string;
  away_client_id: string;
  home_city_code: string;
  away_city_code: string;
  match_token_hash: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  started_at: number;
  confirmed_at: number | null;
}

export interface SubmissionRow {
  match_id: string;
  client_id: string;
  home_score: number;
  away_score: number;
  submitted_at: number;
}

export interface NewMatch {
  id: string;
  room_id: string;
  season_key: string;
  home_client_id: string;
  away_client_id: string;
  home_city_code: string;
  away_city_code: string;
  match_token_hash: string;
  started_at: number;
}

export interface CityLeagueStore {
  getPlayer(clientId: string): Promise<PlayerRow | null>;
  upsertPlayer(row: PlayerRow): Promise<void>;
  getMatch(id: string): Promise<MatchRow | null>;
  createMatch(row: NewMatch): Promise<void>;
  submitAndResolve?(submission: SubmissionRow): Promise<MatchRow>;
  /** Finalize exactly once via the store's atomic path (D1 batch / memory). */
  setMatchResult(
    id: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void>;
  upsertSubmission(row: SubmissionRow): Promise<void>;
  listSubmissions(matchId: string): Promise<SubmissionRow[]>;
  /** Confirmed matches for one season (standings input). */
  listSeasonMatches(seasonKey: string): Promise<MatchRow[]>;
  /** Atomic finalization: submission + match update grouped (D1 batch). */
  finalizeWithSubmission(
    submission: SubmissionRow,
    matchId: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void>;
}

/** Hermetic store for unit tests + dev without D1. */
export class MemoryCityLeagueStore implements CityLeagueStore {
  private players = new Map<string, PlayerRow>();
  private matches = new Map<string, MatchRow>();
  private submissions = new Map<string, Map<string, SubmissionRow>>();

  async getPlayer(clientId: string): Promise<PlayerRow | null> {
    const r = this.players.get(clientId);
    return r ? { ...r } : null;
  }

  async upsertPlayer(row: PlayerRow): Promise<void> {
    this.players.set(row.client_id, { ...row });
  }

  async getMatch(id: string): Promise<MatchRow | null> {
    const r = this.matches.get(id);
    return r ? { ...r } : null;
  }

  async createMatch(row: NewMatch): Promise<void> {
    if (this.matches.has(row.id)) throw new Error('match exists');
    this.matches.set(row.id, {
      ...row,
      status: 'pending',
      home_score: null,
      away_score: null,
      confirmed_at: null,
    });
  }

  async setMatchResult(
    id: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void> {
    const m = this.matches.get(id);
    if (!m) throw new Error('match not found');
    m.status = status;
    m.home_score = homeScore;
    m.away_score = awayScore;
    m.confirmed_at = confirmedAt;
  }

  async upsertSubmission(row: SubmissionRow): Promise<void> {
    let m = this.submissions.get(row.match_id);
    if (!m) {
      m = new Map();
      this.submissions.set(row.match_id, m);
    }
    m.set(row.client_id, { ...row });
  }

  async listSubmissions(matchId: string): Promise<SubmissionRow[]> {
    return [...(this.submissions.get(matchId)?.values() ?? [])].map((s) => ({ ...s }));
  }

  async listSeasonMatches(seasonKey: string): Promise<MatchRow[]> {
    return [...this.matches.values()]
      .filter((m) => m.season_key === seasonKey)
      .map((m) => ({ ...m }));
  }

  async finalizeWithSubmission(
    submission: SubmissionRow,
    matchId: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void> {
    await this.upsertSubmission(submission);
    await this.setMatchResult(matchId, status, homeScore, awayScore, confirmedAt);
  }
}
