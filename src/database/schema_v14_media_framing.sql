-- Schema version 14 — a saved framing for a media photo.
--
-- The viewer already lets you zoom and drag a photo; this makes that framing
-- stick.
-- Users kept asking to "save the photo as its new zoomed look" — they crop out
-- HUD clutter, or push in on the one player who matters, and want the photo to
-- read that way from then on rather than re-doing it on every open.
--
-- NOTHING IS DONE TO THE FILE. This is three numbers next to the row; the image
-- on disk is never re-encoded, re-cropped or rewritten, and clearing the framing
-- returns the whole original frame. That is the point of storing it here rather
-- than "saving a cropped copy": the original is the master, permanently, and
-- every surface that wants a different crop of the same photo can have one.
--
-- WHICH IS EXACTLY WHY A CARD IS UNAFFECTED. Pulling a media photo onto a
-- trading card COPIES the file into card-photos/<dynasty>/ and stores that
-- card's own pan/zoom on the card row (schema v12). So the same shot can sit
-- framed one way in the gallery and another way on a card, and neither can
-- disturb the other — they were already independent, and keeping the framing as
-- metadata is what keeps them that way.
--
-- frame_x / frame_y are FRACTIONS of the photo's own displayed size, not pixels.
-- Pixels would be wrong the moment the same framing is drawn at another size —
-- and it is, constantly: a full-screen viewer, a grid thumbnail, a laptop and a
-- 4K monitor. As fractions the value means the same thing everywhere, and the
-- pan limit falls out as a pure number: at scale s the photo overhangs its box
-- by (s-1)/2 each way, so the offsets are bounded to exactly that with nothing
-- to measure.
--
-- A NULL frame_scale means "no saved framing" — show the whole photo, which is
-- what every existing row does and keeps doing.

ALTER TABLE media_items ADD COLUMN frame_x REAL;
ALTER TABLE media_items ADD COLUMN frame_y REAL;
ALTER TABLE media_items ADD COLUMN frame_scale REAL;
