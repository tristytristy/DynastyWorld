-- Neutral observer ("commissioner") mode, per dynasty. CFB 27 has no true
-- neutral player, so commissioner-style dynasties park a throwaway user coach
-- at some school purely to sim the league. The archive keeps that anchor (it
-- identifies the dynasty and drives sync semantics) — this flag only tells the
-- fake internet to stop treating the anchor team as "the user's team": no
-- hometown fan bias in the Feed, no featured-game weight on the Board, no
-- local segment in the podcast. Coverage reads like ESPN, not a team blog.
ALTER TABLE dynasties ADD COLUMN neutral_mode INTEGER NOT NULL DEFAULT 0;
