import { extractAll } from '../extractors/extract-all';
import type { ExtractionData } from '../extractors/extract-all';
import {
  createDynasty,
  createSeason,
  getDynastyById,
  getDynastyBySavePath,
  getSeasonByYear,
  recordRankingSnapshot,
  saveSnapshot,
  saveSnapshotCompressed,
  updateDynasty,
  type Dynasty,
  type Season,
} from './helpers';
import { autoRecalculateTeamAwards } from './getTeamAwards';
import type { ImportResult } from '../shared/types';

/**
 * The save's own week counter (SeasonInfo.CurrentWeek) reads 0 once the
 * season reaches OffSeason/PreSeason stages — confirmed directly against
 * several real saves, including a fully-completed one — so it can't be
 * trusted to label a ranking snapshot. Deriving "last played week" from the
 * user's own played games instead works in every season stage: 0 for a
 * fresh preseason save (falls back to a single week-0 baseline point), the
 * real in-progress week mid-season, and the actual bowl/CFP week for a
 * finished season.
 */
function computeLastPlayedWeek(schedule: ExtractionData['schedule'], teamIndex: number): number {
  const played = schedule.filter(
    (game) =>
      (game.homeTeamIndex === teamIndex || game.awayTeamIndex === teamIndex) && game.status !== 'Unplayed',
  );
  if (played.length === 0) return 0;
  return Math.max(...played.map((game) => game.week));
}

export interface PersistedImport {
  dynasty: Dynasty;
  season: Season;
  /** Years newly backfilled as history-only seasons this call (see extractLeagueHistory) — empty on the common case where nothing was skipped. */
  backfilledSeasonYears: number[];
}

/**
 * Writes an extraction result to SQLite. Importing the same save path twice
 * reuses the existing dynasty (refreshing its label) rather than erroring on
 * the save_path UNIQUE constraint — re-importing to pull the latest week's
 * data is the common case, not an edge case.
 */
export function persistExtraction(savePath: string, extraction: ExtractionData): PersistedImport {
  const { league, userTeam } = extraction;
  const label = `${userTeam.displayName} Dynasty`;

  const existingDynasty = getDynastyBySavePath(savePath);
  const colorPatch = {
    teamColorPrimary: userTeam.primaryColorHex,
    teamColorSecondary: userTeam.secondaryColorHex,
  };

  // teamId/teamName on the dynasty row are a "most recently known" display
  // cache for the Dashboard card list only — refreshed on every import so it
  // reflects wherever the coach currently is, but never trusted for
  // season-scoped queries, since the coach can change schools mid-dynasty
  // (see schema_v3_season_team.sql). Each season records its own real team
  // below instead.
  const teamPatch = { teamId: userTeam.teamIndex, teamName: userTeam.displayName };

  let dynasty: Dynasty;
  if (existingDynasty) {
    updateDynasty(existingDynasty.id, { label, ...colorPatch, ...teamPatch });
    dynasty = { ...existingDynasty, label, ...colorPatch, ...teamPatch };
  } else {
    dynasty = createDynasty({
      savePath,
      label,
      ...teamPatch,
      ...colorPatch,
    });
  }

  const season =
    getSeasonByYear(dynasty.id, league.seasonYear) ?? createSeason(dynasty.id, league.seasonYear, userTeam.teamIndex);

  saveSnapshot(season.id, 'league', extraction.league);
  saveSnapshot(season.id, 'teams', extraction.teams);
  saveSnapshot(season.id, 'coaches', extraction.coaches);
  saveSnapshot(season.id, 'roster', extraction.roster);
  saveSnapshot(season.id, 'leaguePortraits', extraction.leaguePortraits);
  saveSnapshotCompressed(season.id, 'leagueRoster', extraction.leagueRoster);
  saveSnapshotCompressed(season.id, 'leagueSchedule', extraction.leagueSchedule);
  saveSnapshot(season.id, 'schedule', extraction.schedule);
  saveSnapshot(season.id, 'recruits', extraction.recruits);
  saveSnapshot(season.id, 'stats', extraction.stats);
  saveSnapshot(season.id, 'teamStats', extraction.teamStats);
  saveSnapshot(season.id, 'kicking', extraction.kicking);
  saveSnapshot(season.id, 'gamelog', extraction.gamelog);
  saveSnapshot(season.id, 'conferenceChampionship', extraction.conferenceChampionship);
  saveSnapshot(season.id, 'rivalries', extraction.rivalries);
  saveSnapshot(season.id, 'awards', extraction.awards);

  const currentYearSummary = extraction.leagueHistory.find((y) => y.seasonYear === league.seasonYear);
  if (currentYearSummary) saveSnapshot(season.id, 'yearSummary', currentYearSummary);

  recordRankingSnapshot(season.id, {
    week: computeLastPlayedWeek(extraction.schedule, userTeam.teamIndex),
    mediaPollRank: userTeam.mediaPollRank,
    coachesPollRank: userTeam.coachesPollRank,
    cfpRank: userTeam.cfpRank,
    wins: userTeam.confWins + userTeam.nonConfWins,
    losses: userTeam.confLosses + userTeam.nonConfLosses,
  });

  // Backfill: real league-wide history exists for completed years the app
  // never individually synced (e.g. a save imported for the first time
  // several seasons in). Each becomes a lightweight, clearly-marked
  // "history-only" season — never touching a year that already has a row,
  // full or partial, so a real sync is never overwritten by a backfill.
  const backfilledSeasonYears: number[] = [];
  for (const yearSummary of extraction.leagueHistory) {
    if (yearSummary.seasonYear === league.seasonYear) continue;
    if (getSeasonByYear(dynasty.id, yearSummary.seasonYear)) continue;
    const backfilledSeason = createSeason(dynasty.id, yearSummary.seasonYear, null, false, false);
    saveSnapshot(backfilledSeason.id, 'yearSummary', yearSummary);
    backfilledSeasonYears.push(yearSummary.seasonYear);
  }

  return { dynasty, season, backfilledSeasonYears };
}

