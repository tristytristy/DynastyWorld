import { deriveSyncPhase, type SyncPhaseInput } from './syncPhase';
import { isGamePlayed } from './gameStatus';

/**
 * Results hold (2026-07-27) — keeps the hub from spoiling scores the game
 * itself hasn't revealed yet.
 *
 * The save pre-simulates the ENTIRE current week the moment you enter it: at
 * SeasonInfo.CurrentWeek = W, every week-W game except the user's own is
 * already sitting in SeasonGame with a final score, quarter-by-quarter lines
 * and both teams' stat caches. The game hides all of it until you play your
 * own game; a sync taken in that window would hand the user the whole
 * weekend's results early. Verified directly across a full Auburn season
 * (Dynasty Save Test/Full Season Saves, W0→W31):
 *
 *   CurrentWeek=2  → week 2 played 85/86 (the 1 unplayed = Auburn's own)
 *   CurrentWeek=4  → week 4 played 70/71, all 70 with quarter scores + stat caches
 *   CurrentWeek=17 → week 17 played 27/28 (bowl round 1)
 *
 * What is NOT leaked — checked, not assumed — so the hold only has to cover
 * the SeasonGame result fields:
 *   - team W-L records: 127 of 128 current-week teams matched games played
 *     BEFORE the current week, so standings/rankings/polls are already gated
 *     by the game itself
 *   - per-game player stat lines: 0 exist for the current week (weeks 0-3 had
 *     847/5103/5183/5022 lines; week 4 had none), so season stat totals,
 *     national leaders and box scores can't leak either
 *
 * The hold is applied at INGEST (see persistExtraction) rather than at read
 * time: it's one choke point that every page inherits, and nothing is lost —
 * the save always carries the full season, so the next sync writes the real
 * results back in.
 */

/** The minimum a game needs to expose for the hold to classify it. */
export interface HeldGameIdentity {
  week: number;
  homeTeamIndex: number | null;
  awayTeamIndex: number | null;
}

export interface UserGameProbe extends HeldGameIdentity {
  status: string;
}

export interface ResultsHoldInput extends SyncPhaseInput {
  /** SeasonInfo.CurrentWeek — the week being played right now (0-based, matching SeasonGame.SeasonWeek). */
  currentWeek: number;
  userTeamIndex: number;
  /** This season's games (the full leaguewide schedule) — only the user's own rows are consulted. */
  games: readonly UserGameProbe[];
}

/**
 * The earliest week whose non-user results must stay hidden, or null when
 * nothing is held.
 *
 * The reveal trigger mirrors the game's: the rest of week W becomes visible
 * once the user's OWN week-W game is played — not when the week is advanced —
 * so a sync taken after your game but before hitting Advance shows the same
 * scoreboard the game does. On a bye week (no user game at all) there's
 * nothing to trigger the reveal, so the week stays held until CurrentWeek
 * moves past it.
 *
 * Preseason and offseason are never held: CurrentWeek reads 0 at both (see
 * importExtraction's computeLastPlayedWeek), which would otherwise hold the
 * entire season, and by the offseason the game has revealed everything anyway.
 */
export function resolveHeldWeek(input: ResultsHoldInput): number | null {
  const phase = deriveSyncPhase(input);
  if (phase.kind === 'preseason' || phase.kind === 'offseason') return null;

  const userPlayedThisWeek = input.games.some(
    (game) =>
      game.week === input.currentWeek &&
      involvesTeam(game, input.userTeamIndex) &&
      isGamePlayed(game.status),
  );
  if (userPlayedThisWeek) return null;

  return input.currentWeek;
}

function involvesTeam(game: HeldGameIdentity, teamIndex: number): boolean {
  return game.homeTeamIndex === teamIndex || game.awayTeamIndex === teamIndex;
}

/**
 * Whether this game's result is still under wraps. Weeks at or beyond the held
 * week are covered (not just the held week itself) so anything the engine
 * resolves further ahead is caught too; the user's own games are never held —
 * they played them.
 */
export function isResultHeld(
  game: HeldGameIdentity,
  heldWeek: number | null,
  userTeamIndex: number,
): boolean {
  if (heldWeek === null) return false;
  if (game.week < heldWeek) return false;
  return !involvesTeam(game, userTeamIndex);
}

/** The full-detail schedule shape (extract-schedule's GameData) as the hold sees it. */
interface HoldableGame extends HeldGameIdentity {
  status: string;
  homeScore: number;
  awayScore: number;
  homeQuarterScores: number[];
  awayQuarterScores: number[];
  homeTeamStats: unknown;
  awayTeamStats: unknown;
}

/**
 * Rewrites a held game to look exactly like one that hasn't kicked off — same
 * shape the extractor produces for a genuinely unplayed game — so every
 * downstream `isGamePlayed()` / `homeScore !== null` check behaves correctly
 * with no further changes.
 *
 * `'Unplayed'` specifically, rather than any of the save's other not-played
 * values: this is a game we are choosing to hide, not a bracket slot awaiting
 * a matchup, and it should read as an ordinary upcoming fixture everywhere.
 */
export function holdGameResult<T extends HoldableGame>(game: T): T {
  return {
    ...game,
    status: 'Unplayed',
    homeScore: 0,
    awayScore: 0,
    homeQuarterScores: [0, 0, 0, 0],
    awayQuarterScores: [0, 0, 0, 0],
    homeTeamStats: null,
    awayTeamStats: null,
  };
}

/** The compact leaguewide shape (extract-league-schedule's LeagueGameData), where a null score IS "unplayed". */
interface HoldableLeagueGame extends HeldGameIdentity {
  homeScore: number | null;
  awayScore: number | null;
}

export function holdLeagueGameResult<T extends HoldableLeagueGame>(game: T): T {
  return { ...game, homeScore: null, awayScore: null };
}
