import { randomBytes, randomUUID } from 'node:crypto';
import type { FixtureStatus, LeagueStatus, Member, StandingsRow } from '@floodlight/protocol';

export class LeagueError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'EXISTS' | 'FORBIDDEN' | 'BAD_STATE' | 'NOT_MEMBER' | 'BAD_CODE',
    message: string,
  ) { super(message); }
}

export interface LeagueRecord {
  id: string;
  name: string;
  code: string;
  status: LeagueStatus;
  createdBy: string;
  createdAt: number;
}

export interface FixtureRecord {
  id: string;
  leagueId: string;
  round: number;
  homeClientId: string;
  awayClientId: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface SubmissionRecord {
  fixtureId: string;
  clientId: string;
  homeScore: number;
  awayScore: number;
  matchToken: string;
  submittedAt: number;
}

export interface NewFixture {
  leagueId: string;
  round: number;
  homeClientId: string;
  awayClientId: string;
}

/** Durable league state. Postgres owns truth in prod; memory serves tests/dev. */
export interface LeagueStore {
  createLeague(rec: LeagueRecord): Promise<boolean>;
  getLeagueByCode(code: string): Promise<LeagueRecord | null>;
  getLeagueById(id: string): Promise<LeagueRecord | null>;
  /** Upsert: re-joining updates the display name, never duplicates. */
  addMember(leagueId: string, member: Member): Promise<void>;
  listMembers(leagueId: string): Promise<Member[]>;
  setStatus(id: string, status: LeagueStatus): Promise<void>;
  addFixtures(rows: NewFixture[]): Promise<FixtureRecord[]>;
  listFixtures(leagueId: string): Promise<FixtureRecord[]>;
  getFixture(id: string): Promise<FixtureRecord | null>;
  setFixtureResult(id: string, status: FixtureStatus, homeScore: number | null, awayScore: number | null): Promise<void>;
  upsertSubmission(sub: SubmissionRecord): Promise<void>;
  listSubmissions(fixtureId: string): Promise<SubmissionRecord[]>;
  upsertPlayer(clientId: string, displayName: string): Promise<void>;
}

/** Hermetic in-process store: unit tests, local dev without Postgres. */
export class MemoryLeagueStore implements LeagueStore {
  private leagues = new Map<string, LeagueRecord>();
  private byCode = new Map<string, string>();
  private members = new Map<string, Map<string, Member>>();
  private fixtures = new Map<string, FixtureRecord>();
  private submissions = new Map<string, Map<string, SubmissionRecord>>();
  private players = new Map<string, string>();

  constructor(private now: () => number = Date.now) {}

  async createLeague(rec: LeagueRecord): Promise<boolean> {
    if (this.byCode.has(rec.code)) return false;
    this.leagues.set(rec.id, { ...rec });
    this.byCode.set(rec.code, rec.id);
    return true;
  }

  async getLeagueByCode(code: string): Promise<LeagueRecord | null> {
    const id = this.byCode.get(code);
    return id ? { ...this.leagues.get(id)! } : null;
  }

  async getLeagueById(id: string): Promise<LeagueRecord | null> {
    const l = this.leagues.get(id);
    return l ? { ...l } : null;
  }

  async addMember(leagueId: string, member: Member): Promise<void> {
    let m = this.members.get(leagueId);
    if (!m) { m = new Map(); this.members.set(leagueId, m); }
    m.set(member.clientId, { ...member });
  }

  async listMembers(leagueId: string): Promise<Member[]> {
    return [...(this.members.get(leagueId)?.values() ?? [])].map((m) => ({ ...m }));
  }

  async setStatus(id: string, status: LeagueStatus): Promise<void> {
    this.leagues.get(id)!.status = status;
  }

  async addFixtures(rows: NewFixture[]): Promise<FixtureRecord[]> {
    return rows.map((r) => {
      const rec: FixtureRecord = { ...r, id: randomUUID(), status: 'pending', homeScore: null, awayScore: null };
      this.fixtures.set(rec.id, rec);
      return { ...rec };
    });
  }

  async listFixtures(leagueId: string): Promise<FixtureRecord[]> {
    return [...this.fixtures.values()].filter((f) => f.leagueId === leagueId).map((f) => ({ ...f }));
  }

  async getFixture(id: string): Promise<FixtureRecord | null> {
    const f = this.fixtures.get(id);
    return f ? { ...f } : null;
  }

  async setFixtureResult(id: string, status: FixtureStatus, homeScore: number | null, awayScore: number | null): Promise<void> {
    const f = this.fixtures.get(id)!;
    f.status = status; f.homeScore = homeScore; f.awayScore = awayScore;
  }

  async upsertSubmission(sub: SubmissionRecord): Promise<void> {
    let s = this.submissions.get(sub.fixtureId);
    if (!s) { s = new Map(); this.submissions.set(sub.fixtureId, s); }
    s.set(sub.clientId, { ...sub });
  }

  async listSubmissions(fixtureId: string): Promise<SubmissionRecord[]> {
    return [...(this.submissions.get(fixtureId)?.values() ?? [])].map((s) => ({ ...s }));
  }

  async upsertPlayer(clientId: string, displayName: string): Promise<void> {
    if (!this.players.has(clientId)) this.players.set(clientId, displayName);
  }
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
