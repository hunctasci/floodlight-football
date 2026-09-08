-- Bot matches share country standings but have a distinct, auditable origin.
CREATE TABLE IF NOT EXISTS bot_matches (
  match_id TEXT PRIMARY KEY REFERENCES matches(id),
  seed INTEGER NOT NULL,
  half_duration INTEGER NOT NULL,
  difficulty INTEGER NOT NULL,
  opponent_name TEXT NOT NULL
);
