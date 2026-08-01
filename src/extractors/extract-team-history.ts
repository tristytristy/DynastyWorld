import {
  getLargestTable,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

/**
 * PROGRAM HISTORY, FOR EVERY SCHOOL.
 *
 * The save carries real, pre-loaded history for all 138 programs — not just the
 * user's — and the app was showing none of it: a browsed team's History page
 * read "no titles in the tracked years", which was true of the two seasons we
 * had and wildly untrue of the school. Air Force is 439-364-13 with 30 bowl
 * appearances sitting right there in the file.
 *
 * Three separate things live under a Team record, and they answer different
 * questions:
 *
 *   TeamHistoricalData   all-time totals — the program résumé
 *   TeamSeriesHistory    year-by-year seasons, 108 slots per team
 *   Career/SeasonStatRecords  the record book, with named holders
 *
 * The first and third are REAL history (Bo Jackson's 4,303 rushing yards, 1985)
 * and the game writes the dynasty into them as it goes — a 2026 quarterback
 * already owns Auburn's single-season passing record in a two-year save. The
 * middle one only fills from the dynasty's own first season forward.
 *
 * ATTRIBUTION IS BY REFERENCE, NEVER BY ROW ORDER. TeamHistoricSeriesYear is one
 * shared 4,140-row pool and its rows are NOT in teamIndex order — row 0 is Akron
 * and row 1 is Air Force, while teamIndex 0 is Air Force. Reading it positionally
 * produces a page that looks entirely plausible and belongs to the wrong school.
 */

/** All-time program totals — pre-loaded with real history, and added to as the dynasty runs. */
export interface TeamAllTimeData {
  wins: number;
  losses: number;
  ties: number;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  currentHomeWinStreak: number;
  longestHomeWinStreak: number;
  bowlsMade: number;
  bowlsWon: number;
  ny6BowlsMade: number;
  ny6BowlsWon: number;
  cfpsMade: number;
  cfpsWon: number;
  conferenceChampionshipsMade: number;
  conferenceChampionshipsWon: number;
  nationalChampionshipsMade: number;
  nationalChampionshipsWon: number;
  heismanWinners: number;
  allAmericans1stAnd2nd: number;
  playersDrafted: number;
  rivalryWins: number;
  rivalryLosses: number;
  weeksRankedTop25InMediaPoll: number;
  topRecruitingClasses: number;
  top5RecruitingClasses: number;
  top10RecruitingClasses: number;
  top25RecruitingClasses: number;
}

/** One season in a program's year-by-year history. */
export interface TeamHistorySeasonData {
  year: number;
  coachName: string;
  wins: number;
  losses: number;
  ties: number;
  conferenceName: string;
  conferenceWins: number;
  conferenceLosses: number;
  conferenceTies: number;
  divisionName: string;
  finalConferenceStanding: number;
  isConferenceStandingTied: boolean;
  /** 0 when the team finished outside the poll. */
  finalMediaRank: number;
  /** True when this year's row records a conference title game appearance. */
  wonConferenceChampionship: boolean;
  /** Postseason results, in bracket order. `Invalid_` in the save means "didn't reach it" and becomes null. */
  firstRoundResult: string | null;
  quarterFinalResult: string | null;
  semiFinalResult: string | null;
  nationalResult: string | null;
}

/** One program record — the holder, what they did, and when. */
export interface TeamStatRecordData {
  /** 'PassYards', 'RushTDS', … — the category slot this record fills. */
  category: string;
  firstName: string;
  lastName: string;
  position: string;
  value: number;
  year: number;
}

export interface TeamHistoryData {
  teamIndex: number;
  teamName: string;
  yearSchoolEstablished: number;
  yearProgramStarted: number;
  allTime: TeamAllTimeData | null;
  seasons: TeamHistorySeasonData[];
  careerRecords: TeamStatRecordData[];
  seasonRecords: TeamStatRecordData[];
}

const num = (record: FranchiseRecord, field: string): number => {
  const value = Number(record[field]);
  return Number.isFinite(value) ? value : 0;
};

/** The save writes `Invalid_` for a round the team never reached; that's an absence, not a result. */
function bowlResult(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  if (!value || value === 'Invalid_' || value === 'None') return null;
  return value;
}

function readAllTime(record: FranchiseRecord): TeamAllTimeData {
  return {
    wins: num(record, 'Wins'),
    losses: num(record, 'Losses'),
    ties: num(record, 'Ties'),
    homeWins: num(record, 'HomeWins'),
    homeLosses: num(record, 'HomeLosses'),
    homeTies: num(record, 'HomeTies'),
    currentHomeWinStreak: num(record, 'CurrentHomeWinStreak'),
    longestHomeWinStreak: num(record, 'LongestHomeWinStreak'),
    bowlsMade: num(record, 'BowlsMade'),
    bowlsWon: num(record, 'BowlsWon'),
    ny6BowlsMade: num(record, 'NY6BowlsMade'),
    ny6BowlsWon: num(record, 'NY6BowlsWon'),
    cfpsMade: num(record, 'CFPSMade'),
    cfpsWon: num(record, 'CFPSWon'),
    conferenceChampionshipsMade: num(record, 'ConferenceChampionshipsMade'),
    conferenceChampionshipsWon: num(record, 'ConferenceChampionshipsWon'),
    nationalChampionshipsMade: num(record, 'NationalChampionshipsMade'),
    nationalChampionshipsWon: num(record, 'NationalChampionshipsWon'),
    heismanWinners: num(record, 'HeismanWinners'),
    allAmericans1stAnd2nd: num(record, 'AllAmericans1stAnd2nd'),
    playersDrafted: num(record, 'PlayersDrafted'),
    rivalryWins: num(record, 'RivalryWins'),
    rivalryLosses: num(record, 'RivalryLosses'),
    weeksRankedTop25InMediaPoll: num(record, 'WeeksRankedTop25InMediaPoll'),
    topRecruitingClasses: num(record, 'TopRecruitingClasses'),
    top5RecruitingClasses: num(record, 'Top5RecruitingClasses'),
    top10RecruitingClasses: num(record, 'Top10RecruitingClasses'),
    top25RecruitingClasses: num(record, 'Top25RecruitingClasses'),
  };
}

function readSeason(record: FranchiseRecord): TeamHistorySeasonData | null {
  const year = num(record, 'Year');
  if (year <= 0) return null;
  return {
    year,
    coachName: String(record.CoachName ?? '').trim(),
    wins: num(record, 'Wins'),
    losses: num(record, 'Losses'),
    ties: num(record, 'Ties'),
    conferenceName: String(record.ConferenceName ?? '').trim(),
    conferenceWins: num(record, 'ConferenceWins'),
    conferenceLosses: num(record, 'ConferenceLosses'),
    conferenceTies: num(record, 'ConferenceTies'),
    divisionName: String(record.DivisionName ?? '').trim(),
    finalConferenceStanding: num(record, 'FinalConferenceStanding'),
    isConferenceStandingTied: String(record.IsConfRankTied) === 'true',
    finalMediaRank: num(record, 'FinalMediaRank'),
    wonConferenceChampionship: String(record.ConfChampionshipConferenceEnum ?? 'None') !== 'None',
    firstRoundResult: bowlResult(record.FirstRoundCFPBowlGameResult),
    quarterFinalResult: bowlResult(record.QuarterFinalsBowlGameResult),
    semiFinalResult: bowlResult(record.SemiFinalsBowlGameResult),
    nationalResult: bowlResult(record.NationalBowlGameResult),
  };
}

/**
 * A `Foo[]` table is an array container: its record has N reference fields named
 * `Foo0`…`FooN-1`, each pointing at one element. There's no schema on the
 * container itself, so the keys come off the record's own field list.
 */
function arrayElementKeys(record: FranchiseRecord): string[] {
  const fields = (record as unknown as { fieldsArray?: { key: string }[] }).fieldsArray;
  return Array.isArray(fields) ? fields.map((f) => f.key) : [];
}

function readSeasons(franchise: OpenFranchise, teamRecord: FranchiseRecord): TeamHistorySeasonData[] {
  const container = resolveReferenceWithTable(franchise, teamRecord, 'TeamSeriesHistory');
  if (!container) return [];
  const seasons: TeamHistorySeasonData[] = [];
  for (const key of arrayElementKeys(container.record)) {
    const element = resolveReferenceWithTable(franchise, container.record, key);
    if (!element) continue;
    const season = readSeason(element.record);
    if (season) seasons.push(season);
  }
  // Newest first — a program history reads backwards from now.
  return seasons.sort((a, b) => b.year - a.year);
}

function readRecordBook(
  franchise: OpenFranchise,
  teamRecord: FranchiseRecord,
  key: 'CareerStatRecords' | 'SeasonStatRecords',
): TeamStatRecordData[] {
  const holder = resolveReferenceWithTable(franchise, teamRecord, key);
  if (!holder) return [];
  const out: TeamStatRecordData[] = [];
  for (const attribute of holder.table.schema?.attributes ?? []) {
    const entry = resolveReferenceWithTable(franchise, holder.record, attribute.name);
    if (!entry) continue;
    const value = num(entry.record, 'statValue');
    // A zero record is an unset slot, not an achievement.
    if (value <= 0) continue;
    out.push({
      category: attribute.name,
      firstName: String(entry.record.firstName ?? '').trim(),
      lastName: String(entry.record.lastName ?? '').trim(),
      position: String(entry.record.position ?? '').trim(),
      value,
      year: num(entry.record, 'calendarYear'),
    });
  }
  return out;
}

/**
 * Program history for every team in the league, keyed by teamIndex.
 *
 * Runs over the Team table so each team's own references are followed — see the
 * attribution note at the top of this file for why the shared row pools cannot
 * be read positionally.
 */
export async function extractTeamHistory(franchise: OpenFranchise): Promise<TeamHistoryData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords();

  // Every referenced pool has to be loaded before its rows can be read back —
  // and each of these exists as SEVERAL same-named tables, so all instances are
  // preloaded rather than just the largest.
  for (const name of [
    'TeamHistoricalData',
    // The array CONTAINER as well as the element pool. A reference resolves by
    // indexing table.records, so an unloaded container returns nothing and the
    // season list comes back silently empty — which is exactly what it did.
    'TeamHistoricSeriesYear[]',
    'TeamHistoricSeriesYear',
    'PlayerStatRecords',
    'PlayerStatRecord',
  ]) {
    await preloadAllInstances(franchise, name);
  }

  const out: TeamHistoryData[] = [];
  for (let i = 0; i < teamTable.header.recordCapacity; i++) {
    let record: FranchiseRecord;
    try {
      record = teamTable.records[i];
    } catch {
      continue;
    }
    if (!record || record.isEmpty) continue;
    const teamName = String(record.DisplayName ?? '').trim();
    if (!teamName) continue;

    const allTimeRef = resolveReferenceWithTable(franchise, record, 'TeamHistoricalData');
    out.push({
      teamIndex: num(record, 'TeamIndex'),
      teamName,
      yearSchoolEstablished: num(record, 'YearSchoolEstablished'),
      yearProgramStarted: num(record, 'YearStartOfFootballProgram'),
      allTime: allTimeRef ? readAllTime(allTimeRef.record) : null,
      seasons: readSeasons(franchise, record),
      careerRecords: readRecordBook(franchise, record, 'CareerStatRecords'),
      seasonRecords: readRecordBook(franchise, record, 'SeasonStatRecords'),
    });
  }
  return out;
}
