import { hashSeed } from '../shared/storyVariants';
import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
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
   * The coach's alma mater as a global school id — a plain integer, NOT a
   * franchise reference (getReferenceDataByKey returns null). CRUCIAL: despite
   * the earlier assumption, this is NOT a Team.TeamIndex — it's the TEAM_LOGO
   * id space (EA's full alphabetical school master list, FBS + FCS + others).
   * Resolving it against teamIndex produces confidently-WRONG schools (Kirby
   * Smart alma=34 -> teamIndex 34 = Indiana, but logoId 34 = Georgia, his real
   * alma). Resolved to a name at query time against the teams snapshot's
   * logoId (see getCoaches.ts). Values that don't map to a real FBS school
   * (non-FBS almas, sentinels 150/151) resolve to null.
   */
  almaMater: number;
  age: number;
  /** CoachTalentArcheType enum, e.g. "ProgramBuilder", "EliteRecruiter". */
  dominantArchetype: string;
  /** Save-native "years at current school" — cross-check against the app's own imported-season count at display time; the two can legitimately disagree (this predates the app's first import). */
  seasonsWithTeam: number;
  /** JobSecurityStatus enum: "Safe" | "SafeForNow" | "Low" | "HotSeat" | "Invalid". */
  currentJobSecurityStatus: string;
  /**
   * The AD-expectations block, verified 2026-07-29 against DYNASTY-JMUTESTER —
   * the save behind the in-game "AD Expectations" screen the user supplied.
   * `currentJobSecurityPercentage` is the same 98 that screen shows, so these
   * ARE the fields behind it.
   *
   * What is NOT here, and why: the three goal LINES on that screen ("Make a Bowl
   * Game in the next 4 seasons", + its 100 coach-point reward) are not in the
   * save. Each `CoachContractGoalSummaryEntry` holds only status/progress plus a
   * `CoachContractGoal` reference into **table 16483** — and this save's tables
   * run 4096–6385, so that catalogue ships with the game, not the dynasty. A raw
   * scan of the file for the goal text finds nothing either. Status and progress
   * per slot are readable; the wording and rewards are not.
   */
  currentJobSecurityPercentage: number;
  /** Where job security stood when the season began — the baseline the current number moved from. */
  seasonStartJobSecurityStatus: string;
  /** The AD's headline expectation as an enum, e.g. "Win8Games". The one goal that IS readable. */
  currentContractExpectation: string;
  /** Coach points earned toward this contract year, and the coach's unspent balance. */
  earnedContractPointsThisYear: number;
  coachPoints: number;
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
  /**
   * The AD's three goal slots, attached to the USER's coach only (they're
   * user-scoped, not per-coach — the save stores them as three separate
   * single-row `CoachContractGoalSummaryEntry` tables keyed to the user entity).
   * Riding along on the coach record keeps them inside the snapshot that already
   * exists rather than adding a snapshot key for three rows.
   */
  contractGoals?: ContractGoalSlot[];
}

/**
 * One AD goal as the save actually stores it. `goalId` is the row this slot
 * points at in the game's goal catalogue — the catalogue itself is not in the
 * save (see the note on `currentContractExpectation`), so the goal's WORDING and
 * its coach-point reward can't be read. What can: whether it's live, how far
 * along it is, and the job-security reading attached to it.
 */