/**
 * A clear, honest suffix for the import/sync/relink success message when
 * history-only seasons were just backfilled — explains what's actually
 * there (league-wide champions/awards) and what isn't (roster/schedule/
 * stats), so a user importing an already-progressed save understands why
 * those seasons look different rather than assuming something's broken.
 */
export function formatBackfillSuffix(backfilledSeasonYears: number[]): string {
  if (backfilledSeasonYears.length === 0) return '';
  const sorted = [...backfilledSeasonYears].sort((a, b) => a - b);
  const range = sorted.length === 1 ? String(sorted[0]) : `${sorted[0]}-${sorted[sorted.length - 1]}`;
  return ` Also recovered ${sorted.length} history-only season${sorted.length === 1 ? '' : 's'} (${range}) from league history — national/conference champions and awards only; full roster/schedule/stats need a sync while that season is current.`;
}

/**
 * One-click reimport for a dynasty the app already knows about — re-reads
 * the save file at its already-stored path (no file picker) and persists it
 * exactly like a normal import. This is the common "I played more, refresh
 * my data" action; picking a *different* file path (a rename/restore) is a
 * separate, deliberate action — see relinkDynasty.ts.
 */
export async function syncDynasty(dynastyId: string): Promise<ImportResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) {
    return { success: false, message: 'That dynasty no longer exists.' };
  }

  try {
    const extraction = await extractAll(dynasty.savePath);
    const { season, backfilledSeasonYears } = persistExtraction(dynasty.savePath, extraction);
    // Best-effort — a coach's confirmed/finalized winner is never touched
    // regardless, and a failure here shouldn't fail the sync itself (already
    // logged per-award inside autoRecalculateTeamAwards).
    try {
      autoRecalculateTeamAwards(dynastyId, season.id);
    } catch (err) {
      console.error('[team-awards] autoRecalculateTeamAwards failed:', err);
    }
    return {
      success: true,
      message: `Synced — season ${extraction.league.seasonYear}.${formatBackfillSuffix(backfilledSeasonYears)}`,
      dynastyId,
    };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Failed to read save file.' };
  }
}
