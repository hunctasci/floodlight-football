-- Floodlight Football — City League MVP (D1)
-- Three tables only: players, matches, submissions.
-- Cities are static app config (see src/city-league/cities.ts).
-- Seasons are derived from season_key (Monday 00:00 Europe/Istanbul).

CREATE TABLE IF NOT EXISTS players (
    client_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    city_code TEXT NOT NULL,
    city_season_key TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,

    season_key TEXT NOT NULL,

    home_client_id TEXT NOT NULL,
    away_client_id TEXT NOT NULL,

    home_city_code TEXT NOT NULL,
    away_city_code TEXT NOT NULL,

    match_token_hash TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN (
            'pending',
            'confirmed',
            'disputed',
            'abandoned'
        )),

    home_score INTEGER,
    away_score INTEGER,

    started_at INTEGER NOT NULL,
    confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS submissions (
    match_id TEXT NOT NULL,
    client_id TEXT NOT NULL,

    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,

    submitted_at INTEGER NOT NULL,

    PRIMARY KEY (match_id, client_id),

    FOREIGN KEY (match_id)
        REFERENCES matches(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matches_season_status
ON matches(season_key, status);

CREATE INDEX IF NOT EXISTS idx_matches_home_player
ON matches(home_client_id);

CREATE INDEX IF NOT EXISTS idx_matches_away_player
ON matches(away_client_id);
