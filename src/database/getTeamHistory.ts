import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { isFcsPool } from '../shared/fcsPool';
import type { TeamHistoryData } from '../extractors/extract-team-history';
import type { TeamHistoryView } from '../shared/types';

/**
 * One program's history — all-time résumé, season-by-season, and the record
 * book. Works for ANY school, which is the point: the History page used to have
 * nothing to say about a team the user wasn't coaching.
 *
 * Read from the `teamHistory` snapshot, so it needs a sync taken with this
 * version onward. Seasons synced before it return null and the page says so
 * rather than rendering an empty program.
 */
export function getTeamHistory(
  dynastyId: string,
  teamIndex: number,
  seasonId?: number,
): TeamHistoryView | null {
  if (isFcsPool(teamIndex)) return null;

  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const all = getSnapshot<TeamHistoryData[]>(season.id, 'teamHistory');
  if (!all) return null;

  const entry = all.find((t) => t.teamIndex === teamIndex);
  if (!entry) return null;

  const allTime = entry.allTime;
  return {
    teamIndex: entry.teamIndex,
    teamName: entry.teamName,
    yearSchoolEstablished: entry.yearSchoolEstablished,
    yearProgramStarted: entry.yearProgramStarted,
    allTime,
    /*
      Newest first, and only years the program actually played. The save
      pre-allocates the CURRENT season's row before a game is played (0-0), and
      showing that as a season would read as a winless year — so a row with no
      games and no postseason result is dropped until it means something.
    */
    seasons: entry.seasons.filter(
      (s) =>
        s.wins + s.losses + s.ties > 0 ||
        s.nationalResult !== null ||
        s.semiFinalResult !== null ||
        s.quarterFinalResult !== null ||
        s.firstRoundResult !== null,
    ),
    careerRecords: entry.careerRecords,
    seasonRecords: entry.seasonRecords,
  };
}
