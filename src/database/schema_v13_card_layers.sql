-- Schema version 13 — a card remembers what it shows, and where its numbers
-- came from.
--
-- Two things were previously decided somewhere other than the card and so could
-- not survive being looked at again:
--
-- LAYERS. Turning the OVR, the name, the profile line, the stat row or the team
-- logo off was a property of the EXPORT DIALOG — a set of checkboxes that reset
-- to all-on every time it opened. So a card designed as a clean photo-and-name
-- piece looked like that once, in a PNG, and never again: the card book, the
-- hover preview and the card's own tab all redrew it with every layer back on.
-- Layers belong to the card, and now live on it. Default '{}' merges over
-- ALL_CARD_LAYERS, so every card that existed before this migration keeps
-- drawing exactly as it did.
--
-- STAT SOURCE. `stats_json` freezes the numbers but not their provenance, which
-- is fine to draw and useless to edit: reopening a card could tell you it says
-- "214 REC YDS" but not whether that was a season total or one Saturday against
-- Georgia. Storing the source is what lets the editor reopen on the right list,
-- and what lets a card celebrate a single GAME rather than only a season —
-- {"key":"game:8123","kind":"game","label":"Wk 5 · vs Georgia"}. Null means a
-- card made before this existed, i.e. a season line by construction.
--
-- Both are additive columns on v12's table; nothing is rewritten.

ALTER TABLE player_cards ADD COLUMN layers_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE player_cards ADD COLUMN stat_source_json TEXT;
