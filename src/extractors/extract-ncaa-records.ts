import {
  getLargestTable,
  preloadAllInstances,
  resolveReference,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

/** The nine statistical categories the save's own record book tracks (same set as the team record book). */
export type NcaaRecordStatType =
  | 'PassYards'
  | 'PassTds'
  | 'RushYards'
  | 'RushTds'
  | 'ReceiveYards'
  | 'ReceiveTDs'
  | 'ReceiveCatches'
  | 'DefensiveSacks'
  | 'DefensiveInts';

export interface NcaaRecordHolder {
  firstName: string;
  lastName: string;
  position: string;
  /** The record-holder's team at the time — carried directly on the PlayerStatRecord leaf. */
  teamName: string;
  calendarYear: number;
  statValue: number;
  statType: NcaaRecordStatType;
}

export interface NcaaRecordCategory {
  key: NcaaRecordStatType;
  label: string;
  career: NcaaRecordHolder | null;
  season: NcaaRecordHolder | null;
  game: NcaaRecordHolder | null;
}

export type NcaaRecordsData = NcaaRecordCategory[];

/** Save field name on the record-set row -> our stat type (identical mapping to the team record book). */
const RECORD_FIELD_TO_STAT: Record<string, NcaaRecordStatType> = {
  PassYards: 'PassYards',
  PassTDS: 'PassTds',
  RushYards: 'RushYards',
  RushTDS: 'RushTds',
  ReceivingYards: 'ReceiveYards',
  ReceivingTDS: 'ReceiveTDs',
  ReceivingCatches: 'ReceiveCatches',
  DefensiveSacks: 'DefensiveSacks',
  DefensiveInts: 'DefensiveInts',
};

const STAT_LABEL: Record<NcaaRecordStatType, string> = {
  PassYards: 'Passing Yards',
  PassTds: 'Passing Touchdowns',
  RushYards: 'Rushing Yards',
  RushTds: 'Rushing Touchdowns',
  ReceiveYards: 'Receiving Yards',
  ReceiveTDs: 'Receiving Touchdowns',
  ReceiveCatches: 'Receptions',
  DefensiveSacks: 'Sacks',
  DefensiveInts: 'Interceptions',
};

const STAT_ORDER: NcaaRecordStatType[] = [
  'PassYards',
  'PassTds',
  'RushYards',
  'RushTds',
  'ReceiveYards',
  'ReceiveTDs',
  'ReceiveCatches',
  'DefensiveSacks',
  'DefensiveInts',
];

function toHolder(record: FranchiseRecord | undefined, statType: NcaaRecordStatType): NcaaRecordHolder | undefined {
  if (!record) return undefined;
  return {
    firstName: String(record.firstName),
    lastName: String(record.lastName),
    position: String(record.position),
    teamName: String(record.teamName),
    calendarYear: Number(record.calendarYear),
    statValue: Number(record.statValue),
    statType,
  };
}

function resolveRecordSet(
  franchise: OpenFranchise,
  league: FranchiseRecord,
  key: 'PlayerCareerStatRecords' | 'PlayerSeasonStatRecords' | 'PlayerGameStatRecords',
): Partial<Record<NcaaRecordStatType, NcaaRecordHolder>> {
  const setRow = resolveReference(franchise, league, key);
  if (!setRow) return {};

  const result: Partial<Record<NcaaRecordStatType, NcaaRecordHolder>> = {};
  for (const [fieldKey, statType] of Object.entries(RECORD_FIELD_TO_STAT)) {
    const holder = toHolder(resolveReference(franchise, setRow, fieldKey), statType);
    if (holder) result[statType] = holder;
  }
  return result;
}

/**
 * The NCAA-wide record book — career/season/single-game national records, one
 * holder per category. Resolved from League.{PlayerCareer,PlayerSeason,
 * PlayerGame}StatRecords -> the stat-category set row -> PlayerStatRecord leaf,
 * the exact same structure the per-team record book uses (see extract-teams'
 * schoolRecords), but read off the League record so it's national, not one
 * school. The leaf carries the holder's team name directly.
 */
export async function extractNcaaRecords(franchise: OpenFranchise): Promise<NcaaRecordsData> {
  const leagueTable = getLargestTable(franchise, 'League');
  await leagueTable.readRecords();
  const league = leagueTable.records[0];
  if (!league) return [];

  await preloadAllInstances(franchise, 'PlayerStatRecords');
  await preloadAllInstances(franchise, 'PlayerStatRecord');

  const career = resolveRecordSet(franchise, league, 'PlayerCareerStatRecords');
  const season = resolveRecordSet(franchise, league, 'PlayerSeasonStatRecords');
  const game = resolveRecordSet(franchise, league, 'PlayerGameStatRecords');

  return STAT_ORDER.map((key) => ({
    key,
    label: STAT_LABEL[key],
    career: career[key] ?? null,
    season: season[key] ?? null,
    game: game[key] ?? null,
  }));
}
