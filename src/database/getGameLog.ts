import { getCurrentSeason, getDynastyById, getSeasonById, getSeasonsByDynasty, getSnapshot } from './helpers';
import { isSamePlayer } from '../shared/playerIdentity';
import { referencePlayer } from './getPlayerDevelopment';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
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
  anchorSeasonId?: number,
): GameLogEntry[] | undefined {
  const all = getGameLog(dynastyId, seasonId);
  if (!all) return undefined;

  /*
    IDENTITY GATE. Callers loop this over EVERY season to build a career — which
    turns a per-season id filter into a cross-season one, and the save recycles
    player ids (see shared/playerIdentity.ts). Without this, a freshman's career
    opened with the previous holder's debut: the reported case was an incoming
    LT whose journey began "vs Charlotte · Wk 0", two years before he enrolled.

    Only engages when an anchor is supplied AND it names a different season than
    the one being read. A caller asking for one season's log without an anchor
    (the game-log tabs, which are already scoped to the season on screen) keeps
    the cheap path and pays nothing.
  */
  if (anchorSeasonId !== undefined && seasonId !== undefined && anchorSeasonId !== seasonId) {
    const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData);
    const reference = referencePlayer(seasons, playerId, anchorSeasonId);
    const here = getSnapshot<LeagueRosterData>(seasonId, 'leagueRoster')?.players.find((p) => p.id === playerId);
    // A different person holding this id that season played no games AS THIS
    // PLAYER — an empty log is the truthful answer, not a missing one.
    if (!isSamePlayer(here, reference)) return [];
  }

  return all.filter((entry) => entry.playerId === playerId);
}
