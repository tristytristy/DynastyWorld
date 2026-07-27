import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { AwardsData } from '../extractors/extract-awards';
import type { CoachData } from '../extractors/extract-coaches';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type {
  NcaaHubCfpEntry,
  NcaaHubCoachSpotlight,
  NcaaHubConferenceLeader,
  NcaaHubGameFeature,
  NcaaHubHeismanFeature,
  NcaaHubOverview,
  NcaaHubRecordWatchEntry,
  NcaaHubRecruitingClassEntry,
  NcaaHubTop25Entry,
} from '../shared/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The catch-all teamIndex the game parks every non-FBS placeholder under
 * (Practice + the five "FCS East/West/…" buckets all share 255). They carry
 * sentinel rank values (e.g. cfpRank 255) that would otherwise leak into the
 * NCAA hub's rankings/playoff picture, so they're filtered out everywhere here —
 * the NCAA hub is an FBS view.
 */
const FCS_POOL_TEAM_INDEX = 255;

function normalizeRank(rank: number): number | null {
  return rank > 0 ? rank : null;
}

function formatKickoff(minutes: number): string {
  if (minutes <= 0) return 'TBD';
  const hour24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}

function formatGameDate(month: number, day: number): string {
  if (month <= 0 || day <= 0 || month > 12) return 'TBD';
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function overallWins(team: TeamData): number {
  return team.confWins + team.nonConfWins;
}

function overallLosses(team: TeamData): number {
  return team.confLosses + team.nonConfLosses;
}

function buildTop25(teams: TeamData[], userTeamIndex: number): NcaaHubTop25Entry[] {
  return teams
    .filter((team) => team.mediaPollRank > 0 && team.mediaPollRank <= 25)
    .sort((a, b) => a.mediaPollRank - b.mediaPollRank)
    .map((team) => ({
      rank: team.mediaPollRank,
      teamName: team.displayName,
      conferenceName: team.conferenceName,
      wins: overallWins(team),
      losses: overallLosses(team),
      coachesRank: normalizeRank(team.coachesPollRank),
      cfpRank: normalizeRank(team.cfpRank),
      isUserTeam: team.teamIndex === userTeamIndex,
    }));
}

function buildHeismanFeature(awards: AwardsData | undefined): NcaaHubHeismanFeature | null {
  const first = awards?.heismanRanking[0];
  if (!first) return null;

  const winner = awards?.heismanRanking.find((entry) => entry.rank === 0) ?? first;
  return {
    label: winner.rank === 0 ? 'Heisman Winner' : 'Heisman Leader',
    rank: winner.rank,
    playerId: winner.playerId,
    playerName: `${winner.firstName} ${winner.lastName}`,
    position: winner.position,
    teamDisplayName: winner.teamDisplayName,
  };
}

function buildPlayoffPicture(teams: TeamData[], userTeamIndex: number): NcaaHubCfpEntry[] {
  return teams
    .filter((team) => team.cfpRank > 0)
    .sort((a, b) => a.cfpRank - b.cfpRank)
    .slice(0, 12)
    .map((team) => ({
      rank: team.cfpRank,
      teamName: team.displayName,
      conferenceName: team.conferenceName,
      wins: overallWins(team),
      losses: overallLosses(team),
      isUserTeam: team.teamIndex === userTeamIndex,
    }));
}

function buildRecruitingBuzz(teams: TeamData[], userTeamIndex: number): NcaaHubRecruitingClassEntry[] {
  return teams
    .filter((team) => team.topClassRank > 0)
    .sort((a, b) => a.topClassRank - b.topClassRank)
    .slice(0, 8)
    .map((team) => ({
      rank: team.topClassRank,
      teamName: team.displayName,
      conferenceName: team.conferenceName,
      conferenceRank: team.topClassConferenceRank > 0 ? team.topClassConferenceRank : null,
      isUserTeam: team.teamIndex === userTeamIndex,
    }));
}

function buildRecordWatch(
  teams: TeamData[],
  userTeamIndex: number,
  targetLosses: number,
  limit: number,
): NcaaHubRecordWatchEntry[] {
  return teams
    .filter((team) => overallWins(team) > 0 && overallLosses(team) === targetLosses)
    .sort((a, b) => {
      const aRank = normalizeRank(a.mediaPollRank) ?? 99;
      const bRank = normalizeRank(b.mediaPollRank) ?? 99;
      if (aRank !== bRank) return aRank - bRank;

      const aWins = overallWins(a);
      const bWins = overallWins(b);
      if (aWins !== bWins) return bWins - aWins;

      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, limit)
    .map((team) => ({
      teamName: team.displayName,
      conferenceName: team.conferenceName,
      wins: overallWins(team),
      losses: overallLosses(team),
      mediaRank: normalizeRank(team.mediaPollRank),
      isUserTeam: team.teamIndex === userTeamIndex,
    }));
}

function buildConferenceLeaders(teams: TeamData[], userTeamIndex: number): NcaaHubConferenceLeader[] {
  const grouped = new Map<string, TeamData[]>();
  for (const team of teams) {
    if (!team.conferenceName) continue;
    const current = grouped.get(team.conferenceName) ?? [];
    current.push(team);
    grouped.set(team.conferenceName, current);
  }

  return [...grouped.entries()]
    .map(([conferenceName, conferenceTeams]) => {
      const leader = [...conferenceTeams].sort((a, b) => {
        if (a.confWins !== b.confWins) return b.confWins - a.confWins;
        if (a.confLosses !== b.confLosses) return a.confLosses - b.confLosses;

        const aOverallWins = overallWins(a);
        const bOverallWins = overallWins(b);
        if (aOverallWins !== bOverallWins) return bOverallWins - aOverallWins;

        const aOverallLosses = overallLosses(a);
        const bOverallLosses = overallLosses(b);
        if (aOverallLosses !== bOverallLosses) return aOverallLosses - bOverallLosses;

        const aRank = normalizeRank(a.mediaPollRank) ?? 99;
        const bRank = normalizeRank(b.mediaPollRank) ?? 99;
        if (aRank !== bRank) return aRank - bRank;

        return a.displayName.localeCompare(b.displayName);
      })[0];

      return {
        conferenceName,
        teamName: leader.displayName,
        conferenceWins: leader.confWins,
        conferenceLosses: leader.confLosses,
        overallWins: overallWins(leader),
        overallLosses: overallLosses(leader),
        mediaRank: normalizeRank(leader.mediaPollRank),
        isUserTeam: leader.teamIndex === userTeamIndex,
      };
    })
    .sort((a, b) => {
      if (a.mediaRank !== null || b.mediaRank !== null) {
        return (a.mediaRank ?? 99) - (b.mediaRank ?? 99);
      }
      if (a.overallWins !== b.overallWins) return b.overallWins - a.overallWins;
      return a.conferenceName.localeCompare(b.conferenceName);
    });
}

function gameRanks(
  game: GameData,
  rankByTeamIndex: Map<number, number | null>,
): { homeRank: number | null; awayRank: number | null } {
  return {
    homeRank: game.homeTeamIndex !== null ? rankByTeamIndex.get(game.homeTeamIndex) ?? null : null,
    awayRank: game.awayTeamIndex !== null ? rankByTeamIndex.get(game.awayTeamIndex) ?? null : null,
  };
}

function toGameFeature(
  game: GameData,
  rankByTeamIndex: Map<number, number | null>,
  summary: string,
): NcaaHubGameFeature | null {
  if (!game.homeTeamName || !game.awayTeamName) return null;
  const { homeRank, awayRank } = gameRanks(game, rankByTeamIndex);

  return {
    week: game.week,
    date: formatGameDate(game.gameMonth, game.gameDay),
    dayOfWeek: game.dayOfWeek,
    kickoffTime: formatKickoff(game.kickoffMinutes),
    broadcastScope: game.broadcastScope,
    homeTeamName: game.homeTeamName,
    awayTeamName: game.awayTeamName,
    homeRank,
    awayRank,
    homeScore: game.status !== 'Unplayed' ? game.homeScore : null,
    awayScore: game.status !== 'Unplayed' ? game.awayScore : null,
    isBowlGame: game.isBowlGame,
    isNationalChampionship: game.isNationalChampionship,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    isNeutralSite: game.isNeutralSite,
    summary,
  };
}

function compareUpcomingGames(
  a: GameData,
  b: GameData,
  rankByTeamIndex: Map<number, number | null>,
): number {
  const aRanks = gameRanks(a, rankByTeamIndex);
  const bRanks = gameRanks(b, rankByTeamIndex);
  const aRanked = Number(aRanks.homeRank !== null) + Number(aRanks.awayRank !== null);
  const bRanked = Number(bRanks.homeRank !== null) + Number(bRanks.awayRank !== null);
  if (aRanked !== bRanked) return bRanked - aRanked;

  const aCombined = (aRanks.homeRank ?? 40) + (aRanks.awayRank ?? 40);
  const bCombined = (bRanks.homeRank ?? 40) + (bRanks.awayRank ?? 40);
  if (aCombined !== bCombined) return aCombined - bCombined;

  if (a.kickoffMinutes !== b.kickoffMinutes) return a.kickoffMinutes - b.kickoffMinutes;

  return (a.homeTeamName ?? '').localeCompare(b.homeTeamName ?? '');
}

function buildGameOfTheWeek(
  games: GameData[],
  rankByTeamIndex: Map<number, number | null>,
): NcaaHubGameFeature | null {
  if (games.length === 0) return null;

  const picked = [...games].sort((a, b) => {
    const aRanks = gameRanks(a, rankByTeamIndex);
    const bRanks = gameRanks(b, rankByTeamIndex);
    const aRanked = Number(aRanks.homeRank !== null) + Number(aRanks.awayRank !== null);
    const bRanked = Number(bRanks.homeRank !== null) + Number(bRanks.awayRank !== null);
    if (aRanked !== bRanked) return bRanked - aRanked;

    const aCombined = (aRanks.homeRank ?? 40) + (aRanks.awayRank ?? 40);
    const bCombined = (bRanks.homeRank ?? 40) + (bRanks.awayRank ?? 40);
    if (aCombined !== bCombined) return aCombined - bCombined;

    const aMargin = Math.abs(a.homeScore - a.awayScore);
    const bMargin = Math.abs(b.homeScore - b.awayScore);
    if (aMargin !== bMargin) return aMargin - bMargin;

    return b.homeScore + b.awayScore - (a.homeScore + a.awayScore);
  })[0];

  const winner =
    picked.homeScore > picked.awayScore ? picked.homeTeamName : picked.awayScore > picked.homeScore ? picked.awayTeamName : null;
  const summary =
    winner && picked.homeTeamName && picked.awayTeamName
      ? `${winner} won ${Math.max(picked.homeScore, picked.awayScore)}-${Math.min(picked.homeScore, picked.awayScore)}`
      : `Finished ${picked.homeScore}-${picked.awayScore}`;

  return toGameFeature(picked, rankByTeamIndex, summary);
}

function buildUpsetOfTheWeek(
  games: GameData[],
  rankByTeamIndex: Map<number, number | null>,
): NcaaHubGameFeature | null {
  const candidates = games
    .map((game) => {
      if (!game.homeTeamName || !game.awayTeamName) return null;
      if (game.homeScore === game.awayScore) return null;

      const homeRank = game.homeTeamIndex !== null ? rankByTeamIndex.get(game.homeTeamIndex) ?? null : null;
      const awayRank = game.awayTeamIndex !== null ? rankByTeamIndex.get(game.awayTeamIndex) ?? null : null;
      const homeEffective = homeRank ?? 40;
      const awayEffective = awayRank ?? 40;

      const homeWon = game.homeScore > game.awayScore;
      const winnerRank = homeWon ? homeEffective : awayEffective;
      const loserRank = homeWon ? awayEffective : homeEffective;
      const swing = winnerRank - loserRank;
      if (swing <= 0) return null;

      const winnerName = homeWon ? game.homeTeamName : game.awayTeamName;
      const loserName = homeWon ? game.awayTeamName : game.homeTeamName;
      return {
        game,
        swing,
        summary: `${winnerName} upset ${loserName} ${Math.max(game.homeScore, game.awayScore)}-${Math.min(game.homeScore, game.awayScore)}`,
      };
    })
    .filter((candidate): candidate is { game: GameData; swing: number; summary: string } => candidate !== null)
    .sort((a, b) => b.swing - a.swing);

  if (candidates.length === 0) return null;
  return toGameFeature(candidates[0].game, rankByTeamIndex, candidates[0].summary);
}

function buildUpcomingGames(
  games: GameData[],
  rankByTeamIndex: Map<number, number | null>,
): NcaaHubGameFeature[] {
  return [...games]
    .sort((a, b) => compareUpcomingGames(a, b, rankByTeamIndex))
    .slice(0, 5)
    .map((game) => {
      const ranks = gameRanks(game, rankByTeamIndex);
      const rankedTeams = [ranks.homeRank, ranks.awayRank].filter((rank): rank is number => rank !== null);
      const summary =
        game.isNationalChampionship
          ? 'The national title game is on deck.'
          : game.isBowlGame && game.bowlName
            ? `${game.bowlName} spotlight`
            : rankedTeams.length > 0
              ? `${rankedTeams.length} ranked team${rankedTeams.length > 1 ? 's' : ''} in the matchup`
              : game.isNeutralSite
                ? 'Neutral-site watchlist matchup'
                : 'Next-week watchlist matchup';
      return toGameFeature(game, rankByTeamIndex, summary);
    })
    .filter((game): game is NcaaHubGameFeature => game !== null);
}

function buildCoachSpotlight(
  coaches: CoachData[],
  teams: TeamData[],
): NcaaHubCoachSpotlight | null {
  const teamByIndex = new Map(teams.map((team) => [team.teamIndex, team]));
  const candidates = coaches
    .filter((coach) => coach.position === 'HeadCoach')
    .map((coach) => {
      const team = teamByIndex.get(coach.teamIndex);
      if (!team) return null;

      const wins = overallWins(team);
      const losses = overallLosses(team);
      const rank = normalizeRank(team.mediaPollRank);
      const prestige = team.teamPrestige > 0 ? team.teamPrestige : null;
      const score =
        wins * 3 -
        losses * 1.5 +
        (rank ? Math.max(0, 26 - rank) : 0) -
        (prestige ?? 0) * 1.35;

      return { coach, team, wins, losses, rank, prestige, score };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        coach: CoachData;
        team: TeamData;
        wins: number;
        losses: number;
        rank: number | null;
        prestige: number | null;
        score: number;
      } => candidate !== null && candidate.wins > 0,
    )
    .sort((a, b) => b.score - a.score);

  const picked = candidates[0];
  if (!picked) return null;

  const prestigeText = picked.prestige === null ? 'unknown prestige' : `prestige ${picked.prestige}`;
  const rankText = picked.rank ? ` and sits at #${picked.rank}` : '';
  return {
    coachName: `${picked.coach.firstName} ${picked.coach.lastName}`,
    coachPortraitAssetName: picked.coach.portraitAssetName,
    teamName: picked.team.displayName,
    overallWins: picked.wins,
    overallLosses: picked.losses,
    mediaRank: picked.rank,
    teamPrestige: picked.prestige,
    reason: `${picked.team.displayName} is ${picked.wins}-${picked.losses}${rankText} with ${prestigeText}.`,
  };
}

export function getNcaaHub(dynastyId: string, seasonId?: number): NcaaHubOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const userTeamId = season.userTeamId;
  // Exclude the FCS/placeholder pool (index 255) up front so it never surfaces in
  // any NCAA-hub ranking, the playoff picture, conference leaders, etc.
  const teams = (getSnapshot<TeamData[]>(season.id, 'teams') ?? []).filter((t) => t.teamIndex !== FCS_POOL_TEAM_INDEX);
  const schedule = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const coaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
  const awards = getSnapshot<AwardsData>(season.id, 'awards');

  const rankByTeamIndex = new Map(teams.map((team) => [team.teamIndex, normalizeRank(team.mediaPollRank)]));
  const top25 = buildTop25(teams, userTeamId);
  const heismanFeature = buildHeismanFeature(awards);
  const playoffPicture = buildPlayoffPicture(teams, userTeamId);
  const recruitingBuzz = buildRecruitingBuzz(teams, userTeamId);
  const undefeatedWatch = buildRecordWatch(teams, userTeamId, 0, 8);
  const oneLossWatch = buildRecordWatch(teams, userTeamId, 1, 8);
  const conferenceLeaders = buildConferenceLeaders(teams, userTeamId);

  const playedWeeks = schedule.filter((game) => game.status !== 'Unplayed').map((game) => game.week);
  const latestPlayedWeek = playedWeeks.length > 0 ? Math.max(...playedWeeks) : null;
  const latestWeekGames =
    latestPlayedWeek === null ? [] : schedule.filter((game) => game.status !== 'Unplayed' && game.week === latestPlayedWeek);

  const unplayedWeeks = schedule.filter((game) => game.status === 'Unplayed').map((game) => game.week);
  const upcomingWeek = unplayedWeeks.length > 0 ? Math.min(...unplayedWeeks) : null;
  const upcomingWeekGames =
    upcomingWeek === null ? [] : schedule.filter((game) => game.status === 'Unplayed' && game.week === upcomingWeek);

  return {
    seasonYear: season.seasonYear,
    lastSyncedAt: season.extractedAt,
    top25,
    heismanFeature,
    gameOfTheWeek: buildGameOfTheWeek(latestWeekGames, rankByTeamIndex),
    upsetOfTheWeek: buildUpsetOfTheWeek(latestWeekGames, rankByTeamIndex),
    upcomingWeek,
    upcomingGames: buildUpcomingGames(upcomingWeekGames, rankByTeamIndex),
    coachSpotlight: buildCoachSpotlight(coaches, teams),
    playoffPicture,
    recruitingBuzz,
    undefeatedWatch,
    oneLossWatch,
    conferenceLeaders,
  };
}
