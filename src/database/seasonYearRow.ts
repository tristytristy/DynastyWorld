import { getSeasonsByDynasty, getSnapshot } from './helpers';
import { getDbEpoch } from './init';
import type { TeamHistoryData, TeamHistorySeasonData } from '../extractors/extract-team-history';

/**
 * ONE RESOLVED INDEX PER DYNASTY, and why it is not left to getSnapshot's cache.
 *
 * `teamHistory` is 143 programs deep with up to 108 seasons each, stored
 * gzipped. getSnapshot does cache it — but that cache is a 48 MB byte-budgeted
 * LRU, and the callers here run in a loop that pulls a `teams`, `schedule` and
 * `coaches` snapshot for every season as they go. Those evict it, so the next
 * season re-reads and re-inflates the whole thing.
 *
 * Measured on a real archive rather than assumed: adding the year-row lookup
 * without this took getHistory on a five-season dynasty from 102 ms to 1130 ms,
 * an 11x regression on a page that opens every time someone clicks History.
 * With the index it is back to baseline.
 *
 * Keyed by dynasty AND database epoch — the epoch is what makes a restore from
 * backup, an archive swap or a fresh open safe, since every one of those means
 * the same seasonId now refers to different rows. A single slot is enough: the
 * app works one dynasty at a time, and a miss only costs the read it would have
 * done anyway.
 */
let indexedDynastyId: string | null = null;
let indexedEpoch = -1;
let indexedRows: Map<string, TeamHistorySeasonData> | null = null;

function rowKey(teamIndex: number, seasonYear: number): string {
  return `${teamIndex}:${seasonYear}`;
}

function getIndex(dynastyId: string): Map<string, TeamHistorySeasonData> {
  const epoch = getDbEpoch();
  if (indexedRows && indexedDynastyId === dynastyId && indexedEpoch === epoch) {
    return indexedRows;
  }

  const index = new Map<string, TeamHistorySeasonData>();
  const candidates = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => b.seasonYear - a.seasonYear);

  for (const season of candidates) {
    const history = getSnapshot<TeamHistoryData[]>(season.id, 'teamHistory');
    if (!history) continue;
    for (const team of history) {
      for (const entry of team.seasons) {
        // First writer wins, and the scan is newest-first, so a later capture's
        // account of a year is never overwritten by an older one.
        const key = rowKey(team.teamIndex, entry.year);
        if (!index.has(key)) index.set(key, entry);
      }
    }
    break;
  }

  indexedDynastyId = dynastyId;
  indexedEpoch = epoch;
  indexedRows = index;
  return index;
}

/**
 * WHAT THE SAVE STILL REMEMBERS ABOUT A SEASON NOBODY CAPTURED PROPERLY.
 *
 * Almost everything the app knows about a season comes from snapshots taken at
 * one moment: the schedule, the teams row, the conference-championship list.
 * Sync in week 4 and play on to week 15 and those snapshots stay frozen at week
 * 4 — and once the calendar rolls into the next year the save itself no longer
 * holds the detail, so nothing can ever fill them in.
 *
 * `teamHistory` is the one source that survives that. The save keeps a
 * year-by-year row for every program and the extractor re-reads all of it on
 * every sync, so a capture taken in 2030 still knows Wyoming went 12-2 and won
 * the Mountain West in 2029 — even though the 2029 snapshots only ever saw week
 * zero. It is thin (a record, a rank, title flags, postseason rounds) but it is
 * complete and it is the save's own account.
 *
 * Read from the NEWEST sync deliberately: program history accumulates, so the
 * latest capture is a superset of every earlier one and there is nothing to
 * merge (same reasoning as gameHistorySeasons).
 *
 * SCANNED newest-first rather than taking the newest and giving up. Program
 * history only started being captured in 3.0.1, so a long-running archive
 * carries it on recent seasons and not on older ones — one real dynasty has it
 * on 2029/2030 and not on 2027/2028 — and stopping at the newest would throw
 * the recovery away for anyone whose latest season happens to be a gap.
 *
 * MATCHED ON teamIndex, NEVER ON NAME. The sources disagree about spelling: the
 * league-history snapshot says "Jacksonville State" where program history says
 * "Jax State". Matching on the display name silently loses exactly the schools
 * whose names are abbreviated.
 */
export function getSeasonYearRow(
  dynastyId: string,
  seasonYear: number,
  teamIndex: number,
): TeamHistorySeasonData | undefined {
  return getIndex(dynastyId).get(rowKey(teamIndex, seasonYear));
}

/**
 * Whether a season's own snapshots are demonstrably behind the save's account
 * of it — i.e. the year-row records games this capture never saw.
 *
 * This is the whole test for "was this season captured at full term", and it
 * needs no new schema and no guess about sync phase. Counting games is what
 * makes it safe in both directions:
 *
 *   - A season synced at End of Season Recap matches its year-row exactly, so
 *     nothing changes for anyone who syncs properly.
 *   - The CURRENT season's year-row reads 0-0 until the year closes, so a
 *     mid-season capture always knows MORE than it and can never be overridden
 *     by an empty row.
 *
 * Ties go to the snapshots, which carry far more detail than the year-row.
 */
export function isYearRowBetter(
  yearRow: TeamHistorySeasonData | undefined,
  capturedWins: number,
  capturedLosses: number,
): yearRow is TeamHistorySeasonData {
  if (!yearRow) return false;
  return yearRow.wins + yearRow.losses > capturedWins + capturedLosses;
}
