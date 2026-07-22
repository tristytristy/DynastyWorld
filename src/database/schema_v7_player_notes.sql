-- Schema version 7. Applied via migrations.ts as migration #7 (append-only --
-- never edit earlier schema files after they've shipped).
--
-- Player notes: freeform user notes scoped to a single player within a dynasty.
-- Like media_items (v6) and team_award_results (v5), this is user-entered data
-- kept OUT of season_snapshots so a re-sync never touches it.
--
-- Scoped by (dynasty_id, player_id) -- NOT by season -- because a note is about
-- the player, not one season's snapshot; it shows on that player's profile in
-- whichever season the user is viewing. player_id is the same opaque roster /
-- player id (PresentationId) used app-wide, unenforced (players live in
-- snapshots, not a relational table), matching how media player tags work.

CREATE TABLE player_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_notes_player ON player_notes(dynasty_id, player_id);
