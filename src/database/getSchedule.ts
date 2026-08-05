import { isGamePlayed } from '../shared/gameStatus';
import { displayRank } from '../shared/pollRank';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { getSeasonGameContext } from './gameContext';
import { isBowlSlateSet } from '../shared/syncPhase';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import { conferenceChampionshipWeek } from '../shared/championshipWeek';
import type { RivalryData } from '../extractors/extract-rivalries';
import type { GameContext, ScheduleGame, ScheduleOverview } from '../shared/types';

export function formatKickoff(minutes: number): string {
  if (minutes <= 0) return 'TBD';
  const hour24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Empty until the game's date has actually been assigned in-game (not true for any game in a fresh preseason save). */
export function formatGameDate(month: number, day: number): string {
  if (month <= 0 || day <= 0 || month > 12) return 'TBD';
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/**
 * Games aren't flagged "conference"/"non-conference" directly in the save — this
 * compares both teams' conference membership (built in extract-teams.ts by inverting
 * Conference.TeamSlots). Bowl/playoff games always classify as 'bowl' regardless of
 * conference, matching how conference tie-ins work in real CFB bowls.
 */
function classifyGameType(
  game: GameData,
  opponentIndex: number | null,
  userTeamIndex: number,
  conferenceByTeamIndex: Map<number, string | null>,
): ScheduleGame['gameType'] {
  if (game.isBowlGame) return 'bowl';
  const userConf = conferenceByTeamIndex.get(userTeamIndex);
  const oppConf = opponentIndex !== null ? conferenceByTeamIndex.get(opponentIndex) : null;
  return userConf && oppConf && userConf === oppConf ? 'conference' : 'non-conference';
}

function toScheduleGame(
  game: GameData,
  userTeamIndex: number,
  userTeamName: string,
  rankByTeam: Map<number, number>,
  conferenceByTeamIndex: Map<number, string | null>,
  rivalryByOpponent: Map<number, string | null>,
  recordByTeam: Map<number, { wins: number; losses: number }>,
  context: GameContext | undefined,
  championshipWeek: number | null,
): ScheduleGame {
  const isHome = game.homeTeamIndex === userTeamIndex;
  const opponentIndex = isHome ? game.awayTeamIndex : game.homeTeamIndex;
  const opponent = (isHome ? game.awayTeamName : game.homeTeamName) ?? 'TBD';
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  const played = isGamePlayed(game.status);

  let result: ScheduleGame['result'] = null;
  if (played) {
    if (teamScore > opponentScore) result = 'W';
    else if (teamScore < opponentScore) result = 'L';
    else result = 'T';
  }

  // Prefer the rank CAPTURED around kickoff over the opponent's rank today —
  // otherwise beating a #7 in September reads as beating a #40 by December.
  // Falls back to live when this game predates context tracking.
  // Both polls from the same moment — see shared/pollRank.ts. The CFP number
  // leads once released, matching the game's own scoreboard.
  //
  // The "was anything captured" test stays SEPARATE from the resolved value: a
  // team captured as genuinely unranked resolves to null, and collapsing that
  // into a `??` chain would fall through and print its rank TODAY — the very
  // thing this capture exists to prevent.
  const capturedMedia = isHome ? context?.awayMediaRank : context?.homeMediaRank;
  const capturedCfp = isHome ? context?.awayCfpRank : context?.homeCfpRank;
  const hasCapturedRank = capturedMedia != null || capturedCfp != null;
  const opponentRank = hasCapturedRank
    ? displayRank(capturedMedia, capturedCfp)
    : opponentIndex !== null
      ? rankByTeam.get(opponentIndex)
      : undefined;
  const capturedRecord = isHome ? context?.awayRecord : context?.homeRecord;
  const teamQuarterScores = isHome ? game.homeQuarterScores : game.awayQuarterScores;
  const opponentQuarterScores = isHome ? game.awayQuarterScores : game.homeQuarterScores;
  const teamStats = isHome ? game.homeTeamStats : game.awayTeamStats;
  const opponentStats = isHome ? game.awayTeamStats : game.homeTeamStats;
  const gameType = classifyGameType(game, opponentIndex, userTeamIndex, conferenceByTeamIndex);
  const conferenceName = gameType === 'conference' ? conferenceByTeamIndex.get(userTeamIndex) ?? null : null;
  const isRivalryGame = opponentIndex !== null && rivalryByOpponent.has(opponentIndex);
  const rivalryName = opponentIndex !== null ? rivalryByOpponent.get(opponentIndex) ?? null : null;
  const opponentRecord = capturedRecord ?? (opponentIndex !== null ? recordByTeam.get(opponentIndex) ?? null : null);

  return {
    gameId: game.gameId,
    week: game.week,
    teamName: userTeamName,
    opponent,
    opponentTeamIndex: opponentIndex,
    isHome,
    status: game.status,
    dayOfWeek: game.dayOfWeek,
    broadcastScope: game.broadcastScope,
    kickoffTime: formatKickoff(game.kickoffMinutes),
    date: formatGameDate(game.gameMonth, game.gameDay),
    teamScore: played ? teamScore : null,
    opponentScore: played ? opponentScore : null,
    result,
    opponentCurrentRank: opponentRank && opponentRank > 0 ? opponentRank : null,
    // true  = captured around kickoff (historical)
    // false = no capture for this game, so these are today's values
    opponentContextCaptured: !!context && !context.approximate && (hasCapturedRank || !!capturedRecord),
    teamQuarterScores,
    opponentQuarterScores,
    teamStats,
    opponentStats,
    gameType,
    // A conference game in the championship week IS the championship. Both
    // halves matter: the week alone would catch a stray non-conference game if
    // one were ever scheduled there, and gameType alone catches the whole season.
    isConferenceChampionship: gameType === 'conference' && championshipWeek !== null && game.week === championshipWeek,
    neutralVenueId: game.neutralVenueId ?? null,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    isNationalChampionship: game.isNationalChampionship,
    conferenceName,
    isRivalryGame,
    rivalryName,
    siteType: game.isNeutralSite ? 'neutral' : isHome ? 'home' : 'away',
    opponentRecord,
    // Filled in by getSchedule() once every game's chronological order is known — a single game's own data isn't enough to compute "the record after this game."
    runningRecord: null,
  };
}

/**
 * Accumulates overall/conference wins-losses through each played game in
 * week order — mutates `games` in place (already sorted by week by the
 * caller). Ties don't count toward either wins or losses column, matching
 * how the season-total record elsewhere in this app already handles them.
 */
function applyRunningRecords(games: ScheduleGame[]): void {
  let overallWins = 0;
  let overallLosses = 0;
  let conferenceWins = 0;
  let conferenceLosses = 0;

  for (const game of games) {
    if (game.result === null) continue;
    if (game.result === 'W') {
      overallWins++;
      if (game.gameType === 'conference') conferenceWins++;
    } else if (game.result === 'L') {
      overallLosses++;
      if (game.gameType === 'conference') conferenceLosses++;
    }
    game.runningRecord = { overallWins, overallLosses, conferenceWins, conferenceLosses };
  }
}

/** Current win/loss streak, most recent games first. Ties break the streak. */
function computeStreak(playedGamesNewestFirst: ScheduleGame[]): ScheduleOverview['currentStreak'] {
  const first = playedGamesNewestFirst[0];
  if (!first || first.result === 'T' || first.result === null) return { type: null, count: 0 };

  let count = 0;
  for (const game of playedGamesNewestFirst) {
    if (game.result !== first.result) break;
    count++;
  }
  return { type: first.result, count };
}

export function getSchedule(dynastyId: string, seasonId?: number): ScheduleOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const userTeamIndex = season.userTeamId;
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((t) => t.teamIndex === userTeamIndex);
  if (!userTeam) return undefined;

  const rankByTeam = new Map(teams.map((t) => [t.teamIndex, displayRank(t.mediaPollRank, t.cfpRank) ?? 0]));
  const conferenceByTeamIndex = new Map(teams.map((t) => [t.teamIndex, t.conferenceName]));
  const rivalries = getSnapshot<RivalryData[]>(season.id, 'rivalries') ?? [];
  const rivalryByOpponent = new Map(rivalries.map((r) => [r.opponentTeamIndex, r.name]));
  // Only the save's current/final per-team record — see ScheduleGame.opponentRecord's doc comment for why this isn't a point-in-time value.
  const recordByTeam = new Map(
    teams.map((t) => [t.teamIndex, { wins: t.confWins + t.nonConfWins, losses: t.confLosses + t.nonConfLosses }]),
  );

  const gameContext = getSeasonGameContext(season.id);
  const allGames = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  // A bowl the game hasn't actually assigned yet is a placeholder pairing, not
  // a fixture — see isBowlSlateSet. Hidden until bowl week, but never once it's
  // been played, so a finished season always shows the bowl it really played.
  const bowlsVisible = isBowlSlateSet(season.syncedWeekType);
  const teamGames = allGames
    .filter((g) => g.homeTeamIndex === userTeamIndex || g.awayTeamIndex === userTeamIndex)
    .filter((g) => !g.isBowlGame || bowlsVisible || isGamePlayed(g.status))
    .sort((a, b) => a.week - b.week);

  // Derived from the LEAGUEWIDE game list, not the user's own — a team that
  // doesn't reach its championship still needs the week identified correctly.
  const championshipWeek = conferenceChampionshipWeek(allGames);

  const games = teamGames.map((g) =>
    toScheduleGame(g, userTeamIndex, userTeam.displayName, rankByTeam, conferenceByTeamIndex, rivalryByOpponent, recordByTeam, gameContext.get(g.gameId), championshipWeek),
  );
  applyRunningRecords(games);
  const playedNewestFirst = [...games].filter((g) => g.result !== null).reverse();

  const wins = userTeam.confWins + userTeam.nonConfWins;
  const losses = userTeam.confLosses + userTeam.nonConfLosses;

  return {
    games,
    record: { wins, losses },
    conferenceRecord: { wins: userTeam.confWins, losses: userTeam.confLosses },
    currentStreak: computeStreak(playedNewestFirst),
    // 6 wins is the standard FBS bowl-eligibility threshold.
    bowlEligible: wins >= 6,
  };
}
