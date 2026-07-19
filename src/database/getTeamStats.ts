import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { TeamStatsData } from '../extractors/extract-team-stats';

/** Same season-snapshot pattern as getPlayerStats — see that file for the multi-season note. */
export function getTeamStats(dynastyId: string, seasonId?: number): TeamStatsData | null | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<TeamStatsData | null>(season.id, 'teamStats') ?? null;
}
