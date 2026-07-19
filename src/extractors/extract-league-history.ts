import {
  getLargestTable,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';
import type { LeagueAwardData } from './extract-awards';

/** A real conference championship game result for one specific year. */
export interface ConferenceChampionshipData {
  conferenceName: string;
  winningTeamName: string;
  losingTeamName: string;
  winningTeamScore: number;
  losingTeamScore: number;
}

export interface ChampionSummary {
  teamName: string;
  wins: number;
  losses: number;
  score: number;
  rank: number;
  coachFirstName: string;
  coachLastName: string;
}

/** One real, resolved year of league-wide history — sourced from League.LeagueHistory (YearSummary[]), not the flat ever-accumulating LeagueHistoryConferenceChampion/LeagueHistoryAward tables (see extractLeagueHistory's own doc comment for why those are unsafe). */
export interface YearSummaryData {
  seasonYear: number;
  nationalChampion: ChampionSummary | null;
  runnerUp: Omit<ChampionSummary, 'coachFirstName' | 'coachLastName'> | null;
  conferenceChampions: ConferenceChampionshipData[];
  awards: LeagueAwardData[];
}

function resolveConferenceChampions(
  franchise: OpenFranchise,
  yearRecord: FranchiseRecord,
): ConferenceChampionshipData[] {
  const container = resolveReferenceWithTable(franchise, yearRecord, 'ConferenceChampions');
  if (!container) return [];

  const results: ConferenceChampionshipData[] = [];
  for (const slotKey of Object.keys(container.record.fields)) {
    const slot = resolveReferenceWithTable(franchise, container.record, slotKey);
    if (!slot) continue;
    const r = slot.record;
    if (!r.WinningTeamName) continue;
    results.push({
      conferenceName: String(r.ConferenceName),
      winningTeamName: String(r.WinningTeamName),
      losingTeamName: String(r.LosingTeamName),
      winningTeamScore: Number(r.WinningTeamScore),
      losingTeamScore: Number(r.LosingTeamScore),
    });
  }
  return results;
}

function resolveAwards(franchise: OpenFranchise, yearRecord: FranchiseRecord): LeagueAwardData[] {
  const container = resolveReferenceWithTable(franchise, yearRecord, 'AnnualAwards');
  if (!container) return [];

  const results: LeagueAwardData[] = [];
  for (const slotKey of Object.keys(container.record.fields)) {
    const slot = resolveReferenceWithTable(franchise, container.record, slotKey);
    if (!slot) continue;
    const r = slot.record;
    if (!r.lastName) continue;
    results.push({
      awardType: String(r.AwardType),
      playerId: null,
      firstName: String(r.firstName),
      lastName: String(r.lastName),
      teamDisplayName: String(r.TeamDisplayName),
      position: String(r.Position),
    });
  }
  return results;
}

/**
 * Reads the real per-dynasty-year history array (schema type YearSummary[],
 * a 30-slot container — one slot per dynasty year) and resolves every
 * *completed* year into a self-contained YearSummaryData. The current,
 * in-progress year's slot exists but is zeroed (no coach name, no team
 * reference) until that year's postseason actually finishes — detected here
 * via an empty WinningCoachLastName and skipped, rather than a fixed year
 * cutoff.
 *
 * The schema names this field `League.LeagueHistory`, but that reference is
 * confirmed unresolvable on real saves (`getReferenceDataByKey` returns null
 * even though the League record itself reads fine) — the `YearSummary[]`
 * table is real and fully populated regardless, so it's located directly by
 * table name instead of chaining through League.
 *
 * This is the correct, year-scoped replacement for the two flat tables
 * (LeagueHistoryConferenceChampion, LeagueHistoryAward) the previous
 * extract-conference-championship.ts and extract-awards.ts read directly:
 * those tables accumulate one entry per conference/award *per year* with no
 * year field of their own, and were being read whole and treated as "this
 * season's" data — confirmed wrong on a real 3-completed-year save (each of
 * 10 conferences had exactly 3 stale entries, one per year, with no way to
 * tell them apart). YearSummary's own ConferenceChampions/AnnualAwards
 * sub-arrays are the real per-year link the flat tables lack.
 */
export async function extractLeagueHistory(
  franchise: OpenFranchise,
  baseCalendarYear: number,
): Promise<YearSummaryData[]> {
  const containerTable = getLargestTable(franchise, 'YearSummary[]');
  await containerTable.readRecords();
  const containerRecord = containerTable.records.find((r) => !r.isEmpty);
  if (!containerRecord) return [];

  // Two real "YearSummary" table instances exist (both capacity 30) — every
  // instance must be preloaded, not just the largest, since resolution
  // indexes into whichever specific instance the reference's tableId names
  // (same gotcha as CareerCoachStats/Scheme elsewhere in this codebase).
  await Promise.all(
    [
      'YearSummary',
      'Team',
      'LeagueHistoryConferenceChampion[]',
      'LeagueHistoryConferenceChampion',
      'LeagueHistoryAward[]',
      'LeagueHistoryAward',
    ].map((name) => preloadAllInstances(franchise, name)),
  );

  const years: YearSummaryData[] = [];
  for (const slotKey of Object.keys(containerRecord.fields)) {
    const yearResolved = resolveReferenceWithTable(franchise, containerRecord, slotKey);
    if (!yearResolved) continue;
    const r = yearResolved.record;
    if (!r.WinningCoachLastName) continue; // not-yet-decided (current in-progress) year

    const winTeam = resolveReferenceWithTable(franchise, r, 'WinningTeamIdentity');
    const loseTeam = resolveReferenceWithTable(franchise, r, 'LosingTeamIdentity');

    years.push({
      seasonYear: baseCalendarYear + Number(r.PeriodIndex),
      nationalChampion: winTeam
        ? {
            teamName: String(winTeam.record.DisplayName),
            wins: Number(r.WinningTeamWins),
            losses: Number(r.WinningTeamLosses),
            score: Number(r.WinningTeamScore),
            rank: Number(r.WinningTeamRank),
            coachFirstName: String(r.WinningCoachFirstName),
            coachLastName: String(r.WinningCoachLastName),
          }
        : null,
      runnerUp: loseTeam
        ? {
            teamName: String(loseTeam.record.DisplayName),
            wins: Number(r.LosingTeamWins),
            losses: Number(r.LosingTeamLosses),
            score: Number(r.LosingTeamScore),
            rank: Number(r.LosingTeamRank),
          }
        : null,
      conferenceChampions: resolveConferenceChampions(franchise, r),
      awards: resolveAwards(franchise, r),
    });
  }

  return years;
}
