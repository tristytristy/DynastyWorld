import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { getLeaguePortraitMap } from './getLeaguePortraits';
import type { AwardsData } from '../extractors/extract-awards';
import type { RosterPlayerData } from '../extractors/extract-roster';
import type { TeamData } from '../extractors/extract-teams';
import type { GameData } from '../extractors/extract-schedule';
import type {
  AwardsOverview,
  HeismanCandidate,
  HonorRosterEntry,
  LeagueAward,
  TeamHonorCounts,
  WeeklyHonor,
} from '../shared/types';

const PRESEASON_MARKER = '_PRE';

function isPreseasonHonor(awardType: string): boolean {
  return awardType.includes(PRESEASON_MARKER);
}

function countHonors(roster: HonorRosterEntry[], teamName: string): TeamHonorCounts {
  const forTeam = roster.filter((entry) => entry.teamDisplayName === teamName);
  const count = (predicate: (awardType: string) => boolean) =>
    forTeam.filter((entry) => predicate(entry.awardType)).length;

  return {
    allAmericanFirst: count((t) => t === 'ALL_AM_1ST'),
    allAmericanSecond: count((t) => t === 'ALL_AM_2ND'),
    allAmericanFreshman: count((t) => t === 'ALL_AM_FR'),
    allConferenceFirst: count((t) => t === 'ALL_AM_1ST_CONF'),
    allConferenceSecond: count((t) => t === 'ALL_AM_2ND_CONF'),
    allConferenceFreshman: count((t) => t === 'ALL_AM_FR_CONF'),
  };
}

/**
 * Reads the season's awards snapshot for a dynasty. `leagueAwards` covers
 * every real single-winner season award leaguewide (Heisman is split out
 * separately as heismanWinner/heismanFinalists); `honorsRoster` is every
 * All-American/All-Conference selection leaguewide (not just the user's
 * team), for the honors roster browser; `weeklyHonors` is the user's own
 * team's weekly nods, joined against the schedule for that week's opponent.
 */
export function getAwards(dynastyId: string, seasonId?: number): AwardsOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((t) => t.teamIndex === season.userTeamId);
  const teamName = userTeam?.displayName ?? dynasty.teamName ?? '';

  const awards = getSnapshot<AwardsData>(season.id, 'awards');
  if (!awards) {
    return {
      teamName,
      leagueAwards: [],
      heismanWinner: null,
      heismanFinalists: [],
      teamHonorCounts: countHonors([], teamName),
      honorsRoster: [],
      weeklyHonors: [],
      conferences: [],
      userConferenceName: userTeam?.conferenceName ?? null,
    };
  }

  const leaguePortraits = getLeaguePortraitMap(season.id);

  const leagueAwards: LeagueAward[] = awards.leagueAwards.map((a) => ({
    awardType: a.awardType,
    playerId: a.playerId,
    winnerName: `${a.firstName} ${a.lastName}`,
    teamDisplayName: a.teamDisplayName,
    position: a.position,
    isUserTeam: a.teamDisplayName === teamName,
    portraitAssetName: a.playerId !== null ? (leaguePortraits.get(a.playerId) ?? null) : null,
  }));

  const heismanCandidates: HeismanCandidate[] = awards.heismanRanking.map((h) => ({
    rank: h.rank,
    playerId: h.playerId,
    playerName: `${h.firstName} ${h.lastName}`,
    position: h.position,
    teamDisplayName: h.teamDisplayName,
    isUserTeam: h.teamDisplayName === teamName,
    portraitAssetName: leaguePortraits.get(h.playerId) ?? null,
  }));
  const heismanWinner = heismanCandidates.find((h) => h.rank === 0) ?? null;
  const heismanFinalists = heismanCandidates.filter((h) => h.rank > 0);

  const honorsRoster: HonorRosterEntry[] = awards.leagueAllAmericans
    .filter((a) => !isPreseasonHonor(a.awardType))
    .map((a) => ({
      playerId: a.playerId,
      playerName: `${a.firstName} ${a.lastName}`,
      position: a.position,
      teamDisplayName: a.teamDisplayName,
      conferenceName: a.conferenceName,
      awardType: a.awardType,
      isUserTeam: a.teamDisplayName === teamName,
      portraitAssetName: leaguePortraits.get(a.playerId) ?? null,
    }));

  const roster = getSnapshot<RosterPlayerData[]>(season.id, 'roster') ?? [];
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const schedule = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const gameByWeek = new Map(schedule.map((g) => [g.week, g]));

  const weeklyHonors: WeeklyHonor[] = awards.weeklyHonors
    .map((a): WeeklyHonor | null => {
      const player = rosterById.get(a.playerId);
      if (!player) return null;
      const game = gameByWeek.get(a.week);
      const opponent = game ? (game.homeTeamIndex === season.userTeamId ? game.awayTeamName : game.homeTeamName) : null;
      return {
        week: a.week,
        awardType: a.awardType,
        playerId: a.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        opponent,
        portraitAssetName: player.portraitAssetName,
      };
    })
    .filter((h): h is WeeklyHonor => h !== null)
    .sort((a, b) => a.week - b.week);

  const conferenceSet = new Set(teams.map((t) => t.conferenceName).filter((name): name is string => name !== null));
  const userConferenceName = userTeam?.conferenceName ?? null;
  const conferences = [...conferenceSet].sort((a, b) => a.localeCompare(b));
  if (userConferenceName) {
    const index = conferences.indexOf(userConferenceName);
    if (index > 0) {
      conferences.splice(index, 1);
      conferences.unshift(userConferenceName);
    }
  }

  return {
    teamName,
    leagueAwards,
    heismanWinner,
    heismanFinalists,
    teamHonorCounts: countHonors(honorsRoster, teamName),
    honorsRoster,
    weeklyHonors,
    conferences,
    userConferenceName,
  };
}
