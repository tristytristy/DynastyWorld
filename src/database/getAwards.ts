import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { getLeaguePortraitMap } from './getLeaguePortraits';
import type { AwardsData, LeagueAwardData } from '../extractors/extract-awards';
import type { RosterPlayerData } from '../extractors/extract-roster';
import type { TeamData } from '../extractors/extract-teams';
import type { GameData } from '../extractors/extract-schedule';
import type {
  AwardsOverview,
  HeismanCandidate,
  HonorRosterEntry,
  LeagueAward,
  PreseasonTeamHonorCounts,
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

function countPreseasonHonors(roster: HonorRosterEntry[], teamName: string): PreseasonTeamHonorCounts {
  const forTeam = roster.filter((entry) => entry.teamDisplayName === teamName);
  const count = (predicate: (awardType: string) => boolean) =>
    forTeam.filter((entry) => predicate(entry.awardType)).length;

  return {
    allAmericanFirst: count((t) => t === 'ALL_AM_1ST_PRE'),
    allAmericanSecond: count((t) => t === 'ALL_AM_2ND_PRE'),
    allConferenceFirst: count((t) => t === 'ALL_AM_1ST_PRE_CONF'),
    allConferenceSecond: count((t) => t === 'ALL_AM_2ND_PRE_CONF'),
  };
}

/**
 * HAS THIS SEASON'S SILVERWARE ACTUALLY BEEN HANDED OUT?
 *
 * The season's own postseason evidence: marquee awards, or EARNED (not
 * preseason) All-America selections. Both are `PlayerAward` rows the game writes
 * only once a season finishes, which makes them exactly the signal "has this
 * been decided" — and there is no cleaner one, since the save carries no
 * "awards done" flag of its own.
 *
 * ONE DEFINITION, TWO CONSUMERS, and that is the point of exporting it. It
 * decides whether the Heisman is folded into the marquee awards below, AND
 * whether the surfaces that show the Heisman call the man at rank 0 the WINNER
 * or the LEADER. Those have to agree: a page that crowns a champion while his
 * trophy is deliberately withheld from the trophy case is the app contradicting
 * itself in two places at once.
 */
export function seasonAwardsDecided(awards: AwardsData): boolean {
  return (
    awards.leagueAwards.length > 0 ||
    awards.leagueAllAmericans.some((a) => !isPreseasonHonor(a.awardType))
  );
}

/**
 * THE HEISMAN, FOLDED BACK IN WITH THE AWARDS IT BELONGS BESIDE.
 *
 * User report (2026-08-07): a UCLA player won the 2028 Heisman, and it appeared
 * neither on his Journey nor in the Trophy Room. The award page showed it,
 * because that page reads `heismanRanking` directly — and that ranking is the
 * ONLY place the Heisman has ever lived. `extractAwards` keeps `leagueAwards` to
 * `MARQUEE_PLAYER_TYPES`, derived from the curated `AWARD_DISPLAY_ORDER`, which
 * deliberately omits HEISMAN so the Annual Awards *list* doesn't repeat the hero
 * panel above it. Everything else in the app reads a player's and a program's
 * honours from `leagueAwards`, so the biggest award in the sport was the one
 * award that reached none of them.
 *
 * Derived at QUERY time, not fixed in the extractor, so every dynasty already in
 * an archive is repaired without a re-sync — the ranking is in every awards
 * snapshot already taken. A future sync that does carry a real HEISMAN row is
 * handled too: an existing row always wins, and nothing is synthesised.
 *
 * THE RANKING IS A LIVE RACE, NOT A RESULT — rank 0 mid-season is the current
 * leader, and writing him into a permanent Journey entry and a trophy case would
 * invent an award nobody has won. (Confirmed on a real week-5 save: four ranked
 * candidates, zero awards handed out.) `seasonAwardsDecided` above is the gate,
 * and the same one the surfaces use to decide whether to say "winner".
 */
export function resolveLeagueAwards(awards: AwardsData): LeagueAwardData[] {
  if (awards.leagueAwards.some((a) => a.awardType === 'HEISMAN')) return awards.leagueAwards;

  const winner = awards.heismanRanking.find((h) => h.rank === 0);
  if (!winner) return awards.leagueAwards;

  if (!seasonAwardsDecided(awards)) return awards.leagueAwards;

  return [
    ...awards.leagueAwards,
    {
      awardType: 'HEISMAN',
      playerId: winner.playerId,
      firstName: winner.firstName,
      lastName: winner.lastName,
      teamDisplayName: winner.teamDisplayName,
      position: winner.position,
    },
  ];
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
      heismanDecided: false,
      teamHonorCounts: countHonors([], teamName),
      honorsRoster: [],
      preseasonHonorsRoster: [],
      preseasonTeamHonorCounts: countPreseasonHonors([], teamName),
      weeklyHonors: [],
      conferences: [],
      userConferenceName: userTeam?.conferenceName ?? null,
    };
  }

  const leaguePortraits = getLeaguePortraitMap(season.id);

  const leagueAwards: LeagueAward[] = resolveLeagueAwards(awards).map((a) => ({
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
  /*
    THE RANKING IS A LIVE RACE UNTIL THE SEASON ENDS. rank 0 mid-season is the
    current leader, not a winner — confirmed on a real week-5 save: four ranked
    candidates, zero awards handed out. The candidates are still worth showing
    (a Heisman race IS the story in November); the label is what has to change.
  */
  const heismanDecided = seasonAwardsDecided(awards);

  const toHonorEntry = (a: (typeof awards.leagueAllAmericans)[number]): HonorRosterEntry => ({
    playerId: a.playerId,
    playerName: `${a.firstName} ${a.lastName}`,
    position: a.position,
    teamDisplayName: a.teamDisplayName,
    conferenceName: a.conferenceName,
    awardType: a.awardType,
    isUserTeam: a.teamDisplayName === teamName,
    portraitAssetName: leaguePortraits.get(a.playerId) ?? null,
  });

  // Split the earned postseason honors from the preseason (`_PRE`) watch list —
  // both are year-scoped already (extract-awards.ts), but a prediction must
  // never render as an earned award, so the UI gets them as two lists.
  const honorsRoster: HonorRosterEntry[] = awards.leagueAllAmericans
    .filter((a) => !isPreseasonHonor(a.awardType))
    .map(toHonorEntry);
  const preseasonHonorsRoster: HonorRosterEntry[] = awards.leagueAllAmericans
    .filter((a) => isPreseasonHonor(a.awardType))
    .map(toHonorEntry);

  const roster = getSnapshot<RosterPlayerData[]>(season.id, 'roster') ?? [];
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  // The `schedule` snapshot is LEAGUE-WIDE (every game in the country), so many
  // games share each week. Filter to the honored team's OWN games first —
  // otherwise the week→game map collapses to some arbitrary team's game and the
  // weekly-honor opponent shows an unrelated school (fixed 2026-07-24).
  const schedule = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const gameByWeek = new Map(
    schedule
      .filter((g) => g.homeTeamIndex === season.userTeamId || g.awayTeamIndex === season.userTeamId)
      .map((g) => [g.week, g]),
  );

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
    heismanDecided,
    teamHonorCounts: countHonors(honorsRoster, teamName),
    honorsRoster,
    preseasonHonorsRoster,
    preseasonTeamHonorCounts: countPreseasonHonors(preseasonHonorsRoster, teamName),
    weeklyHonors,
    conferences,
    userConferenceName,
  };
}
