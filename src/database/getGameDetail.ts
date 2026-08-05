import { conferenceChampionshipWeek } from '../shared/championshipWeek';
import { getSeasonGameContext } from './gameContext';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { formatGameDate, formatKickoff } from './getSchedule';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { GameDetailData, GameDetailTeamSide, GameLogEntry } from '../shared/types';
import { isGamePlayed } from '../shared/gameStatus';
import { displayRank } from '../shared/pollRank';

/**
 * The full detail for ONE game, framed neutrally (home vs away) so the same
 * Game Info modal serves the user's own games AND any other league game. All
 * of it comes from snapshots that already exist per season: `schedule`
 * (GameData is leaguewide — every game, with team stats + quarter scores +
 * meta), `teams` (names, conference, poll rank), and `gamelog` (now leaguewide
 * player box scores). Returns undefined if the game isn't in this season's
 * snapshot.
 */
export function getGameDetail(dynastyId: string, gameId: number, seasonId?: number): GameDetailData | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const games = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const game = games.find((g) => g.gameId === gameId);
  if (!game) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const teamByIndex = new Map(teams.map((t) => [t.teamIndex, t]));
  const userTeamIndex = season.userTeamId;

  const confOf = (idx: number | null): string | null => (idx !== null ? teamByIndex.get(idx)?.conferenceName ?? null : null);
  // The rank captured around THIS game's kickoff, falling back to the team's
  // rank today when the game predates context tracking. A box score billing a
  // matchup should mean they held those ranks that day, not that they hold them
  // now — see schema_v11_game_context.sql.
  const context = getSeasonGameContext(season.id).get(gameId);
  const rankOf = (idx: number | null, side: 'home' | 'away'): number | null => {
    // BOTH polls from the SAME moment — the captured pair, or the live pair.
    // Taking a captured CFP rank alongside a live media rank would print a
    // number belonging to no particular week. `displayRank` prefers the CFP
    // poll once released, which is what the game's own scoreboard shows.
    const capturedMedia = side === 'home' ? context?.homeMediaRank : context?.awayMediaRank;
    const capturedCfp = side === 'home' ? context?.homeCfpRank : context?.awayCfpRank;
    if (capturedMedia != null || capturedCfp != null) return displayRank(capturedMedia, capturedCfp);
    const team = idx !== null ? teamByIndex.get(idx) : undefined;
    return displayRank(team?.mediaPollRank, team?.cfpRank);
  };
  // Record going INTO the game, same captured source as the rank above. The
  // save only ever holds a team's current record, so anything not captured at
  // the time is simply unknowable later — hence null rather than a guess.
  const recordOf = (side: 'home' | 'away') =>
    (side === 'home' ? context?.homeRecord : context?.awayRecord) ?? null;
  const colorOf = (idx: number | null): { primary: string | null; secondary: string | null } => {
    const t = idx !== null ? teamByIndex.get(idx) : undefined;
    return { primary: t?.primaryColorHex ?? null, secondary: t?.secondaryColorHex ?? null };
  };

  // Same classification getSchedule uses: bowl, else conference when both teams
  // share a conference, else non-conference.
  const homeConf = confOf(game.homeTeamIndex);
  const gameType: GameDetailData['gameType'] = game.isBowlGame
    ? 'bowl'
    : homeConf && homeConf === confOf(game.awayTeamIndex)
      ? 'conference'
      : 'non-conference';
  const conferenceName = gameType === 'conference' ? homeConf : null;

  const players = (getSnapshot<GameLogEntry[]>(season.id, 'gamelog') ?? []).filter((e) => e.gameId === gameId);

  /*
    OVERTIME POINTS, DERIVED RATHER THAN READ — on purpose.

    The extractor now stores `homeScoreOvertime`/`awayScoreOvertime` off the
    save, but every season already in someone's archive was captured before
    those fields existed, and re-syncing can't recover a past season. The
    arithmetic can: the four quarters are regulation, so anything between their
    sum and the final IS the overtime. Checked against the save's own numbers on
    real OT games — the difference equals `HomeScoreOT` exactly.

    So the stored field is preferred when present and the subtraction fills in
    behind it, which makes this work on games synced months ago with no re-sync.
    Clamped at zero: a game whose quarters somehow overshoot its final is bad
    data, not negative overtime.
  */
  const overtimeOf = (stored: number | undefined, score: number, quarters: number[]) =>
    stored ?? Math.max(0, score - quarters.reduce((sum, q) => sum + q, 0));

  const homeOvertime = overtimeOf(game.homeScoreOvertime, game.homeScore, game.homeQuarterScores);
  const awayOvertime = overtimeOf(game.awayScoreOvertime, game.awayScore, game.awayQuarterScores);

  const side = (
    teamIndex: number | null,
    name: string | null,
    score: number,
    quarterScores: number[],
    overtimePoints: number,
    stats: GameDetailTeamSide['stats'],
    which: 'home' | 'away',
  ): GameDetailTeamSide => {
    const colors = colorOf(teamIndex);
    return {
      teamIndex: teamIndex ?? -1,
      name: name ?? 'TBD',
      score,
      quarterScores,
      overtimePoints,
      stats,
      currentRank: rankOf(teamIndex, which),
      recordAtGame: recordOf(which),
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      isUser: teamIndex !== null && teamIndex === userTeamIndex,
    };
  };

  return {
    gameId: game.gameId,
    week: game.week,
    played: isGamePlayed(game.status),
    status: game.status,
    dayOfWeek: game.dayOfWeek,
    kickoffTime: formatKickoff(game.kickoffMinutes),
    date: formatGameDate(game.gameMonth, game.gameDay),
    isBowlGame: game.isBowlGame,
    isNationalChampionship: game.isNationalChampionship,
    isConferenceChampionship:
      gameType === 'conference' && conferenceChampionshipWeek(games) === game.week,
    neutralVenueId: game.neutralVenueId ?? null,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    isNeutralSite: game.isNeutralSite,
    gameType,
    conferenceName,
    // Trust the game's own flag when the season carries it; otherwise the points
    // themselves are the evidence — an overtime period nobody scored in cannot
    // end a game, so any OT game has points on at least one side.
    isOvertime: game.isOvertimeGame ?? (homeOvertime > 0 || awayOvertime > 0),
    home: side(game.homeTeamIndex, game.homeTeamName, game.homeScore, game.homeQuarterScores, homeOvertime, game.homeTeamStats, 'home'),
    away: side(game.awayTeamIndex, game.awayTeamName, game.awayScore, game.awayQuarterScores, awayOvertime, game.awayTeamStats, 'away'),
    hasUser:
      userTeamIndex !== null &&
      (game.homeTeamIndex === userTeamIndex || game.awayTeamIndex === userTeamIndex),
    players,
  };
}
