-- Schema version 17 — the Hall of Legends.
--
-- A coach-owned, dynasty-scoped record of the players a coach chose to keep.
-- It follows the COACH, not the school: a player enshrined at Texas State is
-- still in the Hall after the move to Auburn, and the row never mentions which
-- team is currently controlled.
--
-- IDENTITY IS ALREADY SOLVED, which is why this table is small. `seasons`
-- carries both halves of it: `user_team_id` (v3, which team the user coached
-- that season) and `user_coach_id` (v8, WHICH COACH they were, stored as
-- Coach.PresentationId precisely because a name can be edited and a portrait
-- changes but that id does not). Eligibility is therefore a query over data
-- that already exists — "did this player appear in the roster snapshot of a
-- season this coach coached" — and needs no new extraction at all.
--
-- ONE ROW PER (dynasty, coach, player), AND THE ILLEGAL STATES BECOME
-- UNREPRESENTABLE. The obvious model gives an entry a `firstTeamSlot` and a
-- `secondTeamSlot` and then forbids, in prose, the state where both are set.
-- Holding the tier and the slot as two columns on ONE row means a player simply
-- cannot be in two places: there is one slot to be in. "A player may occupy only
-- one Hall slot total" stops being a rule anyone has to remember to enforce.
--
-- NULL tier and slot = in the pool, unassigned. That is also what makes the
-- second unique index work: SQLite treats NULLs as distinct, so any number of
-- unassigned legends coexist while two players can never hold the same slot.
--
-- THE SNAPSHOT IS THE POINT OF THE WHOLE TABLE. A save prunes: past-season
-- rosters go, departed players are deleted from the Player table outright. A
-- Hall that resolved its entries against live data would quietly empty itself
-- over the years the feature exists to outlast. So each row stores the player as
-- they were — name, position, number, school, peak overall, portrait — and
-- renders from that when the source is gone. Same contract as a trading card,
-- which freezes its player for the same reason.

CREATE TABLE coach_legends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  -- Coach.PresentationId, matching seasons.user_coach_id.
  coach_id INTEGER NOT NULL,
  -- Player.PresentationId, the same id the roster, editor and cards all use.
  player_id INTEGER NOT NULL,

  added_at TEXT NOT NULL,
  -- Where they were when they were added, kept even after the coach moves on.
  added_from_season_id INTEGER,
  added_from_team_index INTEGER,

  -- 'first' | 'second' | NULL. NULL means pool-only.
  tier TEXT,
  -- A LegendFormationSlot id (see shared/hallFormation.ts). NULL means unassigned.
  slot_id TEXT,
  assigned_at TEXT,

  -- Reserved for the induction note the spec anticipates; unused in v1 and
  -- present so adding it later isn't a migration.
  induction_note TEXT,

  -- LegendPlayerSnapshot as JSON — see the note above.
  snapshot_json TEXT NOT NULL,

  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

-- One entry per player per coach: adding twice updates rather than duplicates.
CREATE UNIQUE INDEX idx_coach_legends_entry ON coach_legends(dynasty_id, coach_id, player_id);

-- One occupant per slot per tier. Unassigned rows carry NULLs and are exempt,
-- which is exactly the behaviour wanted.
CREATE UNIQUE INDEX idx_coach_legends_slot ON coach_legends(dynasty_id, coach_id, tier, slot_id);

CREATE INDEX idx_coach_legends_coach ON coach_legends(dynasty_id, coach_id);
