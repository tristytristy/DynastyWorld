-- Schema version 10. Applied via migrations.ts as migration #10 (append-only —
-- never edit earlier schema files after they've shipped).
--
-- Manual media ordering: users can drag photos into any order (uploads can
-- arrive out of order). `sort_order` is the display order within a
-- (dynasty, season) — lower shows first. Backfilled to preserve the existing
-- newest-first order (newest = 0), so nothing visibly reshuffles on upgrade.

ALTER TABLE media_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Newest-first backfill: sort_order = how many items in the same season are
-- newer than this one (newest → 0, next → 1, …), matching the old ORDER BY.
UPDATE media_items
SET sort_order = (
  SELECT COUNT(*)
  FROM media_items m2
  WHERE m2.dynasty_id = media_items.dynasty_id
    AND m2.season_id = media_items.season_id
    AND (
      m2.created_at > media_items.created_at
      OR (m2.created_at = media_items.created_at AND m2.id > media_items.id)
    )
);

CREATE INDEX IF NOT EXISTS idx_media_items_order ON media_items(dynasty_id, season_id, sort_order);
