import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
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

function toCoach(c: CoachData, teamNameByLogo: Map<number, string>): Coach {
  return {
    presentationId: c.presentationId,
    teamIndex: c.teamIndex,
    firstName: c.firstName,
    lastName: c.lastName,
    portraitAssetName: c.portraitAssetName,
    position: c.position,
    isUserControlled: c.isUserControlled,
    yearsCoaching: c.yearsCoaching,
    // AlmaMater is a TEAM_LOGO id, NOT a teamIndex — resolve against the logo
    // map (see extract-teams.ts). Placeholder/pool schools are excluded from the
    // map, so a coach whose alma isn't a real FBS school resolves to null.
    almaMaterName: teamNameByLogo.get(c.almaMater) ?? null,
    age: c.age,
    dominantArchetype: c.dominantArchetype,
    seasonsWithTeam: c.seasonsWithTeam,
    currentJobSecurityStatus: c.currentJobSecurityStatus,
    // Nullish-coalesced like the contract fields below: seasons synced before
    // these were extracted have no value in their snapshot, and a stale season
    // should read as "not available" rather than NaN.
    currentJobSecurityPercentage: c.currentJobSecurityPercentage ?? null,
    seasonStartJobSecurityStatus: c.seasonStartJobSecurityStatus ?? null,
    currentContractExpectation: c.currentContractExpectation ?? null,
    earnedContractPointsThisYear: c.earnedContractPointsThisYear ?? null,
    coachPoints: c.coachPoints ?? null,
    contractGoals: c.contractGoals ?? null,
    contractSalary: c.contractSalary ?? 0,
    contractLength: c.contractLength ?? 0,
    contractYearsRemaining: c.contractYearsRemaining ?? 0,
    personality: c.personality,
    careerStats: c.careerStats,
  };
}


/**
 * Builds the TEAM_LOGO -> school-name map used to resolve Coach.AlmaMater.
 * AlmaMater indexes EA's global school list (the TEAM_LOGO id space), not
 * teamIndex — see extract-teams.ts. Placeholder/pool teams (teamIndex 255:
 * Practice, FCS East/West/...) are excluded so a coach whose alma isn't a real
 * FBS school resolves to null rather than showing "Practice". Requires a
 * re-synced season (older 'teams' snapshots predate the logoId field).
 */
function buildLogoNameMap(teams: TeamData[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const t of teams) {
    if (t.teamIndex === FCS_POOL_TEAM_INDEX) continue;
    if (t.logoId === undefined || t.logoId === null) continue;
    if (!map.has(t.logoId)) map.set(t.logoId, t.displayName);
  }
  return map;
}

/**
 * Reads the coaching staff snapshot for a dynasty's given season, resolving
 * each coach's alma mater against that season's teams snapshot by TEAM_LOGO id
 * (see extract-teams.ts / toCoach — AlmaMater is a global logo id, not a
 * teamIndex, so this is a plain map lookup, not a live save-file query).
 */
export function getCoaches(dynastyId: string, seasonId?: number): CoachOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const teamNameByLogo = buildLogoNameMap(teams);

  const allCoaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
  const staff = allCoaches
    .filter((c) => c.teamIndex === season.userTeamId)
    .map((c) => toCoach(c, teamNameByLogo))
    .sort((a, b) => positionSortIndex(a.position) - positionSortIndex(b.position));

  const headCoach = staff.find((c) => c.position === 'HeadCoach') ?? null;
  // Falls back to headCoach if nobody on this team's staff resolved
  // IsUserControlled — shouldn't happen in practice (every real save tested
  // has exactly one), but a silent "nobody" is worse than assuming HC.
  const userCoach = staff.find((c) => c.isUserControlled) ?? headCoach;

  return { headCoach, userCoach, staff };
}
