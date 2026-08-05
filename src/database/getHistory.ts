import { CFP_ROUND_NAMES } from '../shared/cfpBowls';
import { displayRank } from '../shared/pollRank';
import { getDynastyById, getRankingHistory, getSeasonsByDynasty, getSnapshot } from './helpers';
import { getSeasonGameContext } from './gameContext';
import type { AwardsData } from '../extractors/extract-awards';
import type { CoachData } from '../extractors/extract-coaches';
import type { ChampionSummary, ConferenceChampionshipData, YearSummaryData } from '../extractors/extract-league-history';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData, TeamRecordHolderData, TeamRecordStatType } from '../extractors/extract-teams';
import type {
  CareerCoachStats,
  LeagueHistoryYearEntry,
  ProgramHistoryCoachSummary,
  ProgramHistoryMilestone,
  ProgramHistoryNationalAward,
  ProgramHistoryOverview,
  ProgramHistoryRecordCategory,
  ProgramHistoryRecordHolder,
  ProgramHistorySeasonEntry,
} from '../shared/types';
import { isGamePlayed } from '../shared/gameStatus';

function toLeagueChampion(champion: ChampionSummary | null): LeagueHistoryYearEntry['nationalChampion'] {
  if (!champion) return null;
  return {
    teamName: champion.teamName,
    wins: champion.wins,
    losses: champion.losses,
    score: champion.score,
    rank: champion.rank,
    coachFirstName: champion.coachFirstName,
    coachLastName: champion.coachLastName,
  };
}

type LegacyConferenceChampionshipData = {
  conferenceName: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
};

type CoachAccumulator = ProgramHistoryCoachSummary;

const RECORD_CATEGORIES: {
  key: ProgramHistoryRecordCategory['key'];
  label: string;
  statType: TeamRecordStatType;
}[] = [
  { key: 'passYards', label: 'Passing Yards', statType: 'PassYards' },
  { key: 'passTds', label: 'Passing Touchdowns', statType: 'PassTds' },
  { key: 'rushYards', label: 'Rushing Yards', statType: 'RushYards' },
  { key: 'rushTds', label: 'Rushing Touchdowns', statType: 'RushTds' },
  { key: 'receivingYards', label: 'Receiving Yards', statType: 'ReceiveYards' },
  { key: 'receivingTds', label: 'Receiving Touchdowns', statType: 'ReceiveTDs' },
  { key: 'receivingCatches', label: 'Receptions', statType: 'ReceiveCatches' },
  { key: 'defensiveSacks', label: 'Sacks', statType: 'DefensiveSacks' },
  { key: 'defensiveInts', label: 'Interceptions', statType: 'DefensiveInts' },
];

function normalizeConferenceChampionships(
  snapshot: ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null | undefined,
  userTeamName: string | undefined,
): ConferenceChampionshipData[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot)) return snapshot;
  if (!userTeamName) return [];
  return [
    {
      conferenceName: snapshot.conferenceName,
      winningTeamName: userTeamName,
      losingTeamName: snapshot.opponentName,
      winningTeamScore: snapshot.teamScore,
      losingTeamScore: snapshot.opponentScore,
    },
  ];
}

function gameResult(game: GameData, userTeamIndex: number): 'W' | 'L' | 'T' | null {
  if (!isGamePlayed(game.status)) return null;
  const isHome = game.homeTeamIndex === userTeamIndex;
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  if (teamScore > opponentScore) return 'W';
  if (teamScore < opponentScore) return 'L';
  return 'T';
}

function classifyPostseasonKind(game: GameData): 'bowl' | 'cfp-round' | 'national-championship' {
  if (game.isNationalChampionship) return 'national-championship';
  if (game.bowlName && CFP_ROUND_NAMES.has(game.bowlName)) return 'cfp-round';
  return 'bowl';
}

function isPlayoffGame(game: GameData): boolean {
  return game.isNationalChampionship || (game.bowlName ? CFP_ROUND_NAMES.has(game.bowlName) : false);
}

function postseasonSummary(game: GameData | undefined, result: 'W' | 'L' | 'T' | null, wonTitle: boolean): string | null {
  if (!game || !game.bowlName) return null;
  const kind = classifyPostseasonKind(game);
  if (wonTitle) return 'National Champions';
  if (kind === 'national-championship') return 'National Championship appearance';
  if (kind === 'cfp-round') return `Reached ${game.bowlName}`;
  if (!result) return game.bowlName;
  return `${game.bowlName} (${result})`;
}

