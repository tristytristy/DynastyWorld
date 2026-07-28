import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { LeagueScoresView, ResultsHold } from '../shared/types';

/**
 * Every game in the league for a season — the national scoreboard behind the
 * NCAA Hub Scores page. Sourced from the same leaguewide `leagueSchedule`
 * snapshot the browse pages use; games whose team names didn't resolve (bye/
 * placeholder rows) are dropped. Each row's gameId opens the full Game Info
 * modal (getGameDetail), so no rich per-game data is duplicated here.
 *
 * `heldWeek` reports the week whose non-user scores were withheld at sync time
 * (see shared/resultsHold.ts) so the page can explain an empty-looking week
 * rather than reading as a bug. Null for seasons synced before the hold
 * existed — those have no `resultsHold` snapshot.
 */
export function getLeagueScores(dynastyId: string, seasonId?: number): LeagueScoresView | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const games = getSnapshot<LeagueGameData[]>(season.id, 'leagueSchedule');
  if (!games) return null;

  const heldWeek = getSnapshot<ResultsHold>(season.id, 'resultsHold')?.week ?? null;

  const rows = games
    .filter((g) => !!g.homeTeamName && !!g.awayTeamName)
    .map((g) => ({
      gameId: g.gameId,
      week: g.week,
      weekType: g.weekType,
      homeTeamName: g.homeTeamName,
      awayTeamName: g.awayTeamName,
      homeTeamIndex: g.homeTeamIndex,
      awayTeamIndex: g.awayTeamIndex,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      bowlName: g.bowlName,
    }))
    .sort((a, b) => a.week - b.week || a.homeTeamName.localeCompare(b.homeTeamName));

  return { games: rows, heldWeek };
}
