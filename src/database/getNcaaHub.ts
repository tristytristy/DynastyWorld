import { FCS_POOL_TEAM_INDEX, isFcsPool } from '../shared/fcsPool';
import { storySeed } from '../shared/storyVariants';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import {
  RANKED_LIMIT,
  narrateCoachSpotlight,
  narrateGameResult,
  narrateUpcoming,
  narrateUpset,
} from './ncaaHubNarration';
import { computeTeamStreak, recentForm } from './ncaaHubStreaks';
import type { AwardsData } from '../extractors/extract-awards';
import type { CoachData } from '../extractors/extract-coaches';
import { seasonAwardsDecided } from './getAwards';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type {
  NcaaHubCoachSpotlight,
  NcaaHubConferenceLeader,
  NcaaHubGameFeature,
  NcaaHubHeismanFeature,
  NcaaHubOverview,
  NcaaHubRecordWatchEntry,
  NcaaHubRecruitingClassEntry,
  NcaaHubTop25Entry,
} from '../shared/types';
import { isGamePlayed } from '../shared/gameStatus';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The value the poll fields carry for the non-FBS placeholder rows, not a rank. */
const FCS_RANK_PLACEHOLDER = 255;

/**
 * Everything the story builders need beyond the games they're narrating: the
 * season's full schedule (for streaks), its year (for stable seeds), and the
 * leaguewide poll map.
 */
interface HubContext {
  seasonYear: number;
  schedule: GameData[];
  rankByTeamIndex: Map<number, number | null>;
}

function normalizeRank(rank: number): number | null {
  return rank > 0 && rank !== FCS_RANK_PLACEHOLDER ? rank : null;
}

/**
 * The polls rank all 138 FBS teams, so a raw rank is not a ranking — only the
 * top 25 is. Anything past that reads as "unranked" everywhere the UI or the
 * prose says "ranked", which is what a rank chip and a "ranked matchup" claim
 * have always meant.
 */
function rankedOnly(rank: number | null): number | null {
  return rank !== null && rank <= RANKED_LIMIT ? rank : null;
}

/**
 * Spots gained since last week's poll. Returns nulls rather than a number
 * whenever the comparison would be fiction: a season snapshot taken before the
 * last-week field was captured, a week before the poll was released (0), or
 * the FCS placeholder.
 */
