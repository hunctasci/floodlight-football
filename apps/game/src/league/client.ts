import { makeClientId } from '../net/signal';
import type { Fixture, League } from './types';

export type { Fixture, League };
export type { StandingsRow } from './types';

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
  constructor(private base: string, private fetchFn: FetchLike = (url, init) => fetch(url, init)) {}

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
  let id = store.get('floodlight-client-id');
  if (!id) { id = makeClientId(); store.set('floodlight-client-id', id); }
  return id;
}

export function getDisplayName(): string {
  return store.get('floodlight-name') || '';
}
export function setDisplayName(v: string) {
  store.set('floodlight-name', v);
}

export function getServerUrl(): string {
  const saved = store.get('floodlight-server-url');
  if (saved) return saved;
  // Same-origin by default: production AND `npm run dev` serve the game +
  // control plane from one Cloudflare origin (Worker + Static Assets), so
  // online rooms work with zero setup (and stay on https, avoiding
  // mixed-content blocks). Self-hosters point LEAGUE → SERVER at their Node
  // reference server instead.
  try {
    return window.location.origin;
  } catch { /* non-browser (tests): fall through */ }
  return 'http://127.0.0.1:8080';
}
export function setServerUrl(v: string) {
  store.set('floodlight-server-url', v.replace(/\/+$/, ''));
}

export function getLeagueCode(): string {
  return store.get('floodlight-league-code') || '';
}
export function setLeagueCode(v: string) {
  store.set('floodlight-league-code', v);
}

// --- Daily Cup: one deterministic match per calendar day, best score kept. ---
export function dailyKey(d = new Date()): string {
  return `floodlight-daily-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
/** Pure date hash: every player worldwide faces the same seeded match. */
export function dailySeed(d = new Date()): number {
  let h = 2166136261 ^ (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
  h = Math.imul(h, 16777619) >>> 0;
  return h || 1;
}
export function getDailyBest(d = new Date()): number {
  return Number(store.get(dailyKey(d)) || '0');
}
export function setDailyBest(score: number, d = new Date()): void {
  if (score > getDailyBest(d)) store.set(dailyKey(d), String(score));
}

/** "ANN 4 PTS · 2-0" one-liners for the standings panel. */
export function tableLine(rank: number, name: string, played: number, points: number, gf: number, ga: number): string {
  return `${rank}. ${name.toUpperCase().slice(0, 12)} ${points} PTS · ${played}P · ${gf}-${ga}`;
}
