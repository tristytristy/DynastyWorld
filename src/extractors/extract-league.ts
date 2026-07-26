import { getLargestTable, type OpenFranchise } from './lib/franchise';

export interface LeagueData {
  leagueName: string;
  seasonYear: number;
  currentWeek: number;
  currentStage: string;
  /**
   * The real calendar year the dynasty started (SeasonInfo.BaseCalendarYear).
   * `seasonYear` for any `YearSummary` entry (see extract-league-history.ts)
   * equals `baseCalendarYear + PeriodIndex` — verified exact against two real
   * saves (2026 + 3 = 2029, 2026 + 1 = 2027).
   */
  baseCalendarYear: number;
  /**
   * The calendar phase of THIS sync — the basis for phase-aware ingestion (see
   * shared/syncPhase.ts + memory reference-sync-phase-map). `currentWeekType` is
   * PreSeason / RegularSeason / NationalChampionship / OffSeason; `currentOffseasonStage`
   * is 1–9 only while OffSeason (0 otherwise). Full Auburn cycle mapped these
   * exactly (2026→2027). NB: `currentStage` reads "NFLSeason" mid-college-season
   * (Madden-inherited) — don't gate on it; use these two instead.
   */
  currentWeekType: string;
  currentOffseasonStage: number;
}

export async function extractLeague(franchise: OpenFranchise): Promise<LeagueData> {
  const leagueTable = getLargestTable(franchise, 'League');
  await leagueTable.readRecords(['Name']);
  const league = leagueTable.records[0];

  const seasonInfoTable = getLargestTable(franchise, 'SeasonInfo');
  await seasonInfoTable.readRecords([
    'CurrentSeasonYear',
    'CurrentWeek',
    'CurrentStage',
    'BaseCalendarYear',
    'CurrentWeekType',
    'CurrentOffseasonStage',
  ]);
  const seasonInfo = seasonInfoTable.records[0];

  return {
    leagueName: String(league.Name),
    seasonYear: Number(seasonInfo.CurrentSeasonYear),
    currentWeek: Number(seasonInfo.CurrentWeek),
    currentStage: String(seasonInfo.CurrentStage),
    baseCalendarYear: Number(seasonInfo.BaseCalendarYear),
    currentWeekType: String(seasonInfo.CurrentWeekType),
    currentOffseasonStage: Number(seasonInfo.CurrentOffseasonStage),
  };
}
