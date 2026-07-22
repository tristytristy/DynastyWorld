import { getDynastyById, getSeasonById, getSeasonsByDynasty, getSnapshot, resolveSeasonHeadCoach } from './helpers';
import type { LeagueRosterData } from '../extractors/extract-league-roster';
import type { LeagueGameData } from '../extractors/extract-league-schedule';
import type { ConferenceChampionshipData, YearSummaryData } from '../extractors/extract-league-history';
import type { TeamData } from '../extractors/extract-teams';
import type { GameSummary, LeagueTeamGame, LeagueTeamHonors, LeagueTeamRoster, LeagueTeamSummary, NationalPlayer, SeasonOverview } from '../shared/types';

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

/**
 * A full Team-Hub overview for ANY team (not just the user's), built from the
 * same `teams` + `leagueSchedule` snapshots the browse pages already use. Lets
 * a non-user Team Hub show the identical picture the user's does — record,
 * conference record, poll ranks, recruiting-class rank, prestige, and recent/
 * upcoming games. (Season-high ranking history stays user-only — it's not
 * tracked leaguewide.) Returns the same SeasonOverview shape so one render path
 * serves both.
 */
export function getLeagueTeamOverview(
  dynastyId: string,
  teamIndex: number,
  seasonId?: number,
): SeasonOverview | undefined {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return undefined;
  const dynasty = getDynastyById(dynastyId);
  const season = getSeasonById(resolved);
  const teams = getSnapshot<TeamData[]>(resolved, 'teams') ?? [];
  const team = teams.find((t) => t.teamIndex === teamIndex);
  if (!team || !dynasty || !season) return undefined;

  const games = getSnapshot<LeagueGameData[]>(resolved, 'leagueSchedule') ?? [];
  const teamGames = games.filter((g) => g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex);
  const toSummary = (g: LeagueGameData): GameSummary => {
    const isHome = g.homeTeamIndex === teamIndex;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const opponentScore = isHome ? g.awayScore : g.homeScore;
    const played = teamScore !== null && opponentScore !== null;
    let result: GameSummary['result'] = null;
    if (played) result = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T';
    return {
      week: g.week,
      opponent: (isHome ? g.awayTeamName : g.homeTeamName) ?? 'TBD',
      isHome,
      status: played ? 'Played' : 'Unplayed',
      teamScore: played ? teamScore : null,
      opponentScore: played ? opponentScore : null,
      result,
    };
  };
  const played = teamGames.filter((g) => g.homeScore !== null && g.awayScore !== null).sort((a, b) => a.week - b.week);
  const upcoming = teamGames.filter((g) => g.homeScore === null || g.awayScore === null).sort((a, b) => a.week - b.week);

  return {
    dynastyId: dynasty.id,
    dynastyLabel: dynasty.label,
    teamName: team.displayName,
    seasonYear: season.seasonYear,
    headCoach: resolveSeasonHeadCoach(season, teamIndex),
    lastSyncedAt: season.extractedAt,
    record: { wins: team.confWins + team.nonConfWins, losses: team.confLosses + team.nonConfLosses },
    conferenceRecord: { wins: team.confWins, losses: team.confLosses },
    rankings: {
      media: team.mediaPollRank > 0 ? team.mediaPollRank : null,
      coaches: team.coachesPollRank > 0 ? team.coachesPollRank : null,
      cfp: team.cfpRank > 0 ? team.cfpRank : null,
    },
    recruitingClassRank: team.topClassRank > 0 ? team.topClassRank : null,
    teamPrestige: team.teamPrestige > 0 ? team.teamPrestige : null,
    recentGames: played.slice(-3).reverse().map(toSummary),
    upcomingGames: upcoming.slice(0, 3).map(toSummary),
  };
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

/**
 * Every player in the league for a season — the national counterpart to the
 * Team Hub roster. Same per-team league snapshot the browse pages use, but
 * flattened across all teams with each player's team name + conference joined
 * on (for the national Players page's Team column + team/conference filters).
 * Players whose team index doesn't resolve to a real team (free-agent/pool
 * placeholders) are dropped so the list is genuinely "players on NCAA teams".
 */
export function getAllLeaguePlayers(dynastyId: string, seasonId?: number): NationalPlayer[] | null {
  const resolved = resolveSeasonId(dynastyId, seasonId);
  if (resolved === undefined) return null;
  const league = getSnapshot<LeagueRosterData>(resolved, 'leagueRoster');
  if (!league) return null;
  const teams = getSnapshot<TeamsSnapshotEntry[]>(resolved, 'teams') ?? [];
  const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));
  const confByIndex = new Map(teams.map((t) => [t.teamIndex, t.conferenceName ?? null]));
  const statByPlayer = new Map(league.stats.map((s) => [s.playerId, s]));

  return league.players
    .filter((p) => nameByIndex.has(p.teamIndex))
    .map((p) => ({
      ...p,
      teamDisplayName: nameByIndex.get(p.teamIndex) as string,
      conferenceName: confByIndex.get(p.teamIndex) ?? null,
      seasonStat: statByPlayer.get(p.id) ?? null,
    }));
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
