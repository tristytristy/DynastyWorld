-- Schema version 11 — point-in-time context for every league game.
--
-- The save only ever holds a team's CURRENT rank and CURRENT record. So a
-- schedule rendered from the save shows the opponent as they are today, not as
-- they were the week you played them: beat a #7 in September and by December
-- your own schedule claims you beat a #40. The same applies to their record.
--
-- The fix is to capture it while it's still true. When the save sits at
-- CurrentWeek = W, its polls and records have NOT yet rolled forward for week
-- W's games (verified directly — see shared/resultsHold.ts), so what's in the
-- save at that moment IS the state going into that week's games.
--
-- Written leaguewide (both sides of every game, not just the user's) so any
-- team's schedule and any Game Info modal can show what was true at the time.
--
-- Lifecycle: while a game is unplayed each sync REFRESHES the row, tracking the
-- poll as it moves week to week. The first sync that sees the game played sets
-- locked = 1, and nothing rewrites it after that — so the frozen value is the
-- last pre-game state observed.

CREATE TABLE game_context (
  season_id INTEGER NOT NULL,
  -- Row index into the save's SeasonGame table; matches GameData.gameId.
  game_id INTEGER NOT NULL,

  home_media_rank INTEGER,
  home_cfp_rank INTEGER,
  home_wins INTEGER,
  home_losses INTEGER,

  away_media_rank INTEGER,
  away_cfp_rank INTEGER,
  away_wins INTEGER,
  away_losses INTEGER,

  -- SeasonInfo.CurrentWeek when this row was last written, so the UI can say
  -- how close to kickoff the capture actually was.
  captured_week INTEGER,
  -- 1 once the game has been played; the row is immutable from then on.
  locked INTEGER NOT NULL DEFAULT 0,
  -- 1 when the game was ALREADY played the first time we saw it, so this is
  -- "state when tracking began", not "state at kickoff". The UI must not claim
  -- historical accuracy for these.
  captured_after_play INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (season_id, game_id),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);

CREATE INDEX idx_game_context_season ON game_context(season_id);
