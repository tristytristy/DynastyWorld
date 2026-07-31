-- Schema version 15 — a program's own identity and artwork.
--
-- WHY THIS EXISTS. Players import teams from Teambuilder, and the game writes
-- them straight over an existing school's slot. Verified byte-level against
-- DYNASTY-EPUY01WK0START (2026-07-30): "East Point" sits at TeamIndex 39 —
-- exactly where Kent State was — with every identifying field replaced
-- (TEAM_ORIGID 1148 -> 1803, TEAM_LOGO 48 -> 602, AssetName KENTXX ->
-- CrcEPmcoLi, a random 10-character token). Kent State is gone from the
-- 143-team table entirely. That one save carries TEN such teams.
--
-- The app resolves every piece of team art — 3D logo, helmet, jersey, coach
-- polo — from the team's NAME through a shipped asset library. An invented
-- school has no entry, so it renders the fallback logo, the generic helmet, and
-- no jersey or polo at all, on every surface: schedule, box score, standings,
-- roster portraits, trading cards. There is nothing in the save to fix that
-- with; the art simply doesn't exist. So the user supplies it.
--
-- KEYED BY team_index, NOT BY NAME, and that is a correctness requirement
-- rather than a preference. The same EPUY01 save contains a custom "Montana"
-- and a custom "Hawaii" — both real schools the shipped library already has art
-- for. A name-keyed override would rewrite the REAL Montana and Hawaii in every
-- other dynasty the user opens. team_index is the save's own stable slot (0-142,
-- unchanged by the import), and the row is scoped to one dynasty on top of that,
-- so two saves can disagree about slot 39 without either being wrong.
--
-- team_name_key is stored ALONGSIDE the index, not instead of it: the renderer
-- resolves art from whatever display name a component happens to hold, and
-- within a single dynasty that name maps to exactly one slot. The index stays
-- the identity; the name is the lookup.
--
-- The art files themselves live under <userData>/program-art/<dynasty_id>/ and
-- are owned by the IPC layer, exactly like card photos and media — the columns
-- hold BASENAMES only, so the folder can move without a row going stale. Null
-- everywhere means "use the shipped default", which is what every team that has
-- never been through the editor does.

CREATE TABLE program_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  -- The save's own team slot. Stable across a Teambuilder import.
  team_index INTEGER NOT NULL,
  -- canonicalKey() of the team's display name at the time of editing — how the
  -- renderer finds this row from a component that only knows a name.
  team_name_key TEXT NOT NULL,

  -- Identity. Null = the built-in stadium reference data stands.
  stadium_name TEXT,
  stadium_city TEXT,

  -- Artwork basenames within program-art/<dynasty_id>/. One file per slot: the
  -- logo serves both the on-light and on-dark variants (and is tinted for the
  -- gold one), and the helmet is mirrored for the opposite side, so four
  -- uploads dress a team completely.
  logo_file TEXT,
  helmet_file TEXT,
  jersey_file TEXT,
  polo_file TEXT,

  updated_at TEXT NOT NULL,

  UNIQUE(dynasty_id, team_index),
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- The renderer's read: every override in the dynasty, resolved once and held in
-- a map. There is normally one row (the user's own program), so this is a
-- correctness index rather than a performance one.
CREATE INDEX idx_program_overrides_dynasty ON program_overrides(dynasty_id);
