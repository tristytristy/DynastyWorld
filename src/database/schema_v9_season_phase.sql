-- Schema version 9. Applied via migrations.ts as migration #9 (append-only --
-- never edit earlier schema files after they've shipped).
--
-- Phase-aware sync. The dynasty save is one mutable snapshot; different data is
-- final at different calendar points, so a mistimed sync used to overwrite a
-- finished season with churned data. Record the calendar phase a season was last
-- written at (from SeasonInfo.CurrentWeekType + CurrentOffseasonStage — see
-- shared/syncPhase.ts and memory reference-sync-phase-map), and a `finalized`
-- flag set once a season is captured at the End of Season Recap (OffSeason stage
-- 1). Once finalized, persistExtraction refuses to overwrite the season's
-- snapshots from a later, dirtier offseason sync (stage 3+ scatters rosters to
-- the pool and thins awards). Defaults keep every existing season un-finalized
-- with no recorded phase, so a normal re-sync behaves exactly as before.

ALTER TABLE seasons ADD COLUMN synced_week_type TEXT;
ALTER TABLE seasons ADD COLUMN synced_offseason_stage INTEGER;
ALTER TABLE seasons ADD COLUMN finalized INTEGER NOT NULL DEFAULT 0;
