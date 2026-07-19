-- Schema version 2. Applied via migrations.ts as migration #2 (append-only —
-- never edit schema.sql/migration #1 after it's shipped).
--
-- Phase 7 (Rankings & Visualizations): the save file itself only ever stores
-- 3 poll data points per team (StartOfSeasonRank, LastWeeksRank, CurrentRank)
-- — confirmed by direct field inspection, no per-week history array exists
-- anywhere in the save. A real week-by-week trend can only be built by this
-- app accumulating one snapshot per import as the user's season progresses,
-- which is what this table is for. UNIQUE(season_id, week) plus an upsert on
-- write means re-importing the same week corrects that week's numbers rather
-- than duplicating a row, while advancing to a new week adds a new one.

CREATE TABLE ranking_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week INTEGER NOT NULL,
  media_poll_rank INTEGER,
  coaches_poll_rank INTEGER,
  cfp_rank INTEGER,
  wins INTEGER,
  losses INTEGER,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(season_id, week)
);

CREATE INDEX idx_ranking_history_season_week ON ranking_history(season_id, week);
