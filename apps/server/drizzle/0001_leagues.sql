-- F4b: leagues, memberships, fixtures, dual-submit results.
-- Re-runnable: boot applies this on every start (IF NOT EXISTS throughout).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE league_status AS ENUM ('lobby', 'active', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE fixture_status AS ENUM ('pending', 'confirmed', 'disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS players (
  client_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status league_status NOT NULL DEFAULT 'lobby',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_members (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, client_id)
);

CREATE TABLE IF NOT EXISTS fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  home_client_id TEXT NOT NULL,
  away_client_id TEXT NOT NULL,
  status fixture_status NOT NULL DEFAULT 'pending',
  home_score INTEGER,
  away_score INTEGER
);
CREATE INDEX IF NOT EXISTS fixtures_league_idx ON fixtures (league_id);

CREATE TABLE IF NOT EXISTS submissions (
  fixture_id UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  match_token TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fixture_id, client_id)
);
