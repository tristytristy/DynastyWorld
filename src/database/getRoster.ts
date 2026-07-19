import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { RosterPlayerData } from '../extractors/extract-roster';
import type { RosterPlayer } from '../shared/types';

/**
 * Reads the roster snapshot for a dynasty's given season, or its current
 * season if seasonId is omitted. Each imported season year gets its own
 * season row (see helpers.createSeason), so this already supports browsing
 * past years' rosters once a dynasty has been imported across multiple
 * seasons — no extra storage needed beyond what Phase 2 built.
 */
export function getRoster(dynastyId: string, seasonId?: number): RosterPlayer[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<RosterPlayerData[]>(season.id, 'roster') ?? [];
}
