import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { TeamData } from '../extractors/extract-teams';
import type { PlayerDevelopmentSeason } from '../shared/types';

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
export function getPlayerDevelopment(dynastyId: string, playerId: number): PlayerDevelopmentSeason[] {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  const out: PlayerDevelopmentSeason[] = [];
  for (const season of seasons) {
    const league = getSnapshot<LeagueRosterData>(season.id, 'leagueRoster');
    const player = league?.players.find((p) => p.id === playerId);
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
