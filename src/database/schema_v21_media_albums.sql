-- Schema version 21 — the names a user gives their media folders.
--
-- WHY THIS EXISTS. The Media page groups a season's photographs into one folder
-- per game, and names each folder from the game itself — "Wk 3 @ Purdue W 48-3".
-- That is a good default and a bad ceiling: an album is a thing you curate, and
-- the shot you kept from that afternoon may be "Senior Day", "The comeback", or
-- the name of the player it is all about. So the label is editable, and this is
-- where the edit lives.
--
-- A NAME ONLY, NEVER MEMBERSHIP. Which photographs are in a folder is still
-- decided entirely by the game each one is tagged to (media_items.game_id) —
-- this table cannot move a photo, hide one, or create a folder that has no
-- game behind it. That keeps one source of truth for grouping and makes this
-- row safe to delete at any time: the folder reverts to the game's own name and
-- nothing else changes.
--
-- KEYED BY SEASON AS WELL AS GAME. Game ids are only unique within a save's own
-- schedule, and the Media page is per-season, so the season is part of the
-- identity rather than something to look up through the game.
--
-- game_key IS AN INTEGER WITH A SENTINEL, not a nullable game_id, and that is
-- the one non-obvious decision here. The "Not from a game" pile is a real
-- folder that a user will want to name ("Offseason", "Recruiting"), so it needs
-- a row — but SQLite treats NULLs as DISTINCT inside a UNIQUE constraint, so a
-- nullable column would happily accept twenty rows for it and the last write
-- would stop winning. UNFILED_ALBUM_KEY (-1) is a value the constraint can
-- actually see. Real game ids are non-negative, so there is nothing to collide
-- with.
--
-- User-authored, like manual_seasons and custom_rivals: a re-sync must never
-- disturb a name somebody chose.

CREATE TABLE media_albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,

  -- The game this folder collects, or -1 for the "not from a game" pile.
  game_key INTEGER NOT NULL,

  -- What the user calls it. A row is DELETED rather than blanked when the name
  -- is cleared, so "no row" and "named the same as the game" never diverge.
  name TEXT NOT NULL,

  updated_at TEXT NOT NULL,

  UNIQUE(dynasty_id, season_id, game_key),
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- The renderer reads every album for one season in a single query when the
-- Media page opens.
CREATE INDEX idx_media_albums_season ON media_albums(dynasty_id, season_id);