function pollMovement(
  currentRank: number,
  lastWeekRank: number | undefined,
): { movement: number | null; lastWeekRank: number | null } {
  if (
    lastWeekRank === undefined ||
    lastWeekRank <= 0 ||
    lastWeekRank === FCS_RANK_PLACEHOLDER ||
    currentRank <= 0
  ) {
    return { movement: null, lastWeekRank: null };
  }
  return { movement: lastWeekRank - currentRank, lastWeekRank };
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

type PollKey = 'media' | 'coaches' | 'cfp';

function pollRank(team: TeamData, poll: PollKey): number {
  if (poll === 'media') return team.mediaPollRank;
  if (poll === 'coaches') return team.coachesPollRank;
  return team.cfpRank;
}

/**
 * Last week's rank in the SAME poll, or undefined when that poll has none
 * worth trusting. The CFP is the deliberate undefined: its `LastWeeksRank`
 * field exists but never differed from its current rank on any real save
 * checked (see extract-teams.ts), so a CFP movement number would be a
 * permanent zero dressed up as a fact.
 */
function pollLastWeekRank(team: TeamData, poll: PollKey): number | undefined {
  if (poll === 'media') return team.mediaPollLastWeekRank;
  if (poll === 'coaches') return team.coachesPollLastWeekRank;
  return undefined;
}

/**
 * One poll's top 25. Built per poll rather than once for the media poll with
 * the others hung off it as extra columns — a team ranked 8th by the coaches
 * and 30th by the media belongs in the coaches list, and the old shape simply
 * couldn't express that.
 */
function buildPollTop25(teams: TeamData[], userTeamIndex: number, poll: PollKey): NcaaHubTop25Entry[] {
  return teams
    .filter((team) => {
      const rank = pollRank(team, poll);
      return rank > 0 && rank <= RANKED_LIMIT;
    })
    .sort((a, b) => pollRank(a, poll) - pollRank(b, poll))
    .map((team) => {
      const rank = pollRank(team, poll);
      const { movement, lastWeekRank } = pollMovement(rank, pollLastWeekRank(team, poll));
      return {
        rank,
        teamName: team.displayName,
        conferenceName: team.conferenceName,
        wins: overallWins(team),
        losses: overallLosses(team),
        coachesRank: normalizeRank(team.coachesPollRank),
        cfpRank: normalizeRank(team.cfpRank),
        isUserTeam: team.teamIndex === userTeamIndex,
        rankMovement: movement,
        lastWeekRank,
      };
    });
}

/**
 * WINNER OR LEADER — decided by the season, not by the rank.
 *
 * This read `rank === 0 ? 'Heisman Winner' : 'Heisman Leader'`, which looks like
 * a real test and is not: rank 0 is occupied from the moment the ranking exists,
 * so the label was "Heisman Winner" in week 3. The honest question is whether the
 * season's awards have been handed out at all — see seasonAwardsDecided, the same
 * gate the Trophy Room and a player's Journey use before granting the trophy.
 */
function buildHeismanFeature(awards: AwardsData | undefined): NcaaHubHeismanFeature | null {
  const first = awards?.heismanRanking[0];
  if (!first) return null;

  const winner = awards?.heismanRanking.find((entry) => entry.rank === 0) ?? first;
  const decided = awards ? seasonAwardsDecided(awards) : false;
  return {
    label: decided && winner.rank === 0 ? 'Heisman Winner' : 'Heisman Leader',
    rank: winner.rank,
    playerId: winner.playerId,
    playerName: `${winner.firstName} ${winner.lastName}`,
    position: winner.position,
    teamDisplayName: winner.teamDisplayName,
  };
}

/**
 * EVERY ranked class, not a top eight (user direction 2026-08-07: "I would like
 * to have Recruiting classes be able to scroll the whole FBS school length").
 *
 * The panel that renders this already scrolls inside a fixed height, so the cap
 * was doing nothing but hiding rows 9 through 138 — and a recruiting table that
 * stops at 8 can't answer the only question a coach outside the top ten asks,
 * which is where THEY sit. ~130 small rows is a few KB on a payload that already
 * carries the full poll.
 */
function buildRecruitingBuzz(teams: TeamData[], userTeamIndex: number): NcaaHubRecruitingClassEntry[] {
  return teams
    .filter((team) => team.topClassRank > 0)
    .sort((a, b) => a.topClassRank - b.topClassRank)
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
  rankSwing: number | null = null,
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
    // Displayed ranks are top-25 only: a chip reading "#112" claims a ranking
    // the team does not have.
    homeRank: rankedOnly(homeRank),
    awayRank: rankedOnly(awayRank),
    homeScore: isGamePlayed(game.status) ? game.homeScore : null,
    awayScore: isGamePlayed(game.status) ? game.awayScore : null,
    isBowlGame: game.isBowlGame,
    isNationalChampionship: game.isNationalChampionship,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    isNeutralSite: game.isNeutralSite,
    summary,
    rankSwing,
  };
}

/** A game's seed: the event itself, so the same matchup in the same week always narrates the same way. */
function gameSeed(game: GameData, seasonYear: number): string {
  return storySeed(seasonYear, game.week, game.awayTeamName, game.homeTeamName);
}

/** The streak the team carried INTO this game — `week - 1`, so a result never counts itself twice. */
function streakEntering(ctx: HubContext, teamIndex: number | null, week: number) {
  return computeTeamStreak(ctx.schedule, teamIndex, week - 1);
}

/** How many of a game's teams are actually ranked — top 25, not "has a poll number", which every FBS team does. */
function rankedSideCount(ranks: { homeRank: number | null; awayRank: number | null }): number {
  return Number(rankedOnly(ranks.homeRank) !== null) + Number(rankedOnly(ranks.awayRank) !== null);
}

function compareUpcomingGames(
  a: GameData,
  b: GameData,
  rankByTeamIndex: Map<number, number | null>,
): number {
  const aRanks = gameRanks(a, rankByTeamIndex);
  const bRanks = gameRanks(b, rankByTeamIndex);
  const aRanked = rankedSideCount(aRanks);
  const bRanked = rankedSideCount(bRanks);
  if (aRanked !== bRanked) return bRanked - aRanked;

  const aCombined = (aRanks.homeRank ?? 40) + (aRanks.awayRank ?? 40);
  const bCombined = (bRanks.homeRank ?? 40) + (bRanks.awayRank ?? 40);
  if (aCombined !== bCombined) return aCombined - bCombined;

  if (a.kickoffMinutes !== b.kickoffMinutes) return a.kickoffMinutes - b.kickoffMinutes;

  return (a.homeTeamName ?? '').localeCompare(b.homeTeamName ?? '');
}

