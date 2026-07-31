-- Schema version 12 — saved player trading cards.
--
-- Until now a card had no row anywhere. Its three pieces of state lived in three
-- different places and none of them could answer "which cards does this dynasty
-- have?": the photo was a file at card-photos/<dynastyId>/<playerId>.<ext>, the
-- pan/zoom framing was a localStorage key, and the chosen stat labels were
-- another. That is enough to redraw ONE card while you're looking at the player,
-- and not enough for anything else — you can't star a card, keep two of a
-- player, or list every card in the dynasty.
--
-- So a card is a row now. Like player_notes (v7) and media_items (v6), this is
-- user-authored data kept OUT of season_snapshots: a re-sync must never touch a
-- card the user made.
--
-- WHY THE DISPLAY DATA IS FROZEN ON THE ROW (player_json / stats_json /
-- season_year / team_name). A card is a printed moment. The book shows a 2026
-- freshman card years after that player graduated and left the roster — there is
-- no live RosterPlayer to re-render it from, and re-deriving one from an old
-- snapshot would give the player as they ENDED that season, not as the card was
-- made. Freezing costs ~400 bytes a card and makes the book possible at all.
-- The player-modal card still renders live and rewrites these on every edit, so
-- a card kept up to date stays up to date.
--
-- photo_file is a BASENAME inside card-photos/<dynastyId>/, not a full path, so
-- the folder can move (or arrive from another machine via a dynasty backup)
-- without every row going stale. It is deliberately whatever the file is
-- actually called: cards created before this migration adopt the legacy
-- "<playerId>.<ext>" file where it sits, rather than being renamed underneath
-- the user.

CREATE TABLE player_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  -- The same opaque roster/player id (PresentationId) used app-wide. Unenforced,
  -- like player_notes: players live in snapshots, not a relational table.
  player_id INTEGER NOT NULL,

  -- The season the card portrays. The book pages by this, so it is what makes a
  -- card belong to a year; null only for a card made with no season in scope.
  season_year INTEGER,
  -- Team ASSET name (the same string TeamLogo/PlayerPortrait resolve against),
  -- so a card of a player who later transferred keeps the school he played for.
  team_name TEXT,

  -- Frozen RosterPlayer subset — enough for PlayerCard to render with no roster
  -- lookup. See the note above.
  player_json TEXT NOT NULL,
  -- Frozen [{label, value}] marquee line, in the user's chosen order.
  stats_json TEXT NOT NULL DEFAULT '[]',

  -- Custom photo: basename within card-photos/<dynasty_id>/, plus its framing.
  -- Null photo_file = no custom photo, i.e. the card shows the portrait+jersey.
  photo_file TEXT,
  photo_x REAL NOT NULL DEFAULT 0,
  photo_y REAL NOT NULL DEFAULT 0,
  photo_scale REAL NOT NULL DEFAULT 1,

  -- Starred. The card book is exactly the set of favourited cards.
  favorite INTEGER NOT NULL DEFAULT 0,
  -- Which of this player's cards is THE card: what the hover preview pops and
  -- what any single-card surface shows. Exactly one per (dynasty, player) is
  -- kept true by the DAL rather than by a constraint, because the invariant is
  -- "promote a new one AND demote the old one", which is one transaction either
  -- way -- and a partial unique index would only turn a mistake into a crash.
  is_default INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- The player-modal read: every card for one player.
CREATE INDEX idx_player_cards_player ON player_cards(dynasty_id, player_id);
-- The book's read: every starred card in the dynasty, oldest season first.
CREATE INDEX idx_player_cards_favorite ON player_cards(dynasty_id, favorite, season_year);
