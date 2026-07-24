import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { formatGameDate, formatKickoff } from './getSchedule';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { GameDetailData, GameDetailTeamSide, GameLogEntry } from '../shared/types';

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
  const rankOf = (idx: number | null): number | null => {
    const r = idx !== null ? teamByIndex.get(idx)?.mediaPollRank ?? 0 : 0;
    return r > 0 ? r : null;
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

  const side = (
    teamIndex: number | null,
    name: string | null,
    score: number,
    quarterScores: number[],
    stats: GameDetailTeamSide['stats'],
  ): GameDetailTeamSide => ({
    teamIndex: teamIndex ?? -1,
    name: name ?? 'TBD',
    score,
    quarterScores,
    stats,
    currentRank: rankOf(teamIndex),
    isUser: teamIndex !== null && teamIndex === userTeamIndex,
  });

  return {
    gameId: game.gameId,
    week: game.week,
    played: game.status !== 'Unplayed',
    status: game.status,
    dayOfWeek: game.dayOfWeek,
    kickoffTime: formatKickoff(game.kickoffMinutes),
    date: formatGameDate(game.gameMonth, game.gameDay),
    isBowlGame: game.isBowlGame,
    isNationalChampionship: game.isNationalChampionship,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    isNeutralSite: game.isNeutralSite,
    gameType,
    conferenceName,
    home: side(game.homeTeamIndex, game.homeTeamName, game.homeScore, game.homeQuarterScores, game.homeTeamStats),
    away: side(game.awayTeamIndex, game.awayTeamName, game.awayScore, game.awayQuarterScores, game.awayTeamStats),
    hasUser:
      userTeamIndex !== null &&
      (game.homeTeamIndex === userTeamIndex || game.awayTeamIndex === userTeamIndex),
    players,
  };
}
