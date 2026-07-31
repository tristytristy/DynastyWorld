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

/**
 * ONE player's entries from a season's log.
 *
 * The same data `getGameLog` returns, filtered here instead of in the renderer —
 * and the difference is not a nicety. The log is LEAGUEWIDE: every player in the
 * country, every game. A single played Auburn season measures **16.5 MB of JSON
 * and 721 ms** to hand across IPC (measured 2026-07-30), and the player modal
 * asked for it twice on every open — once for the game-log tabs and once for the
 * History tab's career milestones — purely to keep the ~13 rows belonging to the
 * player on screen.
 *
 * Filtering before the boundary turns that into a few KB. The snapshot still has
 * to be read and parsed in this process, which is what the cache in
 * `getSnapshot` is for; what this removes is the structured clone of an entire
 * league's box scores, and the renderer-side garbage that followed it.
 */
export function getPlayerGameLog(
  dynastyId: string,
  playerId: number,
  seasonId?: number,
): GameLogEntry[] | undefined {
  const all = getGameLog(dynastyId, seasonId);
  return all?.filter((entry) => entry.playerId === playerId);
}
