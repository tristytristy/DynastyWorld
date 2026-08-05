import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getSeasonsByDynasty, getSnapshot } from './helpers';
import { findSamePlayer, type PlayerIdentityFields } from '../shared/playerIdentity';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { TeamData } from '../extractors/extract-teams';
import type { PlayerDevelopmentSeason } from '../shared/types';

/**
 * WHICH occupant of a recycled id we are being asked about.
 *
 * `playerId` alone is ambiguous across seasons — see shared/playerIdentity.ts —
 * so a career view has to fix the person before it can walk the years. The
 * caller passes the season it is rendering the player from; that row becomes the
 * reference every other season is compared against.
 *
 * Without an anchor this falls back to the NEWEST season holding the id, which
 * is right for the common case (a current player) and wrong for a historical one
 * whose id has since been reissued — which is exactly why the anchor exists and
 * why the player modal passes it.
 */
export function referencePlayer(
  seasons: { id: number; seasonYear: number }[],
  playerId: number,
  anchorSeasonId?: number,
): PlayerIdentityFields | undefined {
  const search = anchorSeasonId !== undefined
    ? [...seasons].sort((a, b) => (a.id === anchorSeasonId ? -1 : b.id === anchorSeasonId ? 1 : 0))
    : [...seasons].sort((a, b) => b.seasonYear - a.seasonYear);
  for (const season of search) {
    const league = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
    const hit = league?.players.find((p) => p.id === playerId);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * A player's rating arc across every synced season — the payoff of syncing
 * every year. Walks each full-data season's league-wide roster snapshot (which
 * covers every team, so it works for anyone, not just the user's program) and
 * finds the player by their stable PresentationId, returning their OVR, class,
 * position, and team that season. Ordered oldest → newest so the caller can
 * draw a straight left-to-right progression line. Empty when the player was
 * only ever on history-only seasons (no roster snapshot).
 *
 * ONLY THE SEASONS HE WAS ACTUALLY ON A TEAM (user report 2026-08-03). A player
 * doesn't leave the league-wide roster when he leaves football — he lands on the
 * generic FCS pool, team index 255, which the teams snapshot resolves to "FCS
 * East"/"FCS West" and friends with a NULL conference. Charting those seasons
 * produced two lies:
 *
 *  • a cliff on the way out — a departed player showed a 26-point "loss" that
 *    was really the pool's placeholder rating, not a decline he ever suffered;
 *  • a phantom first year on the way in — a recruit sitting in the pool before
 *    he enrolled was drawn as a season with your program.
 *
 * The gate is the same "is this a real, rankable team" test getNationalTeamStats
 * uses: a resolvable team WITH a conference. Pool rows have neither, so both
 * ends of the arc disappear together, and the line now covers exactly the years
 * he was on somebody's roster.
 */
export function getPlayerDevelopment(
  dynastyId: string,
  playerId: number,
  anchorSeasonId?: number,
): PlayerDevelopmentSeason[] {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  const reference = referencePlayer(seasons, playerId, anchorSeasonId);
  if (!reference) return [];

  const out: PlayerDevelopmentSeason[] = [];
  for (const season of seasons) {
    const league = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
    const player = findSamePlayer(league?.players, reference);
    if (!player) continue;
    if (player.teamIndex === FCS_POOL_TEAM_INDEX) continue;
    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    const team = teams.find((t) => t.teamIndex === player.teamIndex);
    // No team, or one with no conference, is the pool by another name.
    if (!team || team.conferenceName == null) continue;
    out.push({
      seasonYear: season.seasonYear,
      overallRating: player.overallRating,
      position: player.position,
      schoolYear: player.schoolYear,
      teamName: team.displayName,
    });
  }
  return out;
}
