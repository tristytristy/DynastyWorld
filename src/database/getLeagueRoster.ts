import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { LeagueTeamGame, LeagueTeamRoster, LeagueTeamSummary } from '../shared/types';

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

/** Any team's season schedule from the league-wide game snapshot, mapped relative to that team (their opponent, their W/L). */
export function getLeagueTeamSchedule(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamGame[] | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const games = getSnapshot<LeagueGameData[]>(resolved, 'leagueSchedule');
  if (!games) return null;

  return games
    .filter((g) => g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex)
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const isHome = g.homeTeamIndex === teamIndex;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const opponentScore = isHome ? g.awayScore : g.homeScore;
      const result =
        teamScore === null || opponentScore === null
          ? null
          : teamScore > opponentScore
            ? ('W' as const)
            : teamScore < opponentScore
              ? ('L' as const)
              : ('T' as const);
      return {
        gameId: g.gameId,
        week: g.week,
        weekType: g.weekType,
        bowlName: g.bowlName,
        isHome,
        opponent: isHome ? g.awayTeamName : g.homeTeamName,
        teamScore,
        opponentScore,
        result,
      };
    });
}