export interface ContractGoalSlot {
  goalId: number | null;
  /** GoalStatus enum, observed: "InProgress". */
  status: string;
  progress: number;
  isHotSeat: boolean;
  jobSecurity: number;
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
  'CurrentJobSecurityPercentage',
  'SeasonStartJobSecurityStatus',
  'CurrentContractExpectation',
  'EarnedContractPoints_ThisYear',
  'CoachPoints',
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

/**
 * The AD's goal slots. Each one is its OWN single-row table — the save carries
 * three tables all named `CoachContractGoalSummaryEntry`, not three rows in one
 * — so this reads every instance rather than `getLargestTable`'s single biggest.
 * Verified against DYNASTY-JMUTESTER (3 slots, JobSecurity 98, matching the
 * in-game screen) and DYNASTY-EVANZSYNC (3 slots, different goal ids).
 */
async function extractContractGoals(franchise: OpenFranchise): Promise<ContractGoalSlot[]> {
  const tables = franchise.getAllTablesByName('CoachContractGoalSummaryEntry') as unknown as {
    records: {
      isEmpty: boolean;
      getReferenceDataByKey(key: string): { tableId: number; rowNumber: number } | null;
      [key: string]: unknown;
    }[];
    readRecords(): Promise<void>;
  }[];
  if (!tables || tables.length === 0) return [];

  const slots: ContractGoalSlot[] = [];
  for (const table of tables) {
    await table.readRecords();
    for (const record of table.records) {
      if (record.isEmpty) continue;
      const ref = record.getReferenceDataByKey('CoachContractGoal');
      slots.push({
        goalId: ref && ref.tableId ? ref.rowNumber : null,
        status: String(record.StatusGoal ?? ''),
        progress: Number(record.ProgressGoal ?? 0),
        isHotSeat: Boolean(record.IsHotSeat),
        jobSecurity: Number(record.JobSecurity ?? 0),
      });
    }
  }
  return slots;
}

export async function extractCoaches(franchise: OpenFranchise): Promise<CoachData[]> {
  const table = getLargestTable(franchise, 'Coach');
  await table.readRecords(FIELDS);
  await preloadAllInstances(franchise, 'CareerCoachStats');
  const contractGoals = await extractContractGoals(franchise);

  return nonEmpty(table.records)
    .filter((r) => r.LastName)
    .map((r) => {
      const careerStatsResolved = resolveReferenceWithTable(franchise, r, 'CareerStats');
      return {
        presentationId: resolvePresentationId(r),
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
        currentJobSecurityPercentage: Number(r.CurrentJobSecurityPercentage),
        seasonStartJobSecurityStatus: String(r.SeasonStartJobSecurityStatus),
        currentContractExpectation: String(r.CurrentContractExpectation),
        earnedContractPointsThisYear: Number(r.EarnedContractPoints_ThisYear),
        coachPoints: Number(r.CoachPoints),
        contractSalary: Number(r.ContractSalary),
        contractLength: Number(r.ContractLength),
        contractYearsRemaining: Number(r.ContractYearsRemaining),
        personality: String(r.Personality),
        careerStats: careerStatsResolved ? mapCareerCoachStats(careerStatsResolved.record) : null,
        // User-scoped, so it rides on the one coach it belongs to.
        ...(Boolean(r.IsUserControlled) && contractGoals.length > 0 ? { contractGoals } : {}),
      };
    });
}

/**
 * A COACH ID FOR COACHES THE SAVE NEVER GAVE ONE.
 *
 * `PresentationId` is the app's identity anchor for a coach — it links a coach
 * across seasons and schools, and `user_coach_id` on the season row is what
 * opens the Hall of Champions. The save leaves it 0 for coaches it didn't ship
 * with an identity, which was written off as "generated coordinators" and
 * treated as no id at all.
 *
 * THAT ASSUMPTION BREAKS ON MODDED ROSTERS. Measured across four real saves: a
 * vanilla save has 0 of 143 head coaches without an id (taking over a real
 * coach keeps its own — Willie Fritz came through as 542), while the '07 mod's
 * roster has 69 of 144 without one. Those users' seasons stored
 * `user_coach_id = null`, so the Hall told them to "sync once" forever. One of
 * them proved the cause by hand-editing his id and watching the Hall open.
 *
 * So an idless coach gets a stable id derived from their name. Deterministic,
 * so it is the same on every sync and the coach stays the same person across
 * seasons and schools — which is the whole job of the field.
 *
 * NEGATIVE ON PURPOSE. Real ids are small positives — observed 3..424 in one
 * save, plus 256, 542 and 785 elsewhere — so a negative range cannot collide
 * with one, and is instantly recognisable as synthetic. The user who hand-fixed
 * his own save picked 108 and unknowingly landed on an id three other coaches
 * already had; this avoids that entire class of mistake.
 *
 * Two coaches sharing a name still collide. That is no worse than today, where
 * every idless coach in the save collides on 0 — 285 of them in one save.
 */
function resolvePresentationId(record: FranchiseRecord): number {
  const stored = Number(record.PresentationId);
  if (stored) return stored;
  const name = `${String(record.FirstName ?? '')} ${String(record.LastName ?? '')}`.trim().toLowerCase();
  if (!name) return 0;
  return -(hashSeed(name) % 2_000_000_000) - 1;
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
