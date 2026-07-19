import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { RecruitData } from '../extractors/extract-recruits';
import type { TeamData } from '../extractors/extract-teams';
import type {
  RecruitBoardEntry,
  RecruitBoardStage,
  RecruitingClassSummary,
  RecruitingOverview,
  RecruitingTimelineEntry,
} from '../shared/types';

/**
 * The save exposes a recruit's own overall decision stage (leaguewide, not
 * team-specific) and this team's own offer/commitment fields separately —
 * this is what actually answers "where does this recruit sit on OUR board."
 * See the RecruitBoardStage doc comment in shared/types.ts for the full
 * reasoning behind each case.
 *
 * IMPORTANT — `committedWeekNumber` is NOT the signal for "signed with us."
 * A first implementation used `committedWeekNumber > 0` to split signed vs.
 * lost and shipped visibly wrong results: real recruits who DID sign with
 * the user's team (confirmed via `signedTeamDisplayName`, itself resolved
 * from every team's own `CommittedPlayers` list — verified to have zero
 * cross-team collisions across all 1,538 real leaguewide signees, i.e. a
 * clean, authoritative, exclusive "who signed here" source) were showing up
 * as "Lost" because their board entry's `committedWeekNumber` had never been
 * populated, even though they were genuinely signed. `committedWeekNumber`
 * only means something for the pre-signing "soft committed" state; once
 * `recruitStage` reaches `'Signed'`, whether it was to this team is only
 * knowable by comparing `signedTeamDisplayName` against this team's own name.
 */
function deriveStage(r: RecruitData, teamName: string): RecruitBoardStage {
  if (r.recruitStage === 'Signed') {
    return r.signedTeamDisplayName === teamName ? 'signed' : 'lost';
  }
  if (r.committedWeekNumber > 0) return 'committed';
  if (r.scholarshipStatus === 'Offered') return 'offered';
  return 'watching';
}

function toBoardEntry(r: RecruitData, teamName: string): RecruitBoardEntry {
  return {
    playerId: r.playerId,
    firstName: r.firstName,
    lastName: r.lastName,
    position: r.position,
    stars: r.stars,
    overallRating: r.overallRating,
    archetype: r.archetype,
    developmentTrait: r.developmentTrait,
    heightInches: r.heightInches,
    weightPounds: r.weightPounds,
    hometown: r.hometown,
    homeState: r.homeState,
    portraitAssetName: r.portraitAssetName,
    classYear: r.classYear,
    nationalRank: r.nationalRank,
    positionRank: r.positionRank,
    stateRank: r.stateRank,
    isFavorite: r.isFavorite,
    nilExpectation: r.nilExpectation,
    currentNilOffer: r.currentNilOffer,
    committedWeekNumber: r.committedWeekNumber,
    stage: deriveStage(r, teamName),
    signedTeamDisplayName: r.signedTeamDisplayName,
  };
}

/** null rather than 0 when the team has never been ranked (0 is the save's own "unranked" convention, same as poll ranks elsewhere in this app). */
function rankOrNull(rank: number): number | null {
  return rank > 0 ? rank : null;
}

/**
 * Reads this season's recruiting board snapshot for a dynasty (see
 * extract-recruits.ts — the user's own team's board, up to 35 real prospects,
 * not the full leaguewide recruit pool). `classSummary`/`timeline` are both
 * derived here from `signed`+`committed` board entries, not separately
 * extracted, so they can never drift out of sync with the board itself.
 */
export function getRecruits(dynastyId: string, seasonId?: number): RecruitingOverview | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId || season.userTeamId === null) return undefined;

  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const userTeam = teams.find((t) => t.teamIndex === season.userTeamId);
  const teamName = userTeam?.displayName ?? dynasty.teamName ?? '';

  const raw = getSnapshot<RecruitData[]>(season.id, 'recruits') ?? [];
  const board = raw.map((r) => toBoardEntry(r, teamName));

  const incomingClass = board.filter((b) => b.stage === 'signed' || b.stage === 'committed');
  const signedCount = incomingClass.filter((b) => b.stage === 'signed').length;
  const committedCount = incomingClass.filter((b) => b.stage === 'committed').length;

  const positionCounts = new Map<string, number>();
  for (const p of incomingClass) {
    positionCounts.set(p.position, (positionCounts.get(p.position) ?? 0) + 1);
  }
  const positionBreakdown = [...positionCounts.entries()]
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => b.count - a.count);

  const averageStars =
    incomingClass.length === 0
      ? null
      : Math.round((incomingClass.reduce((sum, p) => sum + p.stars, 0) / incomingClass.length) * 10) / 10;

  const classSummary: RecruitingClassSummary = {
    signedCount,
    committedCount,
    averageStars,
    positionBreakdown,
    nationalClassRank: userTeam ? rankOrNull(userTeam.topClassRank) : null,
    conferenceClassRank: userTeam ? rankOrNull(userTeam.topClassConferenceRank) : null,
  };

  const timeline: RecruitingTimelineEntry[] = incomingClass
    .filter((p) => p.committedWeekNumber > 0)
    .map((p) => ({
      week: p.committedWeekNumber,
      playerId: p.playerId,
      playerName: `${p.firstName} ${p.lastName}`,
      position: p.position,
      stars: p.stars,
    }))
    .sort((a, b) => a.week - b.week);

  return { teamName, board, classSummary, timeline };
}
