import type { ProgramHistorySeasonEntry } from './types';

/**
 * The seasons a TOTAL may be computed from.
 *
 * `history.seasons` intentionally mixes two provenances: seasons the app
 * extracted, and seasons the user typed in from their own notes (schema v19,
 * see database/manualSeasons.ts). Both belong on the timeline — a dynasty that
 * began in 2026 should not look like it began in 2040 — but only the extracted
 * ones may be summed.
 *
 * This exists because the danger is not in `getHistory`, which computes its own
 * totals before merging. It is DOWNSTREAM: any consumer can reduce over
 * `history.seasons`, and one already did — CoachCareer's "tracked" wins,
 * losses, national and conference titles were plain `.reduce()` calls over the
 * whole array. Nothing about that code looked wrong; it simply predated there
 * being anything unsafe in the array.
 *
 * So: reduce over `syncedSeasons(history.seasons)`, never the raw array. The
 * nullable `wins`/`losses` on the entry type are the second line of defence —
 * a bare `sum + s.wins` will not compile.
 */
export function syncedSeasons(seasons: readonly ProgramHistorySeasonEntry[]): ProgramHistorySeasonEntry[] {
  return seasons.filter((s) => s.source === 'synced');
}

/** True when a row came from the user's own records rather than a save. */
export function isManualSeason(season: ProgramHistorySeasonEntry): boolean {
  return season.source === 'manual';
}

/**
 * True for a season the app never captured — either the save's own thin
 * year-row or a typed one. Both belong on the timeline and neither belongs in a
 * total computed from full seasons.
 */
export function isBackfilledSeason(season: ProgramHistorySeasonEntry): boolean {
  return season.source !== 'synced';
}

/**
 * A record for display, or a dash when the user left it blank.
 * Never renders 0-0 for an unknown — that reads as a season played and lost.
 */
export function formatKnownRecord(wins: number | null, losses: number | null): string {
  if (wins == null || losses == null) return '—';
  return `${wins}-${losses}`;
}
