import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { TeamHistoryData, TeamHistorySeasonData } from '../extractors/extract-team-history';
import type { CoachData } from '../extractors/extract-coaches';

/**
 * The user's own season-by-season record, AS THE GAME KEEPS IT.
 *
 * THE SAVE HAS THIS ALL ALONG, and the app was ignoring it for years it never
 * synced. `Team.TeamSeriesHistory` accumulates one row per dynasty season for
 * every one of the 143 teams, and it lives in the save file — verified by
 * reading a season-2 save directly, which already carried BOTH 2026 and 2027
 * for all 143. So a user who plays twelve years and only then installs
 * DynastyOS gets twelve years of record on their FIRST sync: wins, losses,
 * conference record, final poll rank, conference title and playoff results.
 *
 * That makes typing those years in by hand unnecessary, which is why the manual
 * editor now prefills and LOCKS anything this function can supply — see
 * components/common/ManualHistoryEditor.tsx.
 *
 * MATCHED BY COACH, NOT BY TEAM, and that is the interesting part. Each history
 * row carries the coach who led that season, so scanning EVERY team's history
 * for the user's coach finds their years at previous schools too — a dynasty
 * that moved from Akron to UCLA reconstructs both tenures without anyone
 * recording the move. Matching on the user's current team would silently drop
 * everything before it.
 *
 * THINNER THAN A SYNCED SEASON, deliberately kept distinct. There is no roster,
 * no box score, no player stat behind these years — only the season's outcome.
 * They are real and save-derived, but they are not the same thing as a season
 * the app captured, so they carry their own provenance and stay out of totals
 * that were computed from full data. See shared/programHistory.ts.
 */

export interface GameHistorySeason extends TeamHistorySeasonData {
  /** The program this season was played for — a dynasty can span schools. */
  teamName: string;
  teamIndex: number;
}

/**
 * The game's abbreviated coach name is first initial + surname ("C. Cuh").
 * Built from the coach record rather than parsed out of the history string, so
 * a surname containing a period or space can't break the comparison.
 */
function abbreviate(coach: Pick<CoachData, 'firstName' | 'lastName'>): string {
  const initial = coach.firstName.trim().charAt(0);
  return `${initial}. ${coach.lastName.trim()}`.trim().toLowerCase();
}

/**
 * Every season the game itself records for the user's coach, newest first.
 *
 * Reads the NEWEST sync's snapshot: history accumulates, so the latest capture
 * is a superset of every earlier one and there is nothing to merge.
 */
export function getGameHistorySeasons(dynastyId: string): GameHistorySeason[] {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => b.seasonYear - a.seasonYear);
  const newest = seasons[0];
  if (!newest) return [];

  const history = getSnapshot<TeamHistoryData[]>(newest.id, 'teamHistory');
  if (!history) return [];

  const coaches = getSnapshot<CoachData[]>(newest.id, 'coaches') ?? [];
  /*
    TEAM **AND** ID, never id alone. `PresentationId` is NOT unique across
    coaches — on this very archive id 256 resolves to "Allen Bobango" while the
    user's coach is "C. Cuh", so a bare `.find(c => c.presentationId === …)`
    silently returned a stranger and this function produced nothing at all.
    Same trap that made coaching trees record nothing; same fix as
    getCoachingTree, which pairs the id with the season's own team index.
  */
  const userCoach =
    coaches.find((c) => c.presentationId === newest.userCoachId && c.teamIndex === newest.userTeamId) ??
    // A coach who has since moved on still coached these seasons, so fall back
    // to the id alone rather than losing the history entirely.
    coaches.find((c) => c.presentationId === newest.userCoachId);
  if (!userCoach) return [];
  const wanted = abbreviate(userCoach);

  const out: GameHistorySeason[] = [];
  for (const team of history) {
    for (const season of team.seasons ?? []) {
      if (!season.coachName || season.coachName.trim().toLowerCase() !== wanted) continue;
      // A year with no games is the CURRENT season sitting in its own history
      // slot before it has been played — it would render as an 0-0 season that
      // never happened.
      if (season.wins === 0 && season.losses === 0 && season.ties === 0) continue;
      out.push({ ...season, teamName: team.teamName, teamIndex: team.teamIndex });
    }
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Quick lookup of which years the game can already account for. */
export function getGameHistoryYears(dynastyId: string): Set<number> {
  return new Set(getGameHistorySeasons(dynastyId).map((s) => s.year));
}