function buildGameOfTheWeek(games: GameData[], ctx: HubContext): NcaaHubGameFeature | null {
  if (games.length === 0) return null;
  const { rankByTeamIndex } = ctx;

  const picked = [...games].sort((a, b) => {
    const aRanks = gameRanks(a, rankByTeamIndex);
    const bRanks = gameRanks(b, rankByTeamIndex);
    const aRanked = rankedSideCount(aRanks);
    const bRanked = rankedSideCount(bRanks);
    if (aRanked !== bRanked) return bRanked - aRanked;

    const aCombined = (aRanks.homeRank ?? 40) + (aRanks.awayRank ?? 40);
    const bCombined = (bRanks.homeRank ?? 40) + (bRanks.awayRank ?? 40);
    if (aCombined !== bCombined) return aCombined - bCombined;

    const aMargin = Math.abs(a.homeScore - a.awayScore);
    const bMargin = Math.abs(b.homeScore - b.awayScore);
    if (aMargin !== bMargin) return aMargin - bMargin;

    return b.homeScore + b.awayScore - (a.homeScore + a.awayScore);
  })[0];

  const homeWon = picked.homeScore > picked.awayScore;
  const tied = picked.homeScore === picked.awayScore;
  const ranks = gameRanks(picked, rankByTeamIndex);
  const winnerIndex = homeWon ? picked.homeTeamIndex : picked.awayTeamIndex;

  const summary = narrateGameResult({
    seed: gameSeed(picked, ctx.seasonYear),
    winnerName: tied ? null : homeWon ? picked.homeTeamName : picked.awayTeamName,
    loserName: tied ? null : homeWon ? picked.awayTeamName : picked.homeTeamName,
    homeTeamName: picked.homeTeamName ?? 'Home',
    awayTeamName: picked.awayTeamName ?? 'Away',
    winnerScore: Math.max(picked.homeScore, picked.awayScore),
    loserScore: Math.min(picked.homeScore, picked.awayScore),
    winnerRank: rankedOnly(homeWon ? ranks.homeRank : ranks.awayRank),
    loserRank: rankedOnly(homeWon ? ranks.awayRank : ranks.homeRank),
    winnerStreak: tied ? null : streakEntering(ctx, winnerIndex, picked.week),
  });

  return toGameFeature(picked, rankByTeamIndex, summary);
}

/** The top of the poll, for the strongest upset tier. */
const TOP_TEN_LIMIT = 10;

/**
 * Where a team with no poll slot sorts: one place worse than the last of the
 * 138 FBS teams the polls actually rank.
 *
 * It replaces a flat `?? 40`, which was the whole reason an FBS team beating an
 * FCS opponent kept winning this slot. The FCS pool is excluded from `teams`
 * (see fcsPool.ts), so it was never in the rank map, so it resolved to 40 —
 * BETTER than most of the league. Akron at No. 96 beating "FCS Northwest" then
 * scored a 56-spot swing and read as the shock of the week.
 */
const UNPLACED_RANK = 139;

type UpsetTier = 1 | 2 | 3;

interface UpsetCandidate {
  game: GameData;
  tier: UpsetTier;
  swing: number;
  summary: string;
}

/**
 * The week's upset, chosen by RULE TIER first and margin of disparity second
 * (user direction).
 *
 * The tiers, strongest first:
 *
 *   1. A TOP-TEN TEAM LOST to someone outside the top ten. The biggest thing
 *      that can happen on a Saturday, whoever beat them.
 *   2. A RANKED TEAM LOST to an unranked one. The classic upset.
 *   3. ANY loss to a worse-ranked team — decided purely on the size of the gap.
 *
 * Ordering by tier and not by raw gap alone is the point of the hierarchy: a
 * No. 3 losing to No. 30 is a 27-spot gap and a national story, while No. 70
 * losing to No. 130 is a 60-spot gap and nothing at all. Raw distance alone
 * would have printed the second one. Within a tier the widest gap still wins,
 * so the rule picks the story and the distance breaks the tie.
 *
 * FCS GAMES ONLY COUNT WHEN THE FCS SIDE WINS. An FBS program beating the
 * placeholder pool is the expected result of a scheduled tune-up and is never
 * an upset. Losing to them is one of the worst results in the sport, so those
 * stay — with the pool sorted at `UNPLACED_RANK`, which is honest: the polls
 * genuinely do not rank it.
 */
