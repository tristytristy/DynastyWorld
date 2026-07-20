import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { ConferenceChampionshipData } from '../extractors/extract-league-history';
import type { TeamData } from '../extractors/extract-teams';
import type {
  ConferenceDivisionGroup,
  ConferenceStandingTeam,
  ConferenceStandingsGroup,
  StandingsOverview,
} from '../shared/types';

function getConferenceId(conferenceName: string): string {
  return conferenceName;
}

type LegacyConferenceChampionshipData = {
  conferenceName: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
};

function normalizeConferenceChampionships(
  snapshot: ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null | undefined,
  userTeam: TeamData | undefined,
): ConferenceChampionshipData[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot)) return snapshot;
  if (!userTeam || userTeam.conferenceName !== snapshot.conferenceName) return [];

  return [
    {
      conferenceName: snapshot.conferenceName,
      winningTeamName: userTeam.displayName,
      losingTeamName: snapshot.opponentName,
      winningTeamScore: snapshot.teamScore,
      losingTeamScore: snapshot.opponentScore,
    },
  ];
}

function normalizeRank(rank: number): number | null {
  return rank > 0 ? rank : null;
}

function comparePollRank(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Exact in-conference tiebreak rules are not exposed anywhere in the save, so
 * this uses an honest, deterministic editorial sort: conference record first,
 * then overall record, then current AP rank, then team name.
 */
type StandingSeed = Omit<ConferenceStandingTeam, 'place' | 'isConferenceChampion' | 'isDivisionLeader'> & {
  divisionStanding: number;
};

function sortTeams(a: StandingSeed, b: StandingSeed): number {
  if (a.conferenceWins !== b.conferenceWins) return b.conferenceWins - a.conferenceWins;
  if (a.conferenceLosses !== b.conferenceLosses) return a.conferenceLosses - b.conferenceLosses;
  if (a.overallWins !== b.overallWins) return b.overallWins - a.overallWins;
  if (a.overallLosses !== b.overallLosses) return a.overallLosses - b.overallLosses;

  const pollCompare = comparePollRank(a.mediaPollRank, b.mediaPollRank);
  if (pollCompare !== 0) return pollCompare;

  return a.teamName.localeCompare(b.teamName);
}

/** Within a division, order by the game's own division standing (0 = leader); fall back to the shared editorial sort if standings are unset/tied. */
function sortByDivision(a: StandingSeed, b: StandingSeed): number {
  if (a.divisionStanding !== b.divisionStanding) return a.divisionStanding - b.divisionStanding;
  return sortTeams(a, b);
}

function toStandingTeam(team: TeamData, userTeamIndex: number): StandingSeed {
  return {
    teamIndex: team.teamIndex,
    teamName: team.displayName,
    overallWins: team.confWins + team.nonConfWins,
    overallLosses: team.confLosses + team.nonConfLosses,
    conferenceWins: team.confWins,
    conferenceLosses: team.confLosses,
    mediaPollRank: normalizeRank(team.mediaPollRank),
    coachesPollRank: normalizeRank(team.coachesPollRank),
    cfpRank: normalizeRank(team.cfpRank),
    isUserTeam: team.teamIndex === userTeamIndex,
    divisionName: team.divisionName,
    divisionWins: team.divisionWins,
    divisionLosses: team.divisionLosses,
    divisionStanding: team.divisionStanding,
  };
}

export function getStandings(dynastyId: string, seasonId?: number): StandingsOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const userTeamIndex = season.userTeamId;
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((team) => team.teamIndex === userTeamIndex);
  const teamName = userTeam?.displayName ?? dynasty.teamName ?? dynasty.label;
  const conferenceChampionships = normalizeConferenceChampionships(
    getSnapshot<ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null>(
      season.id,
      'conferenceChampionship',
    ),
    userTeam,
  );

  const grouped = new Map<string, { conferenceName: string; teams: TeamData[] }>();
  for (const team of teams) {
    if (team.conferenceName === null) continue;

    const id = getConferenceId(team.conferenceName);
    const existing = grouped.get(id);
    if (existing) {
      existing.teams.push(team);
    } else {
      grouped.set(id, { conferenceName: team.conferenceName, teams: [team] });
    }
  }

  const groups: ConferenceStandingsGroup[] = [...grouped.entries()]
    .map(([id, group]) => {
      const championTeamName =
        conferenceChampionships.find((entry) => entry.conferenceName === group.conferenceName)?.winningTeamName ??
        null;

      const seeds = group.teams.map((team) => toStandingTeam(team, userTeamIndex));

      // A conference counts as "divided" only when its members carry 2+ distinct
      // real division names — a single unnamed/placeholder division is not a split.
      const divisionNames = [...new Set(seeds.map((s) => s.divisionName).filter((n): n is string => !!n))].sort();
      const divided = divisionNames.length >= 2;

      const finalize = (seed: StandingSeed, index: number, isDivisionLeader: boolean): ConferenceStandingTeam => ({
        place: index + 1,
        ...seed,
        isConferenceChampion: championTeamName === seed.teamName,
        isDivisionLeader,
      });

      let teamsSorted: ConferenceStandingTeam[];
      let divisions: ConferenceDivisionGroup[] | null = null;

      if (divided) {
        divisions = divisionNames.map((name) => {
          const divisionTeams = seeds
            .filter((s) => s.divisionName === name)
            .sort(sortByDivision)
            .map((seed, index) => finalize(seed, index, seed.divisionStanding === 0));
          return { name, teams: divisionTeams };
        });
        // Flat `teams` still provided (whole conference by conference record) so
        // any consumer that ignores divisions keeps working.
        teamsSorted = [...seeds].sort(sortTeams).map((seed, index) =>
          finalize(seed, index, seed.divisionStanding === 0),
        );
      } else {
        teamsSorted = [...seeds].sort(sortTeams).map((seed, index) => finalize(seed, index, false));
      }

      return {
        id,
        conferenceName: group.conferenceName,
        label: group.conferenceName,
        teams: teamsSorted,
        divisions,
        top25Count: teamsSorted.filter((team) => team.mediaPollRank !== null && team.mediaPollRank <= 25).length,
        nonConferenceWins: group.teams.reduce((sum, team) => sum + team.nonConfWins, 0),
        nonConferenceLosses: group.teams.reduce((sum, team) => sum + team.nonConfLosses, 0),
        overallWins: group.teams.reduce((sum, team) => sum + team.confWins + team.nonConfWins, 0),
        overallLosses: group.teams.reduce((sum, team) => sum + team.confLosses + team.nonConfLosses, 0),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const userConferenceId = userTeam?.conferenceName ? getConferenceId(userTeam.conferenceName) : null;
  if (userConferenceId) {
    const index = groups.findIndex((group) => group.id === userConferenceId);
    if (index > 0) {
      const [group] = groups.splice(index, 1);
      groups.unshift(group);
    }
  }

  return {
    teamName,
    userConferenceId,
    groups,
  };
}
