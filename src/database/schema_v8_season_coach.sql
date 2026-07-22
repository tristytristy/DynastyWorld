-- Schema version 8. Applied via migrations.ts as migration #8 (append-only --
-- never edit earlier schema files after they've shipped).
--
-- Coach-journey foundation. Alongside seasons.user_team_id (v3, which team the
-- user coached that season), record WHICH COACH ENTITY the user was that season
-- via the coach's stable Coach.PresentationId. This is the identity anchor that
-- lets the app recognize the same coaching career across school moves and across
-- separate imported saves (a coach's name can be edited; the portrait fields
-- change with the face; PresentationId does not). See
-- docs/coach-movement-research.md. NULL for history-only seasons (no coaches
-- snapshot) and for the rare coach with no real id (generated coordinators
-- carry 0, which we store as NULL — not a usable identity).

ALTER TABLE seasons ADD COLUMN user_coach_id INTEGER;
