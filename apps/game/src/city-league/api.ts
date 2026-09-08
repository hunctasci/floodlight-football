/**
 * City League REST client — thin fetch wrapper (fetch injectable for tests).
 * All browser access to D1 goes through the Worker; never direct D1/REST.
 */

import type { CityStanding } from './standings';

export interface SeasonDto {
  key: string;
  startsAt: number;
  endsAt: number;
}

export interface CityLeagueResponse {
  season: SeasonDto;
  standings: CityStanding[];
}

export interface ProfileDto {
  clientId: string;
  displayName: string;
  cityCode: string;
  citySeasonKey: string;
}

export interface CityMatchCreated {
  matchId: string;
  matchToken: string;
  seasonKey: string;
}

export type ResultStatus = 'confirmed' | 'pending' | 'disputed';

export interface ResultResponse {
  status: ResultStatus;
  matchId: string;
  homeScore?: number;
  awayScore?: number;
}

export class CityLeagueApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class CityLeagueApi {
  constructor(
    private base: string,
    private fetchFn: FetchLike = (url, init) => fetch(url, init),
  ) {}

  private async call<T>(path: string, method: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(this.base.replace(/\/+$/, '') + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new CityLeagueApiError('SERVER UNREACHABLE', 0);
    }
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      /* empty body */
    }
    if (!res.ok) throw new CityLeagueApiError(String(json.error ?? `HTTP ${res.status}`).toUpperCase(), res.status);
    return json as T;
  }

  upsertProfile(input: { clientId: string; displayName: string; cityCode: string }) {
    return this.call<ProfileDto>('/api/profile', 'POST', input);
  }

  getTable() {
    return this.call<CityLeagueResponse>('/api/city-league', 'GET');
  }

  createMatch(input: {
    roomCode: string;
    homeClientId: string;
    awayClientId: string;
    homeCityCode: string;
    awayCityCode: string;
  }) {
    return this.call<CityMatchCreated>('/api/city-league/matches', 'POST', input);
  }

  submitResult(matchId: string, input: { clientId: string; matchToken: string; homeScore: number; awayScore: number }) {
    return this.call<ResultResponse>(`/api/matches/${matchId}/result`, 'POST', input);
  }
}

/** Countdown copy: `2d 14h` style from now until season end. */
export function seasonCountdown(nowMs: number, endsAt: number): string {
  const diff = Math.max(0, endsAt - nowMs);
  const d = Math.floor(diff / 86400_000);
  const h = Math.floor((diff % 86400_000) / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
