import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { PlayerStatsData } from '../extractors/extract-stats';
import type { PlayerStats } from '../shared/types';

/** Same season-snapshot pattern as getRoster — see that file for the multi-season note. */
export function getPlayerStats(dynastyId: string, seasonId?: number): PlayerStats[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<PlayerStatsData[]>(season.id, 'stats') ?? [];
}
