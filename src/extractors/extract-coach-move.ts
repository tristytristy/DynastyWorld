import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type OpenFranchise,
} from './lib/franchise';

/**
 * The user coach's most recent SCHOOL-to-SCHOOL move, read from the game's own
 * `CoachTransactionHistoryEntry` log (which records every hiring: the coach, old
 * and new team + position, and the season year/week/stage it happened). Used for
 * move-year season attribution: a coach moves after the bowl (≈week 18) but
 * before the season-year rolls over, so there's a window where `Coach.TeamIndex`
 * already points at the NEW school while the just-completed season was coached at
 * the OLD one. This tells the importer when that's the case.
 *
 * `seasonYearRelative` is the transaction's SeasonYear as the save stores it —
 * relative to the calendar base (same relative index used everywhere else, e.g.
 * `league.seasonYear - league.baseCalendarYear`). Resolve to absolute at the
 * call site with `baseCalendarYear + seasonYearRelative`.
 */
export interface CoachMoveData {
  fromTeamIndex: number;
  toTeamIndex: number;
  seasonYearRelative: number;
  seasonWeek: number;
  seasonStage: string;
}

export async function extractUserCoachLastMove(
  franchise: OpenFranchise,
  userCoachPresentationId: number | null,
): Promise<CoachMoveData | null> {
  // 0 = a coach with no real id (generated coordinators) — can't be matched.
  if (!userCoachPresentationId) return null;

  const table = getLargestTable(franchise, 'CoachTransactionHistoryEntry');
  await table.readRecords();
  // The transaction's Coach/OldTeam/NewTeam are references into the Coach/Team
  // tables — load all instances so resolveReferenceWithTable can index into them.
  await preloadAllInstances(franchise, 'Coach');
  await preloadAllInstances(franchise, 'Team');

  let best: (CoachMoveData & { transactionId: number }) | null = null;
  for (const r of nonEmpty(table.records)) {
    const coach = resolveReferenceWithTable(franchise, r, 'Coach');
    if (!coach || Number(coach.record.PresentationId) !== userCoachPresentationId) continue;

    const oldTeam = resolveReferenceWithTable(franchise, r, 'OldTeam');
    const newTeam = resolveReferenceWithTable(franchise, r, 'NewTeam');
    // A school move needs both teams resolved and different. A pool hire (no old
    // team) or a same-team promotion (OC→HC) is not a school change — skip it.
    if (!oldTeam || !newTeam) continue;
    const fromTeamIndex = Number(oldTeam.record.TeamIndex);
    const toTeamIndex = Number(newTeam.record.TeamIndex);
    if (fromTeamIndex === toTeamIndex) continue;

    const transactionId = Number(r.TransactionId);
    if (!best || transactionId > best.transactionId) {
      best = {
        fromTeamIndex,
        toTeamIndex,
        seasonYearRelative: Number(r.SeasonYear),
        seasonWeek: Number(r.SeasonWeek),
        seasonStage: String(r.SeasonStage),
        transactionId,
      };
    }
  }

  if (!best) return null;
  return {
    fromTeamIndex: best.fromTeamIndex,
    toTeamIndex: best.toTeamIndex,
    seasonYearRelative: best.seasonYearRelative,
    seasonWeek: best.seasonWeek,
    seasonStage: best.seasonStage,
  };
}
