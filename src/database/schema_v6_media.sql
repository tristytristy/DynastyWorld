-- Schema version 6. Applied via migrations.ts as migration #6 (append-only —
-- never edit earlier schema files after they've shipped).
--
-- Media gallery: user-uploaded images/videos, organized per season, with
-- optional links to a game and to tagged players. Like team_award_results
-- (v5), this is user-entered data — deliberately kept OUT of season_snapshots
-- so a re-sync never touches it. The actual files live on disk under
-- <userData>/media/<dynasty_id>/ (DB stores only the file name); the
-- media IPC layer owns copy-in/unlink, the DB owns the metadata.
--
-- game_id stores the save-native SeasonGame gameId (same id ScheduleGame and
-- the /schedule/:gameId route use), unenforced — games live in per-season
-- snapshots, not a relational table, matching how player ids are handled
-- app-wide. player_ids_json stores tagged players as an array of the same
-- opaque roster player ids; names resolve from that season's roster snapshot
-- at read time, so tags stay correct even after a player leaves.

CREATE TABLE media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  game_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  player_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_media_items_dynasty_season ON media_items(dynasty_id, season_id);
