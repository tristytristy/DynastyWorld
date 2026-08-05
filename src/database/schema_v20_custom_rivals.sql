-- Schema version 20 — rivalries the user declares, on top of the ones EA ships.
--
-- WHY THIS EXISTS. The save carries exactly three rival slots per team
-- (Rival1/2/3TeamRef — see extractors/extract-rivalries.ts) and a fixed list of
-- named matchups, and neither is editable from inside the game. A dynasty that
-- has been running for a decade grows rivalries the save has no room for: the
-- team you meet in the conference title game four years running, the program
-- that keeps taking your recruits, the school a Teambuilder import invented
-- that has no rivalry history at all because it did not exist last season.
--
-- NOTHING HERE IS EVER WRITTEN TO THE SAVE. This is app-facing decoration, and
-- deliberately so: the save's rival slots drive in-game logic (scheduling,
-- prestige, commentary) that this app has no business steering, and a write we
-- got wrong would be baked into a file the user cannot easily repair. The
-- editor says as much on its face. EA's own rivals are shown READ-ONLY next to
-- these for the same reason — they are the save's, not ours to edit.
--
-- KEYED BY THE PAIR, NOT BY THE OWNER, which is the one non-obvious decision
-- here. A rivalry is symmetric: if the user declares UCLA vs Oregon, then
-- Oregon vs UCLA is the same rivalry and must draw the same logo on the
-- schedule, in the box score, and on either program's Rivalries page. The
-- existing shipped-art lookup already works this way (lib/rivalryAssetMapping
-- sorts the two team keys into one `pairKey`), so storing the same key here
-- means custom rivalries slot into the resolver the rest of the app already
-- uses rather than needing a second path beside it.
--
-- `pair_key` is therefore the identity and carries the UNIQUE constraint: one
-- rivalry per matchup per dynasty, so declaring the same pair twice edits it
-- instead of quietly creating a duplicate with a different name.
--
-- team_index / opponent_team_index are stored ALONGSIDE the keys, for the same
-- reason program_overrides stores both: the save's slot is the stable identity
-- across a Teambuilder rename, while the name key is how a component that only
-- holds a display name finds the row.
--
-- The logo files live under <userData>/rivalry-art/<dynasty_id>/ and are owned
-- by the IPC layer, exactly like program art, card photos and media. The column
-- holds a BASENAME only. Null means the rivalry still draws the generic shield,
-- which is a complete and reasonable end state — naming a rivalry is the
-- feature, supplying art for it is optional.

CREATE TABLE custom_rivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,

  -- The program the rivalry was declared FROM. Only used to order the editor's
  -- list and to attribute the row; it is not the identity, because the rivalry
  -- belongs to both teams equally.
  team_index INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  team_name_key TEXT NOT NULL,

  opponent_team_index INTEGER NOT NULL,
  opponent_name TEXT NOT NULL,
  opponent_name_key TEXT NOT NULL,

  -- The two normalised team keys, sorted and joined — see
  -- lib/rivalryAssetMapping.rivalryPairKey, which is the single implementation
  -- both this table and the shipped-art lookup are built on.
  pair_key TEXT NOT NULL,

  -- What the user calls it. Required: an unnamed custom rivalry would be
  -- indistinguishable from one of the save's own unnamed rival slots.
  rivalry_name TEXT NOT NULL,

  -- Basename within rivalry-art/<dynasty_id>/. Null = the generic shield.
  logo_file TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(dynasty_id, pair_key),
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- The renderer's read: every custom rivalry in the dynasty, loaded once into a
-- pair-keyed registry the art resolver sits behind.
CREATE INDEX idx_custom_rivals_dynasty ON custom_rivals(dynasty_id);
