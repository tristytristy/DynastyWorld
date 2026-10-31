import { getLargestTable, nonEmpty, openFranchiseFile } from './lib/franchise';
import { formatSaveWeek } from '../shared/syncPhase';
import type { SavePeek } from '../shared/types';

/**
 * Reads just enough of a save file to say WHOSE dynasty it is — the school, the
 * coach, the year and where in the calendar it sits.
 *
 * The Import picker exists because "DYNASTY-EVANZSYNC" tells a user nothing;
 * "Sac State — Patrick Evanz, 2026, Week 1" tells them everything. Only three
 * tables are read (SeasonInfo, Coach, Team) with a handful of fields each,
 * rather than the full extraction the real import performs, so a folder of
 * saves can be identified quickly enough to do it on the fly.
 *
 * Returns null for anything that isn't a readable dynasty save — a corrupt
 * file, a roster or teambuilder file that slipped through the name filter, or a
 * save from a version whose tables don't match. The picker shows those by
 * filename instead of hiding them, since a user looking for a specific save
 * should still see it listed.
 */
export async function peekSave(filePath: string): Promise<SavePeek | null> {
  try {
    const franchise = await openFranchiseFile(filePath);

    const seasonInfoTable = getLargestTable(franchise, 'SeasonInfo');
    await seasonInfoTable.readRecords([
      'CurrentSeasonYear',
      'CurrentWeek',
      'CurrentWeekType',
      'CurrentOffseasonStage',
    ]);
    const seasonInfo = seasonInfoTable.records[0];
    if (!seasonInfo) return null;

    const coachTable = getLargestTable(franchise, 'Coach');
    await coachTable.readRecords(['IsUserControlled', 'TeamIndex', 'FirstName', 'LastName', 'Position', 'YearsCoaching']);
    // A save can hold several user profiles (spectator coaches — see
    // pickPrimaryUserCoach in extract-coaches.ts); the career coach is the
    // one with tenure, and that's whose name the import dialog should show.
    const userCoach = nonEmpty(coachTable.records)
      .filter((r) => String(r.IsUserControlled) === 'true')
      .reduce(
        (best, r) => (best === null || Number(r.YearsCoaching) > Number(best.YearsCoaching) ? r : best),
        null as (typeof coachTable.records)[number] | null,
      );

    const teamTable = getLargestTable(franchise, 'Team');
    await teamTable.readRecords(['DisplayName', 'TeamIndex']);
    const teamIndex = userCoach ? Number(userCoach.TeamIndex) : -1;
    const team = nonEmpty(teamTable.records).find((r) => Number(r.TeamIndex) === teamIndex);

    return {
      teamName: team ? String(team.DisplayName) : null,
      coachName: userCoach ? `${String(userCoach.FirstName)} ${String(userCoach.LastName)}`.trim() : null,
      coachPosition: userCoach ? String(userCoach.Position) : null,
      seasonYear: Number(seasonInfo.CurrentSeasonYear),
      weekLabel: formatSaveWeek({
        currentWeekType: String(seasonInfo.CurrentWeekType),
        currentOffseasonStage: Number(seasonInfo.CurrentOffseasonStage),
        currentWeek: Number(seasonInfo.CurrentWeek),
      }),
    };
  } catch {
    return null;
  }
}
