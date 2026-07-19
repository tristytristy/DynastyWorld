-- Schema version 3. Applied via migrations.ts as migration #3 (append-only —
-- never edit schema.sql/schema_v2_ranking_history.sql after they're shipped).
--
-- Dynasties are not permanently tied to one team: the human-controlled coach
-- can be fired/hired and change schools within one continuous save file
-- (confirmed directly by the user, not assumed). dynasties.team_id was being
-- treated as a fixed-forever value, set once at first import and never
-- revised — every query resolved "the user's team" against it, so a real
-- coaching change would have silently kept resolving every future season to
-- the old team. This column lets each season record which team was actually
-- the user's team for that specific season, independently derived by the
-- extractor on every import (extract-coaches.ts's findUserTeamIndex) rather
-- than inherited from whatever the dynasty's stale cached value says.

ALTER TABLE seasons ADD COLUMN user_team_id INTEGER;
