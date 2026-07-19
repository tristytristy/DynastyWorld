import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { LeagueTeamRoster, LeagueTeamSummary } from '../shared/types';

interface TeamsSnapshotEntry {
  teamIndex: number;
  displayName: string;
}

function resolveSeasonId(dynastyId: string, seasonId?: number): number | undefined {
  const seasons = getSeasonsByDynasty(dynastyId);
  if (seasonId !== undefined) return seasons.find((s) => s.id === seasonId)?.id;
  return seasons.find((s) => s.isCurrent)?.id ?? seasons[0]?.id;
}

/** Every team in the league with a roster in this season's league snapshot — for the browse entry list. */
export function getLeagueTeams(dynastyId: string, seasonId?: number): LeagueTeamSummary[] | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  const counts = new Map<number, number>();
  for (const player of league.players) {
    counts.set(player.teamIndex, (counts.get(player.teamIndex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([teamIndex, playerCount]) => ({
      teamIndex,
      displayName: nameByIndex.get(teamIndex) ?? `Team ${teamIndex}`,
      playerCount,
    }))
    .filter((t) => !t.displayName.startsWith('Team ') || t.playerCount > 30)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** One team's full roster from the league snapshot, with season stat lines joined for stat-holders. */
export function getLeagueTeamRoster(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamRoster | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const displayName = teams.find((t) => t.teamIndex === teamIndex)?.displayName ?? `Team ${teamIndex}`;

  const statByPlayer = new Map(league.stats.map((s) => [s.playerId, s]));
  const players = league.players
    .filter((p) => p.teamIndex === teamIndex)
    .map((p) => ({ ...p, seasonStat: statByPlayer.get(p.id) ?? null }));

  return { teamIndex, displayName, seasonId: resolved, players };
}
