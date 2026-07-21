import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';
import type { Coach, CoachOverview } from '../shared/types';

/** HeadCoach first, then OffensiveCoordinator/DefensiveCoordinator, then anything else alphabetically — only these three position values exist on the real save tested, but this stays a stable order if a richer save adds more. */
const POSITION_PRIORITY: Record<string, number> = {
  HeadCoach: 0,
  OffensiveCoordinator: 1,
  DefensiveCoordinator: 2,
};

function positionSortIndex(position: string): number {
  return POSITION_PRIORITY[position] ?? 3;
}

function toCoach(c: CoachData, teamNameByIndex: Map<number, string>): Coach {
  return {
    teamIndex: c.teamIndex,
    firstName: c.firstName,
    lastName: c.lastName,
    portraitAssetName: c.portraitAssetName,
    position: c.position,
    isUserControlled: c.isUserControlled,
    yearsCoaching: c.yearsCoaching,
    almaMaterName: teamNameByIndex.get(c.almaMater) ?? null,
    age: c.age,
    dominantArchetype: c.dominantArchetype,
    seasonsWithTeam: c.seasonsWithTeam,
    currentJobSecurityStatus: c.currentJobSecurityStatus,
    contractSalary: c.contractSalary ?? 0,
    contractLength: c.contractLength ?? 0,
    contractYearsRemaining: c.contractYearsRemaining ?? 0,
    personality: c.personality,
    careerStats: c.careerStats,
  };
}

/**
 * Reads the coaching staff snapshot for a dynasty's given season, resolving
 * each coach's alma mater against that season's teams snapshot (see
 * extract-coaches.ts — AlmaMater is a raw TeamIndex, not a franchise
 * reference, so this is a plain map lookup, not a live save-file query).
 */
export function getCoaches(dynastyId: string, seasonId?: number): CoachOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const teamNameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

  const allCoaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
  const staff = allCoaches
    .filter((c) => c.teamIndex === season.userTeamId)
    .map((c) => toCoach(c, teamNameByIndex))
    .sort((a, b) => positionSortIndex(a.position) - positionSortIndex(b.position));

  const headCoach = staff.find((c) => c.position === 'HeadCoach') ?? null;
  // Falls back to headCoach if nobody on this team's staff resolved
  // IsUserControlled — shouldn't happen in practice (every real save tested
  // has exactly one), but a silent "nobody" is worse than assuming HC.
  const userCoach = staff.find((c) => c.isUserControlled) ?? headCoach;

  return { headCoach, userCoach, staff };
}
