-- DynastyTube presentation metadata (user request, 2026-09-07): a video's
-- TITLE is what the feed shows (YouTube-style, distinct from the description,
-- which becomes the watch page's info box), and thumb_time pins the chosen
-- thumbnail as a timestamp into the clip — no image files to store or carry
-- between machines, the grid just seeks the video there. Empty title falls
-- back to the description; null thumb_time falls back to the first moments.
ALTER TABLE media_items ADD COLUMN tube_title TEXT NOT NULL DEFAULT '';
ALTER TABLE media_items ADD COLUMN thumb_time REAL;
