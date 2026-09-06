import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { FixtureStatus, LeagueStatus, Member } from '@retro/protocol';
import * as schema from './schema.js';
import type { FixtureRecord, LeagueRecord, LeagueStore, NewFixture, SubmissionRecord } from '../leagues.js';

const toMs = (d: Date) => d.getTime();
const byId = (r: typeof schema.leagues.$inferSelect): LeagueRecord => ({
  id: r.id, name: r.name, code: r.code, status: r.status as LeagueStatus,
  createdBy: r.createdBy, createdAt: toMs(r.createdAt),
});

/** Postgres-backed leagues. Assumes runMigrations() already applied 0001. */
export class PgLeagueStore implements LeagueStore {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async createLeague(rec: LeagueRecord): Promise<boolean> {
    try {
      await this.db.insert(schema.leagues).values({
        id: rec.id, name: rec.name, code: rec.code,
        status: rec.status, createdBy: rec.createdBy,
      });
      return true;
    } catch {
      return false; // code collision (unique) — caller retries with a fresh code
    }
  }

  async getLeagueByCode(code: string): Promise<LeagueRecord | null> {
    const rows = await this.db.select().from(schema.leagues).where(eq(schema.leagues.code, code));
    return rows[0] ? byId(rows[0]) : null;
  }

  async getLeagueById(id: string): Promise<LeagueRecord | null> {
    const rows = await this.db.select().from(schema.leagues).where(eq(schema.leagues.id, id));
    return rows[0] ? byId(rows[0]) : null;
  }

  async addMember(leagueId: string, member: Member): Promise<void> {
    await this.db.insert(schema.leagueMembers).values({
      leagueId, clientId: member.clientId, displayName: member.displayName,
    }).onConflictDoUpdate({
      target: [schema.leagueMembers.leagueId, schema.leagueMembers.clientId],
      set: { displayName: member.displayName },
    });
  }

  async listMembers(leagueId: string): Promise<Member[]> {
    const rows = await this.db.select().from(schema.leagueMembers)
      .where(eq(schema.leagueMembers.leagueId, leagueId));
    return rows.map((r) => ({ clientId: r.clientId, displayName: r.displayName, joinedAt: toMs(r.joinedAt) }));
  }

  async setStatus(id: string, status: LeagueStatus): Promise<void> {
    await this.db.update(schema.leagues).set({ status }).where(eq(schema.leagues.id, id));
  }

  async addFixtures(rows: NewFixture[]): Promise<FixtureRecord[]> {
    if (rows.length === 0) return [];
    const inserted = await this.db.insert(schema.fixtures).values(rows.map((r) => ({
      leagueId: r.leagueId, round: r.round, homeClientId: r.homeClientId, awayClientId: r.awayClientId,
    }))).returning();
    return inserted.map((r) => ({
      id: r.id, leagueId: r.leagueId, round: r.round,
      homeClientId: r.homeClientId, awayClientId: r.awayClientId,
      status: r.status as FixtureStatus, homeScore: r.homeScore, awayScore: r.awayScore,
    }));
  }

  async listFixtures(leagueId: string): Promise<FixtureRecord[]> {
    const rows = await this.db.select().from(schema.fixtures)
      .where(eq(schema.fixtures.leagueId, leagueId));
    return rows.map((r) => ({
      id: r.id, leagueId: r.leagueId, round: r.round,
      homeClientId: r.homeClientId, awayClientId: r.awayClientId,
      status: r.status as FixtureStatus, homeScore: r.homeScore, awayScore: r.awayScore,
    }));
  }

  async getFixture(id: string): Promise<FixtureRecord | null> {
    const rows = await this.db.select().from(schema.fixtures).where(eq(schema.fixtures.id, id));
    const r = rows[0];
    return r ? {
      id: r.id, leagueId: r.leagueId, round: r.round,
      homeClientId: r.homeClientId, awayClientId: r.awayClientId,
      status: r.status as FixtureStatus, homeScore: r.homeScore, awayScore: r.awayScore,
    } : null;
  }

  async setFixtureResult(id: string, status: FixtureStatus, homeScore: number | null, awayScore: number | null): Promise<void> {
    await this.db.update(schema.fixtures).set({ status, homeScore, awayScore })
      .where(eq(schema.fixtures.id, id));
  }

  async upsertSubmission(sub: SubmissionRecord): Promise<void> {
    await this.db.insert(schema.submissions).values({
      fixtureId: sub.fixtureId, clientId: sub.clientId,
      homeScore: sub.homeScore, awayScore: sub.awayScore, matchToken: sub.matchToken,
    }).onConflictDoUpdate({
      target: [schema.submissions.fixtureId, schema.submissions.clientId],
      set: { homeScore: sub.homeScore, awayScore: sub.awayScore, matchToken: sub.matchToken, submittedAt: new Date() },
    });
  }

  async listSubmissions(fixtureId: string): Promise<SubmissionRecord[]> {
    const rows = await this.db.select().from(schema.submissions)
      .where(eq(schema.submissions.fixtureId, fixtureId));
    return rows.map((r) => ({
      fixtureId: r.fixtureId, clientId: r.clientId,
      homeScore: r.homeScore, awayScore: r.awayScore,
      matchToken: r.matchToken, submittedAt: toMs(r.submittedAt),
    }));
  }

  async upsertPlayer(clientId: string, displayName: string): Promise<void> {
    await this.db.insert(schema.players).values({ clientId, displayName }).onConflictDoNothing();
  }
}

const MIGRATION_URL = new URL('../../drizzle/0001_leagues.sql', import.meta.url);

/** Boot-time migration: plain SQL, re-runnable (IF NOT EXISTS throughout). */
export async function runMigrations(sql: Sql): Promise<void> {
  const ddl = readFileSync(MIGRATION_URL, 'utf8');
  await sql.unsafe(ddl);
}

export function createPgLeagueStore(url: string): { store: PgLeagueStore; sql: Sql } {
  const sql = postgres(url, { max: 5 });
  return { store: new PgLeagueStore(drizzle(sql, { schema })), sql };
}
