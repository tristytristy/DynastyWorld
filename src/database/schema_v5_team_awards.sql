-- Schema version 5. Applied via migrations.ts as migration #5 (append-only —
-- never edit schema.sql/schema_v2/v3/v4 after they're shipped).
--
-- Team Awards is the first feature in this app that persists user-entered
-- data (confirmed/overridden award winners), not just save-derived snapshots.
-- Deliberately kept OUT of season_snapshots: that table is fully overwritten
-- per (season_id, name) by saveSnapshot() on every re-import (see
-- importExtraction.ts) — a confirmed award winner living there would be
-- silently wiped on the next sync. These tables are never touched by
-- persistExtraction, which is what structurally guarantees a confirmed
-- winner survives a re-sync, not just convention.
--
-- No FK to a `players` table — schema.sql's relational `players`/
-- `player_seasons` tables are never written to anywhere in this app (every
-- real query joins RosterPlayer/PlayerStats snapshots by opaque player id
-- client-side instead). recommended_winner_id/selected_winner_id store that
-- same opaque id, unenforced, matching how every other part of this app
-- already treats player ids.

CREATE TABLE team_award_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dynasty_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  award_definition_id TEXT NOT NULL,
  recommended_winner_id INTEGER,
  selected_winner_id INTEGER,
  finalist_ids_json TEXT NOT NULL DEFAULT '[]',
  candidate_scores_json TEXT NOT NULL DEFAULT '[]',
  explanation_json TEXT,
  missing_inputs_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'notCalculated',
  selection_mode TEXT NOT NULL DEFAULT 'recommended',
  calculation_version TEXT NOT NULL DEFAULT '',
  calculated_at TEXT,
  confirmed_at TEXT,
  finalized_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  FOREIGN KEY(season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  UNIQUE(dynasty_id, season_id, award_definition_id)
);

CREATE INDEX idx_team_award_results_season ON team_award_results(season_id);
CREATE INDEX idx_team_award_results_dynasty_award ON team_award_results(dynasty_id, award_definition_id);

-- One row per dynasty (not per season) — the eligibility/timing toggles read
-- as coaching-philosophy preferences that carry across the whole dynasty,
-- not something that changes year to year (confirmed with the user before
-- building this).
CREATE TABLE team_award_settings (
  dynasty_id TEXT PRIMARY KEY,
  freshman_eligibility TEXT NOT NULL DEFAULT 'trueOnly',
  newcomer_eligibility TEXT NOT NULL DEFAULT 'transfersOnly',
  calculation_timing TEXT NOT NULL DEFAULT 'postseasonOnly',
  auto_recalculate INTEGER NOT NULL DEFAULT 1,
  disabled_award_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);
