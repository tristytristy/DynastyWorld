import {
  getCurrentSeason,
  getDynastyById,
  getSeasonById,
  getSnapshot,
  resolveSeasonHeadCoach,
  resolveSeasonTeam,
} from './helpers';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { DynastyTheme, GameSummary, SeasonOverview } from '../shared/types';

/**
 * Team colors for a SPECIFIC season — the coach-journey theming source. Resolves
 * to the team the user actually coached that season (season.user_team_id), so
 * viewing a previous season themes the app in the previous school's colors.
 * Falls back to the dynasty's current-team theme for a history-only season (no
 * per-season team) so the app is never left un-themed.
 */
export function getSeasonTheme(dynastyId: string, seasonId?: number): DynastyTheme | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;
  const fallback: DynastyTheme = {
    teamName: dynasty.teamName ?? dynasty.label,
    primaryColor: dynasty.teamColorPrimary,
    secondaryColor: dynasty.teamColorSecondary,
  };
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return fallback;
  const team = resolveSeasonTeam(season);
  if (!team) return fallback;
  return { teamName: team.displayName, primaryColor: team.primaryColorHex, secondaryColor: team.secondaryColorHex };
}

function toGameSummary(game: GameData, userTeamIndex: number): GameSummary {
  const isHome = game.homeTeamIndex === userTeamIndex;
  const opponent = (isHome ? game.awayTeamName : game.homeTeamName) ?? 'TBD';
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  const played = game.status !== 'Unplayed';

  let result: GameSummary['result'] = null;
  if (played) {
    if (teamScore > opponentScore) result = 'W';
    else if (teamScore < opponentScore) result = 'L';
    else result = 'T';
  }

  return {
    week: game.week,
    opponent,
    isHome,
    status: game.status,
    teamScore: played ? teamScore : null,
    opponentScore: played ? opponentScore : null,
    result,
  };
}

export function getSeasonOverview(dynastyId: string, seasonId?: number): SeasonOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const userTeamIndex = season.userTeamId;
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((t) => t.teamIndex === userTeamIndex);
  if (!userTeam) return undefined;

  const schedule = getSnapshot<GameData[]>(season.id, 'schedule') ?? [];
  const teamGames = schedule.filter(
    (g) => g.homeTeamIndex === userTeamIndex || g.awayTeamIndex === userTeamIndex,
  );
  const played = teamGames.filter((g) => g.status !== 'Unplayed').sort((a, b) => a.week - b.week);
  const upcoming = teamGames.filter((g) => g.status === 'Unplayed').sort((a, b) => a.week - b.week);

  return {
    dynastyId: dynasty.id,
    dynastyLabel: dynasty.label,
    teamName: userTeam.displayName,
    seasonYear: season.seasonYear,
    headCoach: resolveSeasonHeadCoach(season, userTeam.teamIndex),
    lastSyncedAt: season.extractedAt,
    record: {
      wins: userTeam.confWins + userTeam.nonConfWins,
      losses: userTeam.confLosses + userTeam.nonConfLosses,
    },
    conferenceRecord: { wins: userTeam.confWins, losses: userTeam.confLosses },
    rankings: {
      media: userTeam.mediaPollRank > 0 ? userTeam.mediaPollRank : null,
      coaches: userTeam.coachesPollRank > 0 ? userTeam.coachesPollRank : null,
      cfp: userTeam.cfpRank > 0 ? userTeam.cfpRank : null,
    },
    recruitingClassRank: userTeam.topClassRank > 0 ? userTeam.topClassRank : null,
    teamPrestige: userTeam.teamPrestige > 0 ? userTeam.teamPrestige : null,
    recentGames: played
      .slice(-3)
      .reverse()
      .map((g) => toGameSummary(g, userTeamIndex)),
    upcomingGames: upcoming.slice(0, 3).map((g) => toGameSummary(g, userTeamIndex)),
  };
}
