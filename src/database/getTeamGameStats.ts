import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { RivalryData } from '../extractors/extract-rivalries';
import type { TeamGameStat } from '../shared/types';
import { isGamePlayed } from '../shared/gameStatus';

/**
 * Per-game team + opponent stat lines for ONE team (the user's own or any
 * league team), the raw material for the Statistics page's shared filter +
 * aggregation layer. Everything comes from the league-wide `schedule` snapshot,
 * so it works for any teamIndex — the team's own line is `teamStats`, the other
 * side is `opponentStats` (which is how "defense" / "X allowed" is derived).
 *
 * Classification mirrors getSchedule exactly (bowl → shared-conference →
 * non-conference; neutral/home/away from the site flag; rivalry from the
 * rivalries snapshot). Returns null if the dynasty/season/team can't resolve.
 * `teamIndex === null` means the dynasty's own user team.
 */
export function getTeamGameStats(dynastyId: string, teamIndex: number | null, seasonId?: number): TeamGameStat[] | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const resolvedTeam = teamIndex ?? season.userTeamId;
  if (resolvedTeam === null || resolvedTeam === undefined) return null;

  const games = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const conferenceByTeam = new Map(teams.map((t) => [t.teamIndex, t.conferenceName]));
  const rivalries = getSnapshot<RivalryData[]>(season.id, 'rivalries') ?? [];
  const rivalryOpponents = new Set(rivalries.map((r) => r.opponentTeamIndex));

  const teamConference = conferenceByTeam.get(resolvedTeam) ?? null;

  return games
    .filter((g) => g.homeTeamIndex === resolvedTeam || g.awayTeamIndex === resolvedTeam)
    .map((g): TeamGameStat => {
      const isHome = g.homeTeamIndex === resolvedTeam;
      const opponentIndex = isHome ? g.awayTeamIndex : g.homeTeamIndex;
      const opponentConference = opponentIndex !== null ? conferenceByTeam.get(opponentIndex) ?? null : null;
      const gameType: TeamGameStat['gameType'] = g.isBowlGame
        ? 'bowl'
        : teamConference !== null && teamConference === opponentConference
          ? 'conference'
          : 'non-conference';
      const played = isGamePlayed(g.status);
      return {
        gameId: g.gameId,
        week: g.week,
        opponent: (isHome ? g.awayTeamName : g.homeTeamName) ?? 'TBD',
        gameType,
        siteType: g.isNeutralSite ? 'neutral' : isHome ? 'home' : 'away',
        isRivalry: opponentIndex !== null && rivalryOpponents.has(opponentIndex),
        played,
        teamScore: played ? (isHome ? g.homeScore : g.awayScore) : null,
        opponentScore: played ? (isHome ? g.awayScore : g.homeScore) : null,
        teamStats: isHome ? g.homeTeamStats : g.awayTeamStats,
        opponentStats: isHome ? g.awayTeamStats : g.homeTeamStats,
      };
    })
    .sort((a, b) => a.week - b.week);
}
