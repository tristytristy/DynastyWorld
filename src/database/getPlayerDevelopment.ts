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
    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    out.push({
      seasonYear: season.seasonYear,
      overallRating: player.overallRating,
      position: player.position,
      schoolYear: player.schoolYear,
      teamName: teams.find((t) => t.teamIndex === player.teamIndex)?.displayName ?? null,
    });
  }
  return out;
}