function addMilestone(milestones: ProgramHistoryMilestone[], seasonYear: number, label: string, detail: string): void {
  milestones.push({ seasonYear, label, detail });
}

/**
 * The rank a team carried into a game, from the point-in-time capture.
 *
 * The CFP number now leads once the committee has released one, with the media
 * poll carrying the rest of the season — the rule the game's own scoreboard
 * follows, and shared with every other rank surface so they cannot disagree.
 * This used to prefer the media poll, which made a program's history describe
 * late-season games with a different number than the game itself showed.
 */
function rankAtKickoff(mediaRank: number | null, cfpRank: number | null): number | null {
  return displayRank(mediaRank, cfpRank);
}

/** Poll thresholds a program crosses ONCE, best first — the climb, not a per-season report. */
const POLL_MILESTONES: { rank: number; label: string; detail: (teamName: string) => string }[] = [
  { rank: 1, label: 'Number One', detail: (t) => `${t} reached #1 in the country.` },
  { rank: 5, label: 'Top Five', detail: (t) => `${t} broke into the top five.` },
  { rank: 10, label: 'Top Ten', detail: (t) => `${t} broke into the top ten.` },
  { rank: 25, label: 'Ranked', detail: (t) => `${t} entered the national polls.` },
];

function ensureCoachSummary(map: Map<string, CoachAccumulator>, coachName: string): CoachAccumulator {
  const existing = map.get(coachName);
  if (existing) return existing;
  const created: CoachAccumulator = {
    coachName,
    seasons: 0,
    wins: 0,
    losses: 0,
    conferenceTitles: 0,
    nationalTitles: 0,
    playoffAppearances: 0,
    tenWinSeasons: 0,
  };
  map.set(coachName, created);
  return created;
}

function toRecordHolder(record: TeamRecordHolderData | undefined): ProgramHistoryRecordHolder | null {
  if (!record) return null;
  return {
    playerName: `${record.firstName} ${record.lastName}`.trim(),
    position: record.position,
    value: record.statValue,
    seasonYear: record.calendarYear,
  };
}

