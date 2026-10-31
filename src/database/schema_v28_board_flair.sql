-- TheSideline.net user flair (user request, 2026-09-14): the human member
-- picks a team chip (or stays flairless old-guard). Board-only identity —
-- deliberately NOT part of the Net display name, so the Feed stays a plain
-- fan account while the board wears colors. Empty = no flair.
ALTER TABLE dynasties ADD COLUMN board_flair TEXT NOT NULL DEFAULT '';
