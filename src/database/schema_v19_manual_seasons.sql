-- Schema version 19. Applied via migrations.ts as migration #19 (append-only —
-- never edit a shipped migration).
--
-- SEASONS THE USER TYPED IN THEMSELVES, from their own notes or spreadsheet.
--
-- Someone who finds DynastyOS in year 14 has thirteen years the save cannot
-- give back: the game keeps career TOTALS (CareerCoachStats) and completed-year
-- league facts (YearSummary), but no per-season record for the user's own
-- program. This table is the only place in the app where a number comes from a
-- human rather than from the save, which is exactly why it is a separate table
-- rather than a flag on `seasons`:
--
--   * Nothing that computes a statistic can reach it by accident. Every
--     aggregate in getHistory, every leaderboard, the record book and the
--     national tables all read `seasons` + snapshots and will never see these
--     rows unless a caller explicitly asks for them.
--   * Provenance cannot be lost. There is no path by which one of these rows
--     becomes indistinguishable from extracted data — it lives in a different
--     table with a different shape.
--
-- NULLABLE ON PURPOSE. Every value column allows NULL because "I don't remember
-- my conference record in 2031" must stay unknown rather than becoming 0-0.
-- Blank in, blank out — the same rule history-only seasons already follow.
--
-- One row per (dynasty, year): a dynasty cannot have two 2031s, and re-editing
-- a year replaces it rather than accumulating.

CREATE TABLE manual_seasons (
  dynasty_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  -- Display name as chosen from the app's own team list, so it always matches a
  -- real program (and therefore resolves logos/colours like any other season).
  team_name TEXT,
  wins INTEGER,
  losses INTEGER,
  conference_wins INTEGER,
  conference_losses INTEGER,
  -- Free text, deliberately: bowl naming is where handwritten notes are least
  -- consistent, and forcing a taxonomy would lose what the user actually wrote.
  bowl_name TEXT,
  -- 'W' | 'L' | NULL
  bowl_result TEXT,
  conference_champion INTEGER NOT NULL DEFAULT 0,
  national_champion INTEGER NOT NULL DEFAULT 0,
  playoff_appearance INTEGER NOT NULL DEFAULT 0,
  final_rank INTEGER,
  head_coach_name TEXT,
  note TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (dynasty_id, season_year),
  FOREIGN KEY (dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);

CREATE INDEX idx_manual_seasons_dynasty ON manual_seasons(dynasty_id);

-- Whether this dynasty has already been offered the backfill. Per DYNASTY, not
-- per app: someone with three dynasties has three different gaps, and being
-- asked once about one of them says nothing about the others. Dismissing is
-- permanent — the editor stays reachable from Program -> History and the
-- command palette, which the prompt itself says.
ALTER TABLE dynasties ADD COLUMN history_prompt_seen INTEGER NOT NULL DEFAULT 0;
