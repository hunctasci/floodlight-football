/**
 * D1-backed CityLeagueStore. All SQL lives here — never in routes/UI.
 * Finalization groups dependent writes via D1 batch (atomic).
 */

import type {
  CityLeagueStore,
  MatchRow,
  MatchStatus,
  NewMatch,
  PlayerRow,
  SubmissionRow,
} from './store';

// Minimal D1 surface used here (real D1Database in Workers, fakes in tests).
export interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

export class D1CityLeagueStore implements CityLeagueStore {
  constructor(private db: D1Like) {}

  async getPlayer(clientId: string): Promise<PlayerRow | null> {
    const row = await this.db
      .prepare('SELECT client_id, display_name, city_code, city_season_key, created_at, updated_at FROM players WHERE client_id = ?')
      .bind(clientId)
      .first<PlayerRow>();
    return row ?? null;
  }

  async upsertPlayer(row: PlayerRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO players (client_id, display_name, city_code, city_season_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(client_id) DO UPDATE SET
           display_name = excluded.display_name,
           city_code = excluded.city_code,
           city_season_key = excluded.city_season_key,
           updated_at = excluded.updated_at`,
      )
      .bind(row.client_id, row.display_name, row.city_code, row.city_season_key, row.created_at, row.updated_at)
      .run();
  }

  async getMatch(id: string): Promise<MatchRow | null> {
    const row = await this.db
      .prepare(
        'SELECT id, room_id, season_key, home_client_id, away_client_id, home_city_code, away_city_code, match_token_hash, status, home_score, away_score, started_at, confirmed_at FROM matches WHERE id = ?',
      )
      .bind(id)
      .first<MatchRow>();
    return row ?? null;
  }

  async createMatch(row: NewMatch): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO matches (id, room_id, season_key, home_client_id, away_client_id, home_city_code, away_city_code, match_token_hash, status, home_score, away_score, started_at, confirmed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, NULL)`,
      )
      .bind(
        row.id,
        row.room_id,
        row.season_key,
        row.home_client_id,
        row.away_client_id,
        row.home_city_code,
        row.away_city_code,
        row.match_token_hash,
        row.started_at,
      )
      .run();
  }

  async setMatchResult(
    id: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void> {
    await this.db
      .prepare('UPDATE matches SET status = ?, home_score = ?, away_score = ?, confirmed_at = ? WHERE id = ?')
      .bind(status, homeScore, awayScore, confirmedAt, id)
      .run();
  }

  async upsertSubmission(row: SubmissionRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO submissions (match_id, client_id, home_score, away_score, submitted_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(match_id, client_id) DO UPDATE SET
           home_score = excluded.home_score,
           away_score = excluded.away_score,
           submitted_at = excluded.submitted_at`,
      )
      .bind(row.match_id, row.client_id, row.home_score, row.away_score, row.submitted_at)
      .run();
  }

  async listSubmissions(matchId: string): Promise<SubmissionRow[]> {
    const res = await this.db
      .prepare('SELECT match_id, client_id, home_score, away_score, submitted_at FROM submissions WHERE match_id = ?')
      .bind(matchId)
      .all<SubmissionRow>();
    return res.results ?? [];
  }

  async listSeasonMatches(seasonKey: string): Promise<MatchRow[]> {
    const res = await this.db
      .prepare(
        'SELECT id, room_id, season_key, home_client_id, away_client_id, home_city_code, away_city_code, match_token_hash, status, home_score, away_score, started_at, confirmed_at FROM matches WHERE season_key = ?',
      )
      .bind(seasonKey)
      .all<MatchRow>();
    return res.results ?? [];
  }

  async finalizeWithSubmission(
    submission: SubmissionRow,
    matchId: string,
    status: MatchStatus,
    homeScore: number | null,
    awayScore: number | null,
    confirmedAt: number | null,
  ): Promise<void> {
    const upsert = this.db
      .prepare(
        `INSERT INTO submissions (match_id, client_id, home_score, away_score, submitted_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(match_id, client_id) DO UPDATE SET
           home_score = excluded.home_score,
           away_score = excluded.away_score,
           submitted_at = excluded.submitted_at`,
      )
      .bind(submission.match_id, submission.client_id, submission.home_score, submission.away_score, submission.submitted_at);
    const update = this.db
      .prepare('UPDATE matches SET status = ?, home_score = ?, away_score = ?, confirmed_at = ? WHERE id = ?')
      .bind(status, homeScore, awayScore, confirmedAt, matchId);
    await this.db.batch([upsert, update]);
  }
}
