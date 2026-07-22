import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type OpenFranchise,
} from './lib/franchise';

/**
 * The coach's lifetime coaching record, tracked by the game itself across
 * their entire career — not scoped to what this app has imported, and may
 * predate the user's own save. Resolved from Coach.CareerStats, a reference
 * to a CareerCoachStats record (same resolution mechanism as player
 * CareerStats in extract-stats.ts).
 */
export interface CareerCoachStats {
  wins: number;
  losses: number;
  winsAtCurrentSchool: number;
  lossesAtCurrentSchool: number;
  bowlWins: number;
  bowlLosses: number;
  confChampWins: number;
  confChampLosses: number;
  confChampWinStreak: number;
  ncWins: number;
  ncLosses: number;
  recentYearNCWon: number;
  playoffWins: number;
  playoffLosses: number;
  timesFired: number;
  rivalWins: number;
  rivalLosses: number;
  rivalWinStreak: number;
  top25Wins: number;
  top25Losses: number;
  draftPicks: number;
  firstRoundDraftPicks: number;
  top5RecruitClasses: number;
  playersMaxProgressed: number;
  numPrestigeIncreases: number;
}

export interface CoachData {
  /**
   * The coach's stable per-entity id (Coach.PresentationId). Verified constant
   * across a school move (SMU→UCLA kept 710) AND across a portrait/name change
   * on a created coach (256 unchanged) — see docs/coach-movement-research.md.
   * This is the ONLY safe key for tracking a coach's journey across teams and
   * saves; name and asset fields are not (users edit names; the portrait fields
   * change with the face).
   */
  presentationId: number;
  teamIndex: number;
  /** The coach's PREVIOUS team (Coach.PrevTeamIndex); 255 = none. Set to the old school right after a move — the signal for move-year season attribution. */
  prevTeamIndex: number;
  firstName: string;
  lastName: string;
  /**
   * Save-provided portrait asset identity, e.g. `Unique_C_AbellScott_695` or
   * `Generic_0070_C_T0069_D_1_3`. This matches the coach image filenames in
   * `public/assets/coaches` as `nilcp_${assetName}.webp`.
   */
  portraitAssetName: string | null;
  position: string;
  yearsCoaching: number;
  isUserControlled: boolean;
  /**
   * Raw TeamIndex of the coach's alma mater — despite the name, this is a
   * plain integer matching Team.TeamIndex, not a franchise-table reference
   * (getReferenceDataByKey returns null for this field). Verified against a
   * real save: e.g. rawValue 88 resolved to Temple, 21 to Colorado, all
   * real FBS schools. Resolved to a display name at query time by joining
   * against the teams snapshot (see getCoaches.ts), same as other
   * teamIndex-keyed data (opponent names, conference membership). A handful
   * of coaches (6/493 on the test save) carry an out-of-range value (150/151)
   * that doesn't match any real team — presumably a "none assigned" sentinel
   * — those resolve to null rather than a guessed name.
   */
  almaMater: number;
  age: number;
  /** CoachTalentArcheType enum, e.g. "ProgramBuilder", "EliteRecruiter". */
  dominantArchetype: string;
  /** Save-native "years at current school" — cross-check against the app's own imported-season count at display time; the two can legitimately disagree (this predates the app's first import). */
  seasonsWithTeam: number;
  /** JobSecurityStatus enum: "Safe" | "SafeForNow" | "Low" | "HotSeat" | "Invalid". */
  currentJobSecurityStatus: string;
  /** Contract terms straight off the Coach record (same fields the coach editor writes). */
  contractSalary: number;
  contractLength: number;
  contractYearsRemaining: number;
  /** Personality enum, e.g. "Leader", "Intense", "Unpredictable". */
  personality: string;
  /**
   * Null when Coach.CareerStats doesn't resolve (observed: never on real
   * head-coach/coordinator records tested, but not guaranteed for every
   * position) — see resolveReferenceWithTable in lib/franchise.ts.
   */
  careerStats: CareerCoachStats | null;
}

