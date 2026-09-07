import { randomBytes, randomUUID } from 'node:crypto';
import type { FixtureStatus, LeagueStatus, Member, StandingsRow } from '@floodlight/protocol';
import type { FixtureRecord, LeagueRecord, LeagueStore } from './store.js';

export class LeagueError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'EXISTS' | 'FORBIDDEN' | 'BAD_STATE' | 'NOT_MEMBER' | 'BAD_CODE',
    message: string,
  ) { super(message); }
}

/**
 * Single round-robin via the circle method. Deterministic in, deterministic
 * out: rotation is pure, so identical member lists always yield identical
 * fixtures. Odd counts get a bye (no fixture row for the bye slot).
 */
export function roundRobin(clientIds: string[]): Array<{ round: number; home: string; away: string }> {
  const ids = [...clientIds].sort();
  if (ids.length % 2 === 1) ids.push('__bye__');
  const n = ids.length;
  const out: Array<{ round: number; home: string; away: string }> = [];
  const ring = [...ids];
  for (let round = 1; round <= n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i], b = ring[n - 1 - i];
      if (a === '__bye__' || b === '__bye__') continue;
      // Alternate home/away by round so nobody is permanently home.
      if (round % 2 === 1) out.push({ round, home: a, away: b });
      else out.push({ round, home: b, away: a });
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return out;
}