function buildUpsetOfTheWeek(games: GameData[], ctx: HubContext): NcaaHubGameFeature | null {
  const { rankByTeamIndex } = ctx;
  const candidates = games
    .map((game): UpsetCandidate | null => {
      if (!game.homeTeamName || !game.awayTeamName) return null;
      if (game.homeScore === game.awayScore) return null;

      const homeWon = game.homeScore > game.awayScore;
      const homeIsFcs = isFcsPool(game.homeTeamIndex);
      const awayIsFcs = isFcsPool(game.awayTeamIndex);
      // Pool vs pool isn't a fixture the app should ever narrate, and an FBS
      // side beating the pool is the result everybody expected.
      if (homeIsFcs && awayIsFcs) return null;
      if (homeIsFcs && !homeWon) return null;
      if (awayIsFcs && homeWon) return null;

      const homeRank = game.homeTeamIndex !== null ? rankByTeamIndex.get(game.homeTeamIndex) ?? null : null;
      const awayRank = game.awayTeamIndex !== null ? rankByTeamIndex.get(game.awayTeamIndex) ?? null : null;
      const homeEffective = homeRank ?? UNPLACED_RANK;
      const awayEffective = awayRank ?? UNPLACED_RANK;

      const winnerEffective = homeWon ? homeEffective : awayEffective;
      const loserEffective = homeWon ? awayEffective : homeEffective;
      // The gap is measured on the FULL poll (all 138 FBS teams) because that
      // distance IS the story — a No. 96 over a No. 4 is a bigger deal than a
      // No. 20 over a No. 12, and clamping both to the top 25 would flatten
      // them into the same sentence.
      const swing = winnerEffective - loserEffective;
      if (swing <= 0) return null;

      const loserRanked = loserEffective <= RANKED_LIMIT;
      const tier: UpsetTier =
        loserEffective <= TOP_TEN_LIMIT && winnerEffective > TOP_TEN_LIMIT
          ? 1
          : loserRanked && winnerEffective > RANKED_LIMIT
            ? 2
            : 3;

      const winnerName = homeWon ? game.homeTeamName : game.awayTeamName;
      const loserName = homeWon ? game.awayTeamName : game.homeTeamName;
      const summary = narrateUpset({
        seed: gameSeed(game, ctx.seasonYear),
        winnerName,
        loserName,
        winnerScore: Math.max(game.homeScore, game.awayScore),
        loserScore: Math.min(game.homeScore, game.awayScore),
        winnerRank: homeWon ? homeRank : awayRank,
        loserRank: homeWon ? awayRank : homeRank,
        rankSwing: swing,
        winnerStreak: streakEntering(ctx, homeWon ? game.homeTeamIndex : game.awayTeamIndex, game.week),
      });
      return { game, tier, swing, summary };
    })
    .filter((candidate): candidate is UpsetCandidate => candidate !== null)
    .sort((a, b) => a.tier - b.tier || b.swing - a.swing);

  if (candidates.length === 0) return null;
  return toGameFeature(candidates[0].game, rankByTeamIndex, candidates[0].summary, candidates[0].swing);
}

function buildUpcomingGames(games: GameData[], ctx: HubContext): NcaaHubGameFeature[] {
  const { rankByTeamIndex } = ctx;
  return [...games]
    .sort((a, b) => compareUpcomingGames(a, b, rankByTeamIndex))
    .slice(0, 5)
    .map((game) => {
      const ranks = gameRanks(game, rankByTeamIndex);
      const summary = narrateUpcoming({
        seed: gameSeed(game, ctx.seasonYear),
        homeTeamName: game.homeTeamName ?? 'the home side',
        awayTeamName: game.awayTeamName ?? 'the visitors',
        homeRank: rankedOnly(ranks.homeRank),
        awayRank: rankedOnly(ranks.awayRank),
        isNationalChampionship: game.isNationalChampionship,
        isBowlGame: game.isBowlGame,
        bowlName: game.bowlName,
        isNeutralSite: game.isNeutralSite,
      });
      return toGameFeature(game, rankByTeamIndex, summary);
    })
    .filter((game): game is NcaaHubGameFeature => game !== null);
}

