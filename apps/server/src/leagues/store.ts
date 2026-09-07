import { randomUUID } from 'node:crypto';
import type { FixtureStatus, LeagueStatus, Member } from '@floodlight/protocol';

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