const FIELDS = [
  'PresentationId',
  'PrevTeamIndex',
  'FirstName',
  'LastName',
  'TeamIndex',
  'AssetName',
  'GenericHeadAssetName',
  'Position',
  'YearsCoaching',
  'IsUserControlled',
  'AlmaMater',
  'Age',
  'DominantArchetype',
  'SeasonsWithTeam',
  'CurrentJobSecurityStatus',
  'ContractSalary',
  'ContractLength',
  'ContractYearsRemaining',
  'Personality',
  'CareerStats',
];

function mapCareerCoachStats(r: { [key: string]: unknown }): CareerCoachStats {
  return {
    wins: Number(r.Wins),
    losses: Number(r.Losses),
    winsAtCurrentSchool: Number(r.WinsAtCurrentSchool),
    lossesAtCurrentSchool: Number(r.LossesAtCurrentSchool),
    bowlWins: Number(r.BowlWins),
    bowlLosses: Number(r.BowlLosses),
    confChampWins: Number(r.ConfChampWins),
    confChampLosses: Number(r.ConfChampLosses),
    confChampWinStreak: Number(r.ConfChampWinStreak),
    ncWins: Number(r.NCWins),
    ncLosses: Number(r.NCLosses),
    recentYearNCWon: Number(r.RecentYearNCWon),
    playoffWins: Number(r.PlayoffWins),
    playoffLosses: Number(r.PlayoffLosses),
    timesFired: Number(r.TimesFired),
    rivalWins: Number(r.RivalWins),
    rivalLosses: Number(r.RivalLosses),
    rivalWinStreak: Number(r.RivalWinStreak),
    top25Wins: Number(r.Top25Wins),
    top25Losses: Number(r.Top25Losses),
    draftPicks: Number(r.DraftPicks),
    firstRoundDraftPicks: Number(r.FirstRoundDraftPicks),
    top5RecruitClasses: Number(r.Top5RecruitClasses),
    playersMaxProgressed: Number(r.PlayersMaxProgressed),
    numPrestigeIncreases: Number(r.NumPrestigeIncreases),
  };
}

export async function extractCoaches(franchise: OpenFranchise): Promise<CoachData[]> {
  const table = getLargestTable(franchise, 'Coach');
  await table.readRecords(FIELDS);
  await preloadAllInstances(franchise, 'CareerCoachStats');

  return nonEmpty(table.records)
    .filter((r) => r.LastName)
    .map((r) => {
      const careerStatsResolved = resolveReferenceWithTable(franchise, r, 'CareerStats');
      return {
        presentationId: Number(r.PresentationId),
        teamIndex: Number(r.TeamIndex),
        prevTeamIndex: Number(r.PrevTeamIndex),
        firstName: String(r.FirstName),
        lastName: String(r.LastName),
        portraitAssetName:
          (String(r.AssetName || '') || String(r.GenericHeadAssetName || '') || '').trim() || null,
        position: String(r.Position),
        yearsCoaching: Number(r.YearsCoaching),
        isUserControlled: Boolean(r.IsUserControlled),
        almaMater: Number(r.AlmaMater),
        age: Number(r.Age),
        dominantArchetype: String(r.DominantArchetype),
        seasonsWithTeam: Number(r.SeasonsWithTeam),
        currentJobSecurityStatus: String(r.CurrentJobSecurityStatus),
        contractSalary: Number(r.ContractSalary),
        contractLength: Number(r.ContractLength),
        contractYearsRemaining: Number(r.ContractYearsRemaining),
        personality: String(r.Personality),
        careerStats: careerStatsResolved ? mapCareerCoachStats(careerStatsResolved.record) : null,
      };
    });
}

/**
 * The dynasty's team, identified by its user-controlled coach — any
 * position, not just Head Coach. Originally required `position ===
 * 'HeadCoach'` too, which meant importing an Offensive/Defensive
 * Coordinator-controlled dynasty threw ("Could not determine which team
 * this dynasty belongs to") instead of importing at all, since no row could
 * ever match both conditions in that case. `IsUserControlled` is true for
 * exactly one coach regardless of their position, so matching on it alone
 * is strictly correct and still deterministic.
 */
export function findUserTeamIndex(coaches: CoachData[]): number | undefined {
  return coaches.find((c) => c.isUserControlled)?.teamIndex;
}