function buildCoachSpotlight(
  coaches: CoachData[],
  teams: TeamData[],
  ctx: HubContext,
  throughWeek: number | null,
): NcaaHubCoachSpotlight | null {
  const teamByIndex = new Map(teams.map((team) => [team.teamIndex, team]));
  const candidates = coaches
    .filter((coach) => coach.position === 'HeadCoach')
    .map((coach) => {
      const team = teamByIndex.get(coach.teamIndex);
      if (!team) return null;

      const wins = overallWins(team);
      const losses = overallLosses(team);
      const rank = rankedOnly(normalizeRank(team.mediaPollRank));
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

  const coachName = `${picked.coach.firstName} ${picked.coach.lastName}`;
  // Season-long form, so this reads as "where the program stands" rather than
  // as a comment on one result: the streak and last-five run both count
  // through the most recent completed week.
  const week = throughWeek ?? 0;
  const reason = narrateCoachSpotlight({
    seed: storySeed(ctx.seasonYear, week, coachName),
    coachName,
    teamName: picked.team.displayName,
    wins: picked.wins,
    losses: picked.losses,
    rank: picked.rank,
    prestige: picked.prestige,
    streak: computeTeamStreak(ctx.schedule, picked.team.teamIndex, week),
    recentForm: recentForm(ctx.schedule, picked.team.teamIndex, week, 5),
    rankMovement: pollMovement(picked.team.mediaPollRank, picked.team.mediaPollLastWeekRank).movement,
  });

  return {
    coachName,
    coachPortraitAssetName: picked.coach.portraitAssetName,
    teamName: picked.team.displayName,
    overallWins: picked.wins,
    overallLosses: picked.losses,
    mediaRank: picked.rank,
    teamPrestige: picked.prestige,
    reason,
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
  const top25 = buildPollTop25(teams, userTeamId, 'media');
  const coachesTop25 = buildPollTop25(teams, userTeamId, 'coaches');
  const cfpTop25 = buildPollTop25(teams, userTeamId, 'cfp');
  const heismanFeature = buildHeismanFeature(awards);
  const recruitingBuzz = buildRecruitingBuzz(teams, userTeamId);
  const undefeatedWatch = buildRecordWatch(teams, userTeamId, 0, 8);
  const oneLossWatch = buildRecordWatch(teams, userTeamId, 1, 8);
  const conferenceLeaders = buildConferenceLeaders(teams, userTeamId);

  const playedWeeks = schedule.filter((game) => isGamePlayed(game.status)).map((game) => game.week);
  const latestPlayedWeek = playedWeeks.length > 0 ? Math.max(...playedWeeks) : null;
  const latestWeekGames =
    latestPlayedWeek === null ? [] : schedule.filter((game) => isGamePlayed(game.status) && game.week === latestPlayedWeek);

  const unplayedWeeks = schedule.filter((game) => !isGamePlayed(game.status)).map((game) => game.week);
  const upcomingWeek = unplayedWeeks.length > 0 ? Math.min(...unplayedWeeks) : null;
  const upcomingWeekGames =
    upcomingWeek === null ? [] : schedule.filter((game) => !isGamePlayed(game.status) && game.week === upcomingWeek);

  // Seeded off the season YEAR rather than its row id: the year survives a
  // delete-and-reimport, so a season's prose stays put across one.
  const ctx: HubContext = { seasonYear: season.seasonYear, schedule, rankByTeamIndex };

  return {
    seasonYear: season.seasonYear,
    lastSyncedAt: season.extractedAt,
    top25,
    coachesTop25,
    cfpTop25,
    heismanFeature,
    gameOfTheWeek: buildGameOfTheWeek(latestWeekGames, ctx),
    upsetOfTheWeek: buildUpsetOfTheWeek(latestWeekGames, ctx),
    upcomingWeek,
    upcomingGames: buildUpcomingGames(upcomingWeekGames, ctx),
    coachSpotlight: buildCoachSpotlight(coaches, teams, ctx, latestPlayedWeek),
    recruitingBuzz,
    undefeatedWatch,
    oneLossWatch,
    conferenceLeaders,
  };
}
