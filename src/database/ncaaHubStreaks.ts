import { isGamePlayed } from '../shared/gameStatus';
import type { GameData } from '../extractors/extract-schedule';

/**
 * Intra-season form for ANY team in the league, derived from the season's
 * schedule snapshot — the one leaguewide, per-week source this app already
 * stores. The save itself carries no streak field worth trusting for other
 * teams (`Team.WinLossStreakAgainstRankedTeams` exists but is a different,
 * unverified statistic), and `ranking_history` only ever covers the user's own
 * team. Walking the schedule is both leaguewide and exact.
 *
 * Deliberately scoped to one season: the schedule snapshot IS a season. A
 * streak that runs back through last November needs cross-season queries and
 * is not what these narrate.
 */

export interface TeamStreak {
  kind: 'win' | 'loss' | 'none';
  length: number;
}

/** A streak has to be this long before prose is allowed to mention it — two in a row is a coincidence, not a storyline. */
export const NOTABLE_STREAK = 3;

interface TeamResult {
  week: number;
  outcome: 'win' | 'loss' | 'tie';
}

function teamResults(schedule: GameData[], teamIndex: number, throughWeek: number): TeamResult[] {
  const results: TeamResult[] = [];
  for (const game of schedule) {
    if (!isGamePlayed(game.status) || game.week > throughWeek) continue;

    const isHome = game.homeTeamIndex === teamIndex;
    const isAway = game.awayTeamIndex === teamIndex;
    if (!isHome && !isAway) continue;

    const own = isHome ? game.homeScore : game.awayScore;
    const other = isHome ? game.awayScore : game.homeScore;
    results.push({ week: game.week, outcome: own === other ? 'tie' : own > other ? 'win' : 'loss' });
  }
  return results.sort((a, b) => a.week - b.week);
}

/**
 * The team's current run of identical results as of the end of `throughWeek`,
 * counting backwards from its most recent game. A tie stops the count (it is
 * neither), and a team with no played games yet comes back as `none`/0 rather
 * than as a zero-length win streak.
 *
 * Pass the week BEFORE a game to get the streak the team carried INTO it —
 * which is what narration wants, so "that's four straight" counts the game
 * being described rather than double-counting it.
 */
export function computeTeamStreak(
  schedule: GameData[],
  teamIndex: number | null,
  throughWeek: number,
): TeamStreak {
  if (teamIndex === null) return { kind: 'none', length: 0 };

  const results = teamResults(schedule, teamIndex, throughWeek);
  const latest = results[results.length - 1];
  if (!latest || latest.outcome === 'tie') return { kind: 'none', length: 0 };

  let length = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].outcome !== latest.outcome) break;
    length++;
  }
  return { kind: latest.outcome, length };
}

/** Record over the team's most recent `count` games — the "winners of five of six" fact, which a season-long W-L can't show. */
export function recentForm(
  schedule: GameData[],
  teamIndex: number | null,
  throughWeek: number,
  count: number,
): { wins: number; losses: number; games: number } {
  if (teamIndex === null) return { wins: 0, losses: 0, games: 0 };

  const recent = teamResults(schedule, teamIndex, throughWeek).slice(-count);
  return {
    wins: recent.filter((result) => result.outcome === 'win').length,
    losses: recent.filter((result) => result.outcome === 'loss').length,
    games: recent.length,
  };
}
