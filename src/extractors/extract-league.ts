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
}

export async function extractLeague(franchise: OpenFranchise): Promise<LeagueData> {
  const leagueTable = getLargestTable(franchise, 'League');
  await leagueTable.readRecords(['Name']);
  const league = leagueTable.records[0];

  const seasonInfoTable = getLargestTable(franchise, 'SeasonInfo');
  await seasonInfoTable.readRecords(['CurrentSeasonYear', 'CurrentWeek', 'CurrentStage', 'BaseCalendarYear']);
  const seasonInfo = seasonInfoTable.records[0];

  return {
    leagueName: String(league.Name),
    seasonYear: Number(seasonInfo.CurrentSeasonYear),
    currentWeek: Number(seasonInfo.CurrentWeek),
    currentStage: String(seasonInfo.CurrentStage),
    baseCalendarYear: Number(seasonInfo.BaseCalendarYear),
  };
}
