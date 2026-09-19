-- Media items can name the exact plays a clip shows (schema v25).
-- Stored as self-contained JSON descriptors (quarter, clock, team, play
-- type, score-after) rather than references: the scoring snapshot is
-- append-only but this survives even if a season's snapshot is rewritten.
ALTER TABLE media_items ADD COLUMN plays_json TEXT NOT NULL DEFAULT '[]';
