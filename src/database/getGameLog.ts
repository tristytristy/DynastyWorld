import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { PlayerGameLogEntry } from '../extractors/extract-gamelog';
import type { GameLogEntry } from '../shared/types';

/** Same season-snapshot pattern as getRoster/getPlayerStats. Raw per-game entries — callers join against getSchedule (by gameId) and getRoster (by playerId) as needed. */
export function getGameLog(dynastyId: string, seasonId?: number): GameLogEntry[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<PlayerGameLogEntry[]>(season.id, 'gamelog') ?? [];
}
