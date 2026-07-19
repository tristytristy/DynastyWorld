import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { PlayerKickingStatsData } from '../extractors/extract-kicking';
import type { PlayerKickingStats } from '../shared/types';

/** Same season-snapshot pattern as getPlayerStats — see that file for the multi-season note. */
export function getKickingStats(dynastyId: string, seasonId?: number): PlayerKickingStats[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<PlayerKickingStatsData[]>(season.id, 'kicking') ?? [];
}