/** 3 pts win / 1 draw; Pts → GD → GF → name. Confirmed fixtures only. */
export function computeStandings(members: Member[], fixtures: FixtureRecord[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const m of members) {
    rows.set(m.clientId, {
      clientId: m.clientId, displayName: m.displayName,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
    });
  }
  for (const f of fixtures) {
    if (f.status !== 'confirmed' || f.homeScore === null || f.awayScore === null) continue;
    const h = rows.get(f.homeClientId), a = rows.get(f.awayClientId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.goalsFor += f.homeScore; h.goalsAgainst += f.awayScore;
    a.goalsFor += f.awayScore; a.goalsAgainst += f.homeScore;
    if (f.homeScore > f.awayScore) { h.won++; h.points += 3; a.lost++; }
    else if (f.homeScore < f.awayScore) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  return [...rows.values()].sort((x, y) =>
    y.points - x.points
    || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst)
    || y.goalsFor - x.goalsFor
    || x.displayName.localeCompare(y.displayName));
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface LeagueManagerOpts {
  codeGen?: () => string;
  idGen?: () => string;
  now?: () => number;
}

export class LeagueManager {
  private codeGen: () => string;
  private idGen: () => string;
  private now: () => number;

  constructor(private store: LeagueStore, opts: LeagueManagerOpts = {}) {
    this.codeGen = opts.codeGen ?? (() =>
      Array.from(randomBytes(6)).map((b) => ALPHABET[b % ALPHABET.length]).join(''));
    this.idGen = opts.idGen ?? randomUUID;
    this.now = opts.now ?? Date.now;
  }

  async create(name: string, clientId: string, displayName: string): Promise<{ id: string; code: string }> {
    await this.store.upsertPlayer(clientId, displayName);
    for (let i = 0; i < 5; i++) {
      const code = this.codeGen();
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) continue;
      const rec: LeagueRecord = {
        id: this.idGen(), name, code, status: 'lobby', createdBy: clientId, createdAt: this.now(),
      };
      if (await this.store.createLeague(rec)) {
        await this.store.addMember(rec.id, { clientId, displayName, joinedAt: this.now() });
        return { id: rec.id, code };
      }
    }
    throw new LeagueError('EXISTS', 'could not allocate a league code');
  }

  async join(code: string, clientId: string, displayName: string): Promise<LeagueRecord> {
    const league = await this.store.getLeagueByCode(code.toUpperCase());
    if (!league) throw new LeagueError('NOT_FOUND', 'league not found');
    if (league.status !== 'lobby') throw new LeagueError('BAD_STATE', 'league already started');
    await this.store.upsertPlayer(clientId, displayName);
    await this.store.addMember(league.id, { clientId, displayName, joinedAt: this.now() });
    return league;
  }

  async start(leagueId: string, clientId: string): Promise<FixtureRecord[]> {
    const league = await this.store.getLeagueById(leagueId);
    if (!league) throw new LeagueError('NOT_FOUND', 'league not found');
    if (league.createdBy !== clientId) throw new LeagueError('FORBIDDEN', 'only the creator starts the league');
    if (league.status !== 'lobby') throw new LeagueError('BAD_STATE', 'league already started');
    const members = await this.store.listMembers(leagueId);
    if (members.length < 2) throw new LeagueError('BAD_STATE', 'need at least 2 players');
    const pairings = roundRobin(members.map((m) => m.clientId));
    const rows = await this.store.addFixtures(pairings.map((p) => ({
      leagueId, round: p.round, homeClientId: p.home, awayClientId: p.away,
    })));
    await this.store.setStatus(leagueId, 'active');
    return rows;
  }

  /**
   * Dual-submit (ADR-004): each side posts what happened. The fixture
   * confirms only when home and away latest submissions agree; a
   * disagreement flags it disputed for the creator to rule on.
   */
  async submit(fixtureId: string, clientId: string, homeScore: number, awayScore: number, matchToken: string): Promise<FixtureRecord> {
    const f = await this.store.getFixture(fixtureId);
    if (!f) throw new LeagueError('NOT_FOUND', 'fixture not found');
    const league = await this.store.getLeagueById(f.leagueId);
    if (!league || league.status !== 'active') throw new LeagueError('BAD_STATE', 'league is not active');
    if (clientId !== f.homeClientId && clientId !== f.awayClientId) {
      throw new LeagueError('NOT_MEMBER', 'only the two sides submit this fixture');
    }
    if (f.status === 'confirmed') return f;
    await this.store.upsertSubmission({
      fixtureId, clientId, homeScore, awayScore, matchToken, submittedAt: this.now(),
    });
    const subs = await this.store.listSubmissions(fixtureId);
    const home = subs.find((s) => s.clientId === f.homeClientId);
    const away = subs.find((s) => s.clientId === f.awayClientId);
    if (home && away) {
      if (home.homeScore === away.homeScore && home.awayScore === away.awayScore) {
        await this.store.setFixtureResult(fixtureId, 'confirmed', home.homeScore, home.awayScore);
        return { ...f, status: 'confirmed', homeScore: home.homeScore, awayScore: home.awayScore };
      }
      await this.store.setFixtureResult(fixtureId, 'disputed', null, null);
      return { ...f, status: 'disputed', homeScore: null, awayScore: null };
    }
    return { ...f, status: 'pending' };
  }

  async resolve(fixtureId: string, clientId: string, homeScore: number, awayScore: number): Promise<FixtureRecord> {
    const f = await this.store.getFixture(fixtureId);
    if (!f) throw new LeagueError('NOT_FOUND', 'fixture not found');
    const league = await this.store.getLeagueById(f.leagueId);
    if (!league) throw new LeagueError('NOT_FOUND', 'league not found');
    if (league.createdBy !== clientId) throw new LeagueError('FORBIDDEN', 'only the creator resolves disputes');
    if (f.status === 'confirmed') throw new LeagueError('BAD_STATE', 'fixture already confirmed');
    await this.store.setFixtureResult(fixtureId, 'confirmed', homeScore, awayScore);
    return { ...f, status: 'confirmed', homeScore, awayScore };
  }

  async getLeague(code: string) {
    const league = await this.store.getLeagueByCode(code.toUpperCase());
    if (!league) throw new LeagueError('NOT_FOUND', 'league not found');
    const members = await this.store.listMembers(league.id);
    const fixtures = (await this.store.listFixtures(league.id))
      .sort((a, b) => a.round - b.round || a.homeClientId.localeCompare(b.homeClientId));
    return {
      ...league,
      members: [...members].sort((a, b) => a.joinedAt - b.joinedAt),
      fixtures: fixtures.map((f) => ({
        id: f.id, round: f.round, homeClientId: f.homeClientId, awayClientId: f.awayClientId,
        status: f.status, homeScore: f.homeScore, awayScore: f.awayScore,
      })),
      standings: computeStandings(members, fixtures),
    };
  }
}

export type { FixtureStatus, LeagueStatus } from '@floodlight/protocol';
