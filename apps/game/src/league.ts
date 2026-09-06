import { makeClientId } from './net/signal';
import type { Fixture, League } from './league-types';

export type { Fixture, League };
export type { StandingsRow } from './league-types';

export class LeagueApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** League join codes: 6 uppercase chars, no 0/O/1/I (same alphabet as rooms). */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
}

/** Score boxes accept 0-99 only; anything else is rejected, never clamped. */
export function parseScore(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n <= 99 ? n : null;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Thin REST client for the F4b league API. Fetch is injectable for tests. */
export class LeagueApi {
  constructor(private base: string, private fetchFn: FetchLike = fetch) {}

  private async call<T>(path: string, method: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(this.base + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new LeagueApiError('SERVER UNREACHABLE', 0);
    }
    let json: Record<string, unknown> = {};
    try { json = await res.json() as Record<string, unknown>; } catch { /* empty body */ }
    if (!res.ok) throw new LeagueApiError(String(json.error ?? `HTTP ${res.status}`).toUpperCase(), res.status);
    return json as T;
  }

  createLeague(name: string, clientId: string, displayName: string) {
    return this.call<{ id: string; code: string }>('/api/leagues', 'POST', { name, clientId, displayName });
  }
  joinLeague(code: string, clientId: string, displayName: string) {
    return this.call<{ id: string; code: string }>('/api/leagues/join', 'POST', { code, clientId, displayName });
  }
  getLeague(code: string) {
    return this.call<League>('/api/leagues/' + code, 'GET');
  }
  startLeague(id: string, clientId: string) {
    return this.call<{ fixtures: Fixture[] }>(`/api/leagues/${id}/start`, 'POST', { clientId });
  }
  submitResult(fixtureId: string, clientId: string, homeScore: number, awayScore: number, matchToken: string) {
    return this.call<{ fixture: Fixture }>(`/api/fixtures/${fixtureId}/submit`, 'POST',
      { clientId, homeScore, awayScore, matchToken });
  }
  resolveResult(fixtureId: string, clientId: string, homeScore: number, awayScore: number) {
    return this.call<{ fixture: Fixture }>(`/api/fixtures/${fixtureId}/resolve`, 'POST',
      { clientId, homeScore, awayScore });
  }
}

/* ---------- local identity & settings (guest-first, ADR-004) ---------- */

const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* private mode */ }
  },
};

/** Stable guest id, minted once and kept on this device. */
export function getClientId(): string {
  let id = store.get('retro-client-id');
  if (!id) { id = makeClientId(); store.set('retro-client-id', id); }
  return id;
}

export function getDisplayName(): string {
  return store.get('retro-name') || '';
}
export function setDisplayName(v: string) {
  store.set('retro-name', v);
}

export function getServerUrl(): string {
  return store.get('retro-server-url') || 'http://127.0.0.1:8080';
}
export function setServerUrl(v: string) {
  store.set('retro-server-url', v.replace(/\/+$/, ''));
}

export function getLeagueCode(): string {
  return store.get('retro-league-code') || '';
}
export function setLeagueCode(v: string) {
  store.set('retro-league-code', v);
}

/** "ANN 4 PTS · 2-0" one-liners for the standings panel. */
export function tableLine(rank: number, name: string, played: number, points: number, gf: number, ga: number): string {
  return `${rank}. ${name.toUpperCase().slice(0, 12)} ${points} PTS · ${played}P · ${gf}-${ga}`;
}
