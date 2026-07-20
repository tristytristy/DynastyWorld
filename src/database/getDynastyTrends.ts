import { getDynastyById, getRankingHistory, getSeasonsByDynasty } from './helpers';
import { getSeasonOverview } from './getSeasonOverview';
import { getSchedule } from './getSchedule';
import type { DynastyTrends, DynastyTrendSeason } from '../shared/types';

/**
 * Assembles the multi-season series behind the Dynasty Trends dashboard from
 * data already archived: per-season record + recruiting rank (season
 * overview), points for/against (summed from the season's schedule results —
 * the save stores no season points total, but every game's score is in the
 * schedule snapshot), and the week-by-week poll trajectory (ranking_history,
 * which is the ONLY real weekly trend since the save itself keeps just
 * current/last-week/start-of-season). Seasons without full data contribute
 * whatever they have (usually just record/ranks) and the UI shows honest gaps.
 */
export function getDynastyTrends(dynastyId: string): DynastyTrends | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const seasons = [...getSeasonsByDynasty(dynastyId)].sort((a, b) => a.seasonYear - b.seasonYear);

  let teamName = dynasty.teamName ?? '';
  const rows: DynastyTrendSeason[] = seasons.map((season) => {
    const overview = getSeasonOverview(dynastyId, season.id);
    if (overview) teamName = overview.teamName;

    const schedule = getSchedule(dynastyId, season.id);
    let pointsFor: number | null = null;
    let pointsAgainst: number | null = null;
    if (schedule) {
      const played = schedule.games.filter((g) => g.teamScore !== null && g.opponentScore !== null);
      if (played.length > 0) {
        pointsFor = played.reduce((sum, g) => sum + (g.teamScore ?? 0), 0);
        pointsAgainst = played.reduce((sum, g) => sum + (g.opponentScore ?? 0), 0);
      }
    }

    const weeks = [...getRankingHistory(season.id)].sort((a, b) => a.week - b.week);
    const finalWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;

    return {
      seasonId: season.id,
      seasonYear: season.seasonYear,
      hasFullData: season.hasFullData,
      wins: overview?.record.wins ?? null,
      losses: overview?.record.losses ?? null,
      pointsFor,
      pointsAgainst,
      recruitingClassRank: overview?.recruitingClassRank ?? null,
      finalMediaRank: finalWeek?.mediaPollRank ?? overview?.rankings.media ?? null,
      finalCoachesRank: finalWeek?.coachesPollRank ?? overview?.rankings.coaches ?? null,
      finalCfpRank: finalWeek?.cfpRank ?? overview?.rankings.cfp ?? null,
      rankingWeeks: weeks.map((w) => ({
        week: w.week,
        mediaRank: w.mediaPollRank,
        coachesRank: w.coachesPollRank,
        cfpRank: w.cfpRank,
      })),
    };
  });

  return { teamName, seasons: rows };
}
