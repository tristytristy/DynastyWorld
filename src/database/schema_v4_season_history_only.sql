-- Schema version 4. Applied via migrations.ts as migration #4 (append-only —
-- never edit schema.sql/schema_v2_ranking_history.sql/schema_v3_season_team.sql
-- after they're shipped).
--
-- Importing a save that's already several years into a dynasty only ever
-- captured the current season — the app has no way to see backward from a
-- single snapshot. Real league-wide history (national/conference champions,
-- season awards) for years never individually synced is now backfilled from
-- the save's own year-by-year history table (see extract-league-history.ts)
-- as lightweight "history-only" season rows: no roster/schedule/stats/teams
-- snapshot (genuinely unrecoverable), just a 'yearSummary' snapshot. This
-- column distinguishes those from real, fully-synced seasons everywhere a
-- season is displayed. Every existing row defaults to 1 — they're all real
-- synced seasons today.

ALTER TABLE seasons ADD COLUMN has_full_data INTEGER NOT NULL DEFAULT 1;
