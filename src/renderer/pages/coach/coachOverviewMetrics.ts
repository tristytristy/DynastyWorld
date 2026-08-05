/**
 * The derivations behind the Overview command centre, kept out of the component
 * so each one can be read (and corrected) on its own.
 *
 * The rule every function here follows: return null rather than guess. A card
 * that isn't rendered is better than a card built from a number the save didn't
 * actually supply, and the Coach Hub spec's "omit it and preserve the layout"
 * is enforced here rather than in JSX.
 */
import { rankedOpponent } from './coachSeasonMetrics';
import type { NationalTeamStatRow, ScheduleGame, ScheduleOverview } from '../../../shared/types';

/** Games that have actually been played, oldest first. */
export function playedGames(schedule: ScheduleOverview | null): ScheduleGame[] {
  return (schedule?.games ?? [])
    .filter((g) => g.teamScore !== null && g.opponentScore !== null)
    .sort((a, b) => a.week - b.week);
}

export type FormGame = {
  gameId: number;
  week: number;
  result: 'W' | 'L' | 'T';
  teamScore: number;
  opponentScore: number;
  opponent: string;
  isHome: boolean;
};

/** The last N results, most recent LAST so the strip reads left-to-right like a season does. */
export function recentForm(schedule: ScheduleOverview | null, count = 5): FormGame[] {
  return playedGames(schedule)
    .slice(-count)
    .map((g) => ({
      gameId: g.gameId,
      week: g.week,
      result: (g.result ?? (g.teamScore! > g.opponentScore! ? 'W' : 'L')) as 'W' | 'L' | 'T',
      teamScore: g.teamScore!,
      opponentScore: g.opponentScore!,
      opponent: g.opponent,
      isHome: g.isHome,
    }));
}

/** Average scoring margin across played games; null before any game is played. */
export function scoringMargin(schedule: ScheduleOverview | null): number | null {
  const played = playedGames(schedule);
  if (played.length === 0) return null;
  const total = played.reduce((sum, g) => sum + (g.teamScore! - g.opponentScore!), 0);
  return Math.round((total / played.length) * 10) / 10;
}

/**
 * The season's most notable win.
 *
 * TWO GATES, both of which matter. Rank is only used when it was CAPTURED at
 * the time (`opponentCurrentRank` is today's rank otherwise, which would
 * retroactively promote whoever happens to be good now), and only when it is a
 * genuine top-25 placing — the save's polls place all 138 FBS teams, so "has a
 * rank" is true of nearly every opponent. Both live in `rankedOpponent` so the
 * Season page and this one can never drift apart on what "ranked" means.
 *
 * With no qualifying rank we fall back to margin, which is always honest, and
 * the caller says which basis it used rather than implying a rank it lacks.
 */
export function bestWin(schedule: ScheduleOverview | null): { game: FormGame; rank: number | null } | null {
  const wins = playedGames(schedule).filter((g) => (g.result ?? '') === 'W' || g.teamScore! > g.opponentScore!);
  if (wins.length === 0) return null;

  const ranked = wins.filter((g) => rankedOpponent(g) !== null);
  const pick = ranked.length
    ? ranked.reduce((best, g) => (rankedOpponent(g)! < rankedOpponent(best)! ? g : best))
    : wins.reduce((best, g) =>
        g.teamScore! - g.opponentScore! > best.teamScore! - best.opponentScore! ? g : best,
      );

  return {
    game: {
      gameId: pick.gameId,
      week: pick.week,
      result: 'W',
      teamScore: pick.teamScore!,
      opponentScore: pick.opponentScore!,
      opponent: pick.opponent,
      isHome: pick.isHome,
    },
    rank: ranked.length ? rankedOpponent(pick) : null,
  };
}

export type UnitSnapshot = {
  pointsPerGame: number;
  pointsAllowedPerGame: number;
  yardsPerGame: number;
  yardsAllowedPerGame: number;
  /** 1-based rank among real FBS teams; null when the league table wasn't available. */
  pointsRank: number | null;
  pointsAllowedRank: number | null;
  yardsRank: number | null;
  yardsAllowedRank: number | null;
};

/**
 * Offence and defence for one team, plus where those numbers place nationally.
 *
 * Built from the national table rather than the team's own stat snapshot because
 * that table already carries every team's totals — so the ranks are a real
 * computation over the league, not an estimate, which is the difference between
 * "31.4 PPG" and "31.4 PPG, 6th in the country".
 */
export function unitSnapshot(rows: NationalTeamStatRow[] | null, teamIndex: number | null): UnitSnapshot | null {
  if (!rows || rows.length === 0 || teamIndex === null) return null;
  const mine = rows.find((r) => r.teamIndex === teamIndex);
  if (!mine || mine.games === 0) return null;

  const per = (total: number) => Math.round((total / mine.games) * 10) / 10;
  // Ascending = better for the "allowed" measures, descending for our own.
  const rankBy = (value: (r: NationalTeamStatRow) => number, lowerIsBetter: boolean): number => {
    const mineValue = value(mine) / mine.games;
    const better = rows.filter(
      (r) => r.games > 0 && (lowerIsBetter ? value(r) / r.games < mineValue : value(r) / r.games > mineValue),
    ).length;
    return better + 1;
  };

  return {
    pointsPerGame: per(mine.points),
    pointsAllowedPerGame: per(mine.pointsAllowed),
    yardsPerGame: per(mine.offenseYards),
    yardsAllowedPerGame: per(mine.defTotalYards),
    pointsRank: rankBy((r) => r.points, false),
    pointsAllowedRank: rankBy((r) => r.pointsAllowed, true),
    yardsRank: rankBy((r) => r.offenseYards, false),
    yardsAllowedRank: rankBy((r) => r.defTotalYards, true),
  };
}

/**
 * ONE factual sentence about where the season stands, built only from confirmed
 * values — no adjectives the data can't support, and nothing at all before the
 * first game is played.
 */
export function pulseSentence(input: {
  teamName: string;
  coachLastName: string | null;
  tenureYear: number | null;
  schedule: ScheduleOverview | null;
}): string | null {
  const { teamName, coachLastName, tenureYear, schedule } = input;
  const played = playedGames(input.schedule);
  if (!schedule || played.length === 0) return null;

  const { wins, losses } = schedule.record;
  const season = tenureYear !== null ? ordinalWord(tenureYear) : null;
  const who = coachLastName ? `${coachLastName}'s` : null;
  const opening =
    season && who
      ? `${teamName} is ${wins}-${losses} in ${who} ${season} season`
      : `${teamName} is ${wins}-${losses}`;

  // The trailing clause is the streak when there is one, otherwise the recent
  // five — and the five only when five have actually been played, so a 2-0 team
  // never reads "1-1 over its last five".
  const streak = schedule.currentStreak;
  if (streak.type && streak.count >= 3) {
    return `${opening} and has ${streak.type === 'W' ? 'won' : 'lost'} ${streak.count} straight.`;
  }
  const lastFive = played.slice(-5);
  if (lastFive.length === 5) {
    const w = lastFive.filter((g) => g.teamScore! > g.opponentScore!).length;
    return `${opening} and is ${w}-${5 - w} over its last five games.`;
  }
  return `${opening}.`;
}

function ordinalWord(n: number): string {
  const words = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  return words[n] ?? `${n}th`;
}
