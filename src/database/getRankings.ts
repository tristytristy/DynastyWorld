import { getCurrentSeason, getDynastyById, getRankingHistory, getSeasonById, getSnapshot } from './helpers';
import type { TeamData } from '../extractors/extract-teams';
import type { RankingsOverview, RankingWeek } from '../shared/types';

/** Lower rank number = better; 0 means unranked (this app's convention) and is excluded from "highest"/"average". */
function highestRank(values: number[]): number | null {
  const ranked = values.filter((v) => v > 0);
  return ranked.length === 0 ? null : Math.min(...ranked);
}

function averageRank(values: number[]): number | null {
  const ranked = values.filter((v) => v > 0);
  if (ranked.length === 0) return null;
  return Math.round((ranked.reduce((sum, v) => sum + v, 0) / ranked.length) * 10) / 10;
}

/**
 * Reads this season's accumulated ranking history (see
 * recordRankingSnapshot/getRankingHistory in helpers.ts — one row per
 * distinct week the user has imported at, since the save itself never stores
 * more than 3 fixed poll data points). "Highest"/"average" are computed
 * per-poll and only over weeks the team was actually ranked in that specific
 * poll, since AP/Coaches/CFP rankings don't always agree on who's ranked.
 */
export function getRankings(dynastyId: string, seasonId?: number): RankingsOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((t) => t.teamIndex === season.userTeamId);
  const rows = getRankingHistory(season.id);
  const history: RankingWeek[] = rows.map((row) => ({
    week: row.week,
    mediaPollRank: row.mediaPollRank ?? 0,
    coachesPollRank: row.coachesPollRank ?? 0,
    cfpRank: row.cfpRank ?? 0,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
  }));

  return {
    teamName: userTeam?.displayName ?? dynasty.teamName ?? '',
    history,
    highestMediaPollRank: highestRank(history.map((h) => h.mediaPollRank)),
    highestCoachesPollRank: highestRank(history.map((h) => h.coachesPollRank)),
    highestCfpRank: highestRank(history.map((h) => h.cfpRank)),
    averageMediaPollRank: averageRank(history.map((h) => h.mediaPollRank)),
    averageCoachesPollRank: averageRank(history.map((h) => h.coachesPollRank)),
    averageCfpRank: averageRank(history.map((h) => h.cfpRank)),
  };
}
