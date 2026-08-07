-- Where a legend-pool entry came from: the user, or the leaderboards.
--
-- The Hall's pool is now partly automatic — the top five in each statistical
-- category are added for you, and drop out again when someone overtakes them.
-- That is only safe if the two kinds of entry are told apart: a player YOU
-- inducted must never be evicted because his passing yards slipped to sixth.
--
-- 'manual' is the default, and existing rows take it, because every entry that
-- exists before this migration was added by hand. An auto entry that the user
-- then acts on — assigning it to a formation slot, or adding it deliberately —
-- is promoted to 'manual' and stops being managed. Endorsement is permanent;
-- the automation only ever owns what nobody has touched.
ALTER TABLE coach_legends ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- The reconcile pass reads "every auto entry for this coach" on each run.
CREATE INDEX idx_coach_legends_source ON coach_legends(dynasty_id, coach_id, source);
