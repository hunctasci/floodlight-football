import { integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const leagueStatus = pgEnum('league_status', ['lobby', 'active', 'done']);
export const fixtureStatus = pgEnum('fixture_status', ['pending', 'confirmed', 'disputed']);

/** Guest identities, created lazily on first league touch (ADR-004). */
export const players = pgTable('players', {
  clientId: text('client_id').primaryKey(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leagues = pgTable('leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  status: leagueStatus('status').notNull().default('lobby'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leagueMembers = pgTable('league_members', {
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  displayName: text('display_name').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.leagueId, t.clientId] })]);

export const fixtures = pgTable('fixtures', {
  id: uuid('id').primaryKey().defaultRandom(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  homeClientId: text('home_client_id').notNull(),
  awayClientId: text('away_client_id').notNull(),
  status: fixtureStatus('status').notNull().default('pending'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
});

/**
 * One row per (fixture, submitter). Latest row wins per side; the fixture
 * confirms only when both sides' latest rows agree (ADR-004 dual-submit).
 */
export const submissions = pgTable('submissions', {
  fixtureId: uuid('fixture_id').notNull().references(() => fixtures.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  matchToken: text('match_token').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.fixtureId, t.clientId] })]);
