-- Board inbox (user request, 2026-09-19): replies to the human member's
-- posts surface in an inbox on TheSideline.net toolbar. This column marks
-- the newest reply id the user has already seen — everything above it is
-- the unread badge. 0 = never opened the inbox.
ALTER TABLE dynasties ADD COLUMN net_inbox_seen_id INTEGER NOT NULL DEFAULT 0;
