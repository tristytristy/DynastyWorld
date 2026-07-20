import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { ConferenceChampionshipData, YearSummaryData } from '../extractors/extract-league-history';
import type { LeagueTeamGame, LeagueTeamHonors, LeagueTeamRoster, LeagueTeamSummary } from '../shared/types';

interface TeamsSnapshotEntry {
  teamIndex: number;
  displayName: string;
  conferenceName?: string | null;
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

  // Conference membership per team, same source (teams snapshot) and same
  // classification rule the user's own schedule uses in getSchedule.ts — a
  // game is 'conference' only when both teams share a conference.
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const conferenceByTeamIndex = new Map(teams.map((t) => [t.teamIndex, t.conferenceName ?? null]));

  return games
    .filter((g) => g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex)
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const isHome = g.homeTeamIndex === teamIndex;
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const opponentScore = isHome ? g.awayScore : g.homeScore;
      const opponentIndex = isHome ? g.awayTeamIndex : g.homeTeamIndex;
      const result =
        teamScore === null || opponentScore === null
          ? null
          : teamScore > opponentScore
            ? ('W' as const)
            : teamScore < opponentScore
              ? ('L' as const)
              : ('T' as const);

      const ownConf = conferenceByTeamIndex.get(teamIndex) ?? null;
      const oppConf = conferenceByTeamIndex.get(opponentIndex) ?? null;
      const gameType: LeagueTeamGame['gameType'] =
        g.weekType !== 'RegularSeason'
          ? 'bowl'
          : ownConf && oppConf && ownConf === oppConf
            ? 'conference'
            : 'non-conference';

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
        gameType,
        conferenceName: gameType === 'conference' ? ownConf : null,
      };
    });
}

/**
 * Any team's championship honors for a season — conference title and/or
 * national title — read from the leaguewide `yearSummary` snapshot (the same
 * completed-year data behind the user's own trophy case and the standings
 * conference-champion flag). Lets Team Hub show the same trophies for any
 * program the user browses to, not just their own. Returns all-false when the
 * season isn't decided yet (no yearSummary) so a mid-season browse simply
 * shows no trophy rather than a wrong one.
 */
export function getLeagueTeamHonors(dynastyId: string, teamIndex: number, seasonId?: number): LeagueTeamHonors | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;

  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const teamName = teams.find((t) => t.teamIndex === teamIndex)?.displayName;
  if (!teamName) return { conferenceChampion: false, conferenceName: null, nationalChampion: false };

  const yearSummary = getSnapshot<YearSummaryData>(resolved, 'yearSummary');
  // Conference champions: prefer the rich yearSummary array; fall back to the
  // standalone conferenceChampionship snapshot (same leaguewide data) so a
  // season synced before yearSummary was captured still resolves a title.
  const confChampions: ConferenceChampionshipData[] =
    yearSummary?.conferenceChampions ??
    getSnapshot<ConferenceChampionshipData[]>(resolved, 'conferenceChampionship') ??
    [];
  const confChamp = confChampions.find((c) => c.winningTeamName === teamName) ?? null;

  return {
    conferenceChampion: confChamp !== null,
    conferenceName: confChamp?.conferenceName ?? null,
    nationalChampion: yearSummary?.nationalChampion?.teamName === teamName,
  };
}