export function getHistory(dynastyId: string): ProgramHistoryOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const seasons = getSeasonsByDynasty(dynastyId).sort((a, b) => a.seasonYear - b.seasonYear);
  if (seasons.length === 0) return undefined;

  const milestones: ProgramHistoryMilestone[] = [];
  const seasonEntries: ProgramHistorySeasonEntry[] = [];
  const coachSummaries = new Map<string, CoachAccumulator>();

  let teamName = dynasty.teamName ?? dynasty.label;
  let latestUserTeam: TeamData | null = null;
  let headCoachName: string | null = null;
  let headCoachCareer: CareerCoachStats | null = null;
  const schoolsCoached: string[] = [];
  const nationalAwards: ProgramHistoryNationalAward[] = [];
  let dynastyWins = 0;
  let dynastyLosses = 0;
  let dynastyConferenceTitles = 0;
  let dynastyNationalTitles = 0;
  let dynastyPlayoffAppearances = 0;
  let dynastyBowlAppearances = 0;
  let dynastyBowlWins = 0;
  let dynastyTenWinSeasons = 0;
  let dynastyUndefeatedSeasons = 0;
  let bestMediaRank: number | null = null;
  let bestRecruitingClassRank: number | null = null;
  /**
   * Best rank reached in any PRIOR season — the gate for the poll milestones,
   * kept separate from `bestMediaRank` because that one is updated inside the
   * loop before the milestone check and so already includes the season being
   * judged. This one also counts mid-season weeks, which is where a program
   * usually touches its high-water mark before losing a game.
   */
  let bestRankBeforeThisSeason: number | null = null;

  for (const season of seasons) {
    if (season.userTeamId === null) continue;
    const seasonTeamId = season.userTeamId;
    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    const schedule = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
    const coaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
    const conferenceChampionship = normalizeConferenceChampionships(
      getSnapshot<ConferenceChampionshipData[] | LegacyConferenceChampionshipData | null>(
        season.id,
        'conferenceChampionship',
      ),
      teamName,
    );

    const userTeam = teams.find((team) => team.teamIndex === seasonTeamId);
    if (!userTeam) continue;
    latestUserTeam = userTeam;
    teamName = userTeam.displayName;
    if (schoolsCoached[schoolsCoached.length - 1] !== userTeam.displayName) {
      schoolsCoached.push(userTeam.displayName);
    }

    const awardsSnapshot = getSnapshot<AwardsData>(season.id, 'awards');
    for (const award of awardsSnapshot?.leagueAwards ?? []) {
      if (award.teamDisplayName !== userTeam.displayName) continue;
      nationalAwards.push({
        seasonYear: season.seasonYear,
        awardType: award.awardType,
        playerName: `${award.firstName} ${award.lastName}`.trim(),
      });
    }

    const wins = userTeam.confWins + userTeam.nonConfWins;
    const losses = userTeam.confLosses + userTeam.nonConfLosses;
    dynastyWins += wins;
    dynastyLosses += losses;
    if (userTeam.mediaPollRank > 0) {
      bestMediaRank =
        bestMediaRank === null ? userTeam.mediaPollRank : Math.min(bestMediaRank, userTeam.mediaPollRank);
    }
    if (userTeam.topClassRank > 0) {
      bestRecruitingClassRank =
        bestRecruitingClassRank === null ? userTeam.topClassRank : Math.min(bestRecruitingClassRank, userTeam.topClassRank);
    }

    const teamGames = schedule.filter(
      (game) => game.homeTeamIndex === seasonTeamId || game.awayTeamIndex === seasonTeamId,
    );
    const postseasonGames = teamGames
      .filter((game) => game.isBowlGame && isGamePlayed(game.status) && game.bowlName)
      .sort((a, b) => b.week - a.week);
    const latestPostseason = postseasonGames[0];
    const latestPostseasonResult = latestPostseason ? gameResult(latestPostseason, seasonTeamId) : null;
    const nationalChampionshipGame = teamGames.find((game) => game.isNationalChampionship && isGamePlayed(game.status));
    const nationalChampion = nationalChampionshipGame
      ? gameResult(nationalChampionshipGame, seasonTeamId) === 'W'
      : false;
    const conferenceChampion = conferenceChampionship.some((entry) => entry.winningTeamName === userTeam.displayName);
    const playoffAppearance = postseasonGames.some(isPlayoffGame);

    if (conferenceChampion) {
      dynastyConferenceTitles++;
      addMilestone(milestones, season.seasonYear, 'Conference Title', `${userTeam.conferenceName ?? 'Conference'} champions`);
    }
    if (nationalChampion) {
      dynastyNationalTitles++;
      addMilestone(milestones, season.seasonYear, 'National Title', 'Finished the season on top of college football.');
    }
    if (playoffAppearance) {
      dynastyPlayoffAppearances++;
      addMilestone(
        milestones,
        season.seasonYear,
        'Playoff Appearance',
        latestPostseason?.bowlName ? `Reached the postseason bracket: ${latestPostseason.bowlName}.` : 'Reached the College Football Playoff.',
      );
    }
    if (latestPostseason && classifyPostseasonKind(latestPostseason) === 'bowl') {
      dynastyBowlAppearances++;
      if (latestPostseasonResult === 'W') {
        dynastyBowlWins++;
        addMilestone(
          milestones,
          season.seasonYear,
          'Bowl Win',
          `Won the ${latestPostseason.bowlName}.`,
        );
      }
    }
    if (wins >= 10) {
      dynastyTenWinSeasons++;
      addMilestone(milestones, season.seasonYear, '10-Win Season', `Finished ${wins}-${losses}.`);
    }
    /*
      UNDEFEATED ONLY ONCE THE SEASON IS ACTUALLY OVER (user report 2026-08-02).
      This fired on `losses === 0` alone, so a team that had played one game and
      won it was already being told it "ran the table at 1-0" — and the counter
      was incremented on the strength of it too.

      The gate is the schedule itself: no games left unplayed. That's the honest
      definition of "after the last game of your season", and it needs no guess
      about how long a season is.
    */
    const gamesRemaining = teamGames.filter((game) => !isGamePlayed(game.status)).length;
    if (wins > 0 && losses === 0 && gamesRemaining === 0) {
      dynastyUndefeatedSeasons++;
      addMilestone(milestones, season.seasonYear, 'Undefeated Season', `Ran the table at ${wins}-${losses}.`);
    }

    /*
      SIGNATURE WINS.

      A milestone list that only counts titles and ten-win seasons describes a
      blue blood. Most dynasties are not that, and the moment they turn on is a
      single Saturday — the user's was beating #1 as an unranked team, and it
      appeared nowhere.

      The ranks have to be the ones that were true AT KICKOFF, which is exactly
      what `game_context` was built to keep: the save only ever holds current
      values, so beating #1 in September and reading their rank in January would
      call it a win over an unranked team. Seasons captured before that table
      existed simply have no context rows and produce no signature wins, rather
      than producing wrong ones.

      Two bars, deliberately high, so this stays a highlight reel:
        · beating the #1 team, whoever you are
        · beating a top-ten team while unranked yourself
      A ranked team beating another ranked team is a good win, not a milestone.
    */
    const context = getSeasonGameContext(season.id);
    for (const game of teamGames) {
      if (!isGamePlayed(game.status)) continue;
      if (gameResult(game, seasonTeamId) !== 'W') continue;
      const ctx = context.get(game.gameId);
      if (!ctx) continue;
      const weAreHome = game.homeTeamIndex === seasonTeamId;
      const ourRank = weAreHome
        ? rankAtKickoff(ctx.homeMediaRank, ctx.homeCfpRank)
        : rankAtKickoff(ctx.awayMediaRank, ctx.awayCfpRank);
      const theirRank = weAreHome
        ? rankAtKickoff(ctx.awayMediaRank, ctx.awayCfpRank)
        : rankAtKickoff(ctx.homeMediaRank, ctx.homeCfpRank);
      if (theirRank === null) continue;
      const opponent = (weAreHome ? game.awayTeamName : game.homeTeamName) ?? 'a ranked opponent';
      const us = ourRank === null ? `Unranked ${userTeam.displayName}` : `#${ourRank} ${userTeam.displayName}`;

      if (theirRank === 1) {
        addMilestone(milestones, season.seasonYear, 'Beat the #1 Team', `${us} over #1 ${opponent}.`);
      } else if (ourRank === null && theirRank <= 10) {
        addMilestone(milestones, season.seasonYear, 'Signature Win', `${us} over #${theirRank} ${opponent}.`);
      }
    }

    /*
      THE CLIMB. Best rank the program can be PROVEN to have held this season:
      every synced week of the poll history, plus the rank standing in the teams
      snapshot. A week never synced simply isn't claimed.
    */
    const weeklyBest = getRankingHistory(season.id)
      .map((snapshot) => rankAtKickoff(snapshot.mediaPollRank, snapshot.cfpRank))
      .filter((rank): rank is number => rank !== null);
    if (userTeam.mediaPollRank > 0) weeklyBest.push(userTeam.mediaPollRank);
    const seasonBestRank = weeklyBest.length ? Math.min(...weeklyBest) : null;
    if (seasonBestRank !== null) {
      // Fired the FIRST time the dynasty reaches each tier and never again —
      // "Ranked" every year for a program that is always ranked is noise, not a
      // milestone. Best tier first, so one season can only claim its highest.
      // NOT `bestMediaRank`: that one has already taken this season's rank a few
      // lines above, so every tier would look like it had been reached before.
      const tier = POLL_MILESTONES.find(
        (m) => seasonBestRank <= m.rank && (bestRankBeforeThisSeason === null || bestRankBeforeThisSeason > m.rank),
      );
      if (tier) {
        addMilestone(milestones, season.seasonYear, tier.label, tier.detail(userTeam.displayName));
      }
      bestRankBeforeThisSeason =
        bestRankBeforeThisSeason === null ? seasonBestRank : Math.min(bestRankBeforeThisSeason, seasonBestRank);
    }

    const headCoach = coaches.find(
      (coach) => coach.teamIndex === seasonTeamId && coach.position === 'HeadCoach',
    );
    const seasonHeadCoachName = headCoach ? `${headCoach.firstName} ${headCoach.lastName}`.trim() : null;
    if (seasonHeadCoachName) {
      const coachSummary = ensureCoachSummary(coachSummaries, seasonHeadCoachName);
      coachSummary.seasons += 1;
      coachSummary.wins += wins;
      coachSummary.losses += losses;
      if (conferenceChampion) coachSummary.conferenceTitles += 1;
      if (nationalChampion) coachSummary.nationalTitles += 1;
      if (playoffAppearance) coachSummary.playoffAppearances += 1;
      if (wins >= 10) coachSummary.tenWinSeasons += 1;
    }

    // The user-controlled coach (HC, OC, or DC) for this season — tracked
    // every iteration so the LAST (most recent) season's coach and their
    // real save-native career record wins, matching Coach Hub's own choice
    // to show the live coach's authoritative career stats rather than a
    // dynasty-scoped slice.
    const seasonUserCoach = coaches.find((coach) => coach.teamIndex === seasonTeamId && coach.isUserControlled) ?? headCoach;
    if (seasonUserCoach) {
      headCoachName = `${seasonUserCoach.firstName} ${seasonUserCoach.lastName}`.trim();
      headCoachCareer = seasonUserCoach.careerStats;
    }

    seasonEntries.push({
      seasonYear: season.seasonYear,
      teamName: userTeam.displayName,
      wins,
      losses,
      conferenceWins: userTeam.confWins,
      conferenceLosses: userTeam.confLosses,
      mediaRank: userTeam.mediaPollRank > 0 ? userTeam.mediaPollRank : null,
      coachesRank: userTeam.coachesPollRank > 0 ? userTeam.coachesPollRank : null,
      cfpRank: userTeam.cfpRank > 0 ? userTeam.cfpRank : null,
      headCoachName: seasonHeadCoachName,
      conferenceChampion,
      conferenceChampionName: conferenceChampion ? (userTeam.conferenceName ?? null) : null,
      nationalChampion,
      playoffAppearance,
      bowlAppearance:
        latestPostseason && classifyPostseasonKind(latestPostseason) === 'bowl' ? latestPostseason.bowlName : null,
      bowlAssetName:
        latestPostseason && classifyPostseasonKind(latestPostseason) === 'bowl' ? latestPostseason.bowlAssetName : null,
      postseasonSummary: postseasonSummary(latestPostseason, latestPostseasonResult, nationalChampion),
    });
  }

  if (!latestUserTeam) return undefined;

  // Leaguewide history, built from every season's own 'yearSummary' snapshot
  // — full AND history-only seasons alike, unlike everything above this
  // point (which only ever looks at full seasons, since team win-loss data
  // genuinely isn't recoverable for a history-only year).
  const leagueHistory: LeagueHistoryYearEntry[] = seasons
    .map((season) => {
      const yearSummary = getSnapshot<YearSummaryData>(season.id, 'yearSummary');
      if (!yearSummary) return null;
      const entry: LeagueHistoryYearEntry = {
        seasonYear: season.seasonYear,
        hasFullData: season.hasFullData,
        nationalChampion: toLeagueChampion(yearSummary.nationalChampion),
        conferenceChampions: yearSummary.conferenceChampions.map((c) => ({
          conferenceName: c.conferenceName,
          winningTeamName: c.winningTeamName,
        })),
      };
      return entry;
    })
    .filter((entry): entry is LeagueHistoryYearEntry => entry !== null)
    .sort((a, b) => b.seasonYear - a.seasonYear);

  const records: ProgramHistoryRecordCategory[] = RECORD_CATEGORIES.map(({ key, label, statType }) => ({
    key,
    label,
    careerRecord: toRecordHolder(latestUserTeam.schoolRecords.career[statType]),
    seasonRecord: toRecordHolder(latestUserTeam.schoolRecords.season[statType]),
    gameRecord: toRecordHolder(latestUserTeam.schoolRecords.game[statType]),
  }));

  return {
    teamName,
    dynastyWins,
    dynastyLosses,
    dynastyConferenceTitles,
    dynastyNationalTitles,
    dynastyPlayoffAppearances,
    dynastyBowlAppearances,
    dynastyBowlWins,
    dynastyTenWinSeasons,
    dynastyUndefeatedSeasons,
    bestMediaRank,
    bestRecruitingClassRank,
    seasonsCoached: seasonEntries.length,
    schoolsCoached,
    headCoachName,
    headCoachCareer,
    nationalAwards: nationalAwards.sort((a, b) => b.seasonYear - a.seasonYear),
    seasons: seasonEntries.sort((a, b) => b.seasonYear - a.seasonYear),
    coaches: [...coachSummaries.values()].sort(
      (a, b) => b.wins - a.wins || b.seasons - a.seasons || a.coachName.localeCompare(b.coachName),
    ),
    records,
    milestones: milestones.sort((a, b) => b.seasonYear - a.seasonYear || a.label.localeCompare(b.label)),
    leagueHistory,
  };
}
