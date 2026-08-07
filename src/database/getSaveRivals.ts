import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { LeagueRivalryData, RivalryData } from '../extractors/extract-rivalries';
import type { TeamData } from '../extractors/extract-teams';
import type { SaveRival } from '../shared/types';

/**
 * EA's own rivals for a program — the three `Rival1/2/3TeamRef` slots, with the
 * `Rivalry` table's name where one resolved.
 *
 * READ-ONLY BY DESIGN, and surfaced so the Program editor can show them beside
 * the user's own declarations. They drive in-game logic the app has no business
 * steering, and they are not editable from inside the game either — showing
 * them locked is the honest presentation, not a limitation being worked around.
 *
 * ONLY THE USER'S OWN TEAM HAS THEM, and callers must handle that rather than
 * read an empty list as "this program has no rivals". `extract-rivalries` walks
 * the USER team's record only: reading all 143 teams' rival refs would mean
 * resolving three references per team on every sync for data no surface has
 * ever asked for. `isUserTeam` says which case you are in, so the editor can
 * tell a browsed program "the save only records these for your own team"
 * instead of implying Ohio State has no rivals.
 */
export function getSaveRivals(
  dynastyId: string,
  teamIndex: number,
  seasonId?: number,
): { isUserTeam: boolean; rivals: SaveRival[] } | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  if (season.userTeamId !== teamIndex) return { isUserTeam: false, rivals: [] };

  const rivalries = getSnapshot<RivalryData[]>(season.id, 'rivalries') ?? [];
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  return {
    isUserTeam: true,
    rivals: rivalries.map((r) => ({
      opponentTeamIndex: r.opponentTeamIndex,
      // A rival slot pointing at a team the teams snapshot doesn't carry is an
      // FCS placeholder; naming it "Unknown" is better than dropping the slot,
      // because the slot itself is real and the user can see it is occupied.
      opponentName: nameByIndex.get(r.opponentTeamIndex) ?? 'Unknown',
      rivalryName: r.name,
    })),
  };
}

/**
 * Every rivalry in the league, as name pairings — what makes a rivalry look
 * like one on ANY team's schedule, not just the user's.
 *
 * Returns an empty list for a season synced before `leagueRivalries` existed,
 * which the renderer treats as "no extra knowledge" and falls back to the
 * shipped pairing list plus the user's own flag, exactly as before.
 */
export function getLeagueRivalries(dynastyId: string, seasonId?: number): LeagueRivalryData[] {
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return [];
  return getSnapshot<LeagueRivalryData[]>(season.id, 'leagueRivalries') ?? [];
}
