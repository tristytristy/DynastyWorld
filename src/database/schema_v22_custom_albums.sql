-- Schema version 22 — albums the user MAKES, and the cover each folder wears.
--
-- v21 gave the game-derived folders editable NAMES. This adds the two things
-- that turn a folder into an album proper: somewhere to put photographs that
-- belong to no game, and a say in which photograph the folder shows.
--
-- TWO KINDS OF FOLDER, AND THEY ARE GENUINELY DIFFERENT, which is why this is a
-- second table rather than a widening of media_albums:
--
--   • A GAME folder is DERIVED. It exists because the schedule says so, its
--     membership is whichever photos are tagged to that game, and it cannot be
--     created or deleted from the app. `media_albums` only overrides its name
--     (and now its cover) — delete that row and the folder is still there.
--   • A CUSTOM album is DECLARED. The user creates it, names it, fills it and
--     can throw it away; delete the row and the album is gone. Membership is
--     explicit, in media_items.album_id.
--
-- Collapsing those into one table would mean a row that sometimes owns its
-- folder's existence and sometimes doesn't, with a sentinel to tell you which —
-- which is the shape that produces "why is this album empty and unnameable".
--
-- A PHOTO IS FILED UNDER A GAME **OR** AN ALBUM, NEVER BOTH. The editor offers
-- them as alternatives, so setting one clears the other (enforced in the DAL,
-- which is the only writer). That keeps every photograph in exactly one place
-- on the shelf, which is what makes a folder view honest — a photo appearing in
-- two folders would be counted twice and reordered against itself.
--
-- album_id has NO foreign key, because SQLite cannot add one with ALTER TABLE
-- ADD COLUMN. Deleting an album nulls its members first (see customAlbums.ts);
-- and a stale id would resolve to no album and fall back to the unfiled pile
-- rather than crashing, so the failure mode is benign either way.
--
-- COVERS ARE A MEDIA ID, not a copied thumbnail: the cover has to follow the
-- photograph's own framing and treatment, and a photo that is later deleted
-- should leave the folder picking a cover again rather than pointing at a file
-- that has gone. Null means "use the first photo in the folder", which is what
-- every folder did before this existed.

ALTER TABLE media_albums ADD COLUMN cover_media_id INTEGER;

CREATE TABLE custom_albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  -- Albums live in a season, like the photos they hold and like the Media page
  -- itself. An album that spanned seasons would have to appear on a page that
  -- is scoped to one.
  season_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  cover_media_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- Deliberately NOT unique on (dynasty, season, name): two albums called "Best
-- of" is the user's business, and refusing the second one mid-typing is a worse
-- experience than letting them rename it.
CREATE INDEX idx_custom_albums_season ON custom_albums(dynasty_id, season_id);

ALTER TABLE media_items ADD COLUMN album_id INTEGER;

CREATE INDEX idx_media_items_album ON media_items(album_id);
