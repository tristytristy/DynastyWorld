import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReference,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

export type TeamRecordStatType =
  | 'PassYards'
  | 'PassTds'
  | 'RushYards'
  | 'RushTds'
  | 'ReceiveYards'
  | 'ReceiveTDs'
  | 'ReceiveCatches'
  | 'DefensiveSacks'
  | 'DefensiveInts';

export interface TeamRecordHolderData {
  firstName: string;
  lastName: string;
  position: string;
  calendarYear: number;
  statValue: number;
  statType: TeamRecordStatType;
}

export interface TeamSchoolRecordsData {
  career: Partial<Record<TeamRecordStatType, TeamRecordHolderData>>;
  season: Partial<Record<TeamRecordStatType, TeamRecordHolderData>>;
  game: Partial<Record<TeamRecordStatType, TeamRecordHolderData>>;
}

export interface TeamData {
  teamIndex: number;
  origId: number;
  displayName: string;
  shortName: string;
  nickName: string;
  assetName: string;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  /** In-game poll ranks; 0 means unranked (same convention as the games table). */
  mediaPollRank: number;
  coachesPollRank: number;
  cfpRank: number;
  topClassRank: number;
  topClassConferenceRank: number;
  teamPrestige: number;
  /** Real team brand colors, despite the field name — verified against known team colors
   *  (Oregon green/yellow, Michigan navy/maize, Ohio State scarlet/gray, etc). */
  primaryColorHex: string;
  secondaryColorHex: string;
  /**
   * The game's own built-in team record book (career / season / single-game),
   * resolved from Team.{Career,Season,Game}StatRecords -> PlayerStatRecords ->
   * PlayerStatRecord. This is school-history data shipped inside the save, not
   * something this app derives from imported seasons.
   */
  schoolRecords: TeamSchoolRecordsData;
  /**
   * Null if the team couldn't be matched to a conference. Team records carry no direct
   * conference-membership field — this is built by inverting Conference.TeamSlots (an
   * array-of-references, same pattern as other array tables in this codebase), not read
   * from a single field. Used to classify schedule games as conference/non-conference.
   */
  conferenceName: string | null;
}

const FIELDS = [
  'DisplayName',
  'ShortName',
  'NickName',
  'TEAM_ORIGID',
  'TeamIndex',
  'AssetName',
  'ConfWin',
  'ConfLoss',
  'NonConfWin',
  'NonConfLoss',
  'MediaPoll_CurrentRank',
  'CoachesPoll_CurrentRank',
  'CFPPoll_CurrentRank',
  'TopClassRank',
  'TopClassConferenceRank',
  'TeamPrestige',
  'TEAM_BACKGROUNDCOLORR',
  'TEAM_BACKGROUNDCOLORG',
  'TEAM_BACKGROUNDCOLORB',
  'TEAM_BACKGROUNDCOLORR2',
  'TEAM_BACKGROUNDCOLORG2',
  'TEAM_BACKGROUNDCOLORB2',
];

const RECORD_FIELD_TO_STAT: Record<string, TeamRecordStatType> = {
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

function rgbToHex(r: unknown, g: unknown, b: unknown): string {
  const clamp = (n: unknown) => Math.max(0, Math.min(255, Number(n) || 0));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function toRecordHolder(record: FranchiseRecord | undefined): TeamRecordHolderData | undefined {
  if (!record) return undefined;
  return {
    firstName: String(record.firstName),
    lastName: String(record.lastName),
    position: String(record.position),
    calendarYear: Number(record.calendarYear),
    statValue: Number(record.statValue),
    statType: String(record.statType) as TeamRecordStatType,
  };
}

function resolveRecordSet(
  franchise: OpenFranchise,
  team: FranchiseRecord,
  key: 'CareerStatRecords' | 'SeasonStatRecords' | 'GameStatRecords',
): Partial<Record<TeamRecordStatType, TeamRecordHolderData>> {
  const setRow = resolveReference(franchise, team, key);
  if (!setRow) return {};

  const result: Partial<Record<TeamRecordStatType, TeamRecordHolderData>> = {};
  for (const [fieldKey, statType] of Object.entries(RECORD_FIELD_TO_STAT)) {
    const record = resolveReference(franchise, setRow, fieldKey);
    const holder = toRecordHolder(record);
    if (holder) result[statType] = holder;
  }
  return result;
}

function mapTeam(
  franchise: OpenFranchise,
  r: FranchiseRecord,
  conferenceByTeamIndex: Map<number, string>,
): TeamData {
  const teamIndex = Number(r.TeamIndex);
  return {
    teamIndex,
    origId: Number(r.TEAM_ORIGID),
    displayName: String(r.DisplayName),
    shortName: String(r.ShortName),
    nickName: String(r.NickName),
    assetName: String(r.AssetName),
    confWins: Number(r.ConfWin),
    confLosses: Number(r.ConfLoss),
    nonConfWins: Number(r.NonConfWin),
    nonConfLosses: Number(r.NonConfLoss),
    mediaPollRank: Number(r.MediaPoll_CurrentRank),
    coachesPollRank: Number(r.CoachesPoll_CurrentRank),
    cfpRank: Number(r.CFPPoll_CurrentRank),
    topClassRank: Number(r.TopClassRank),
    topClassConferenceRank: Number(r.TopClassConferenceRank),
    teamPrestige: Number(r.TeamPrestige),
    primaryColorHex: rgbToHex(r.TEAM_BACKGROUNDCOLORR, r.TEAM_BACKGROUNDCOLORG, r.TEAM_BACKGROUNDCOLORB),
    secondaryColorHex: rgbToHex(
      r.TEAM_BACKGROUNDCOLORR2,
      r.TEAM_BACKGROUNDCOLORG2,
      r.TEAM_BACKGROUNDCOLORB2,
    ),
    schoolRecords: {
      career: resolveRecordSet(franchise, r, 'CareerStatRecords'),
      season: resolveRecordSet(franchise, r, 'SeasonStatRecords'),
      game: resolveRecordSet(franchise, r, 'GameStatRecords'),
    },
    conferenceName: conferenceByTeamIndex.get(teamIndex) ?? null,
  };
}

/**
 * Team records have no direct conference field. Each Conference record's TeamSlots
 * resolves to an array-row (same pattern as Player.SeasonStats) whose slot keys each
 * resolve to a member team — this inverts that structure into a flat teamIndex lookup.
 */
async function buildConferenceMap(franchise: OpenFranchise): Promise<Map<number, string>> {
  const confTable = getLargestTable(franchise, 'Conference');
  await confTable.readRecords();
  // TeamSlots references are resolved by table ID, which isn't guaranteed to land in
  // the largest "Team" instance if the table is fragmented — preload every instance.
  await preloadAllInstances(franchise, 'Team');

  const map = new Map<number, string>();
  for (const conf of nonEmpty(confTable.records)) {
    const slotsRef = conf.getReferenceDataByKey('TeamSlots');
    if (!slotsRef) continue;
    const slotsTable = franchise.getTableById(slotsRef.tableId) as unknown as { records: FranchiseRecord[] } | null;
    if (!slotsTable) continue;
    await (slotsTable as unknown as { readRecords(): Promise<void> }).readRecords();
    const slotsRow = slotsTable.records[slotsRef.rowNumber];
    if (!slotsRow) continue;

    const conferenceName = String(conf.Name);
    for (const slotKey of Object.keys(slotsRow.fields)) {
      const teamRef = slotsRow.getReferenceDataByKey(slotKey);
      if (!teamRef || !teamRef.tableId) continue;
      const teamTable = franchise.getTableById(teamRef.tableId) as unknown as { records: FranchiseRecord[] } | null;
      const teamRec = teamTable?.records[teamRef.rowNumber];
      if (teamRec && !teamRec.isEmpty) {
        map.set(Number(teamRec.TeamIndex), conferenceName);
      }
    }
  }
  return map;
}

export async function extractTeams(franchise: OpenFranchise): Promise<TeamData[]> {
  const table = getLargestTable(franchise, 'Team');
  await table.readRecords(FIELDS);
  await preloadAllInstances(franchise, 'PlayerStatRecords');
  await preloadAllInstances(franchise, 'PlayerStatRecord');

  const conferenceByTeamIndex = await buildConferenceMap(franchise);

  return nonEmpty(table.records)
    .filter((r) => r.DisplayName)
    .map((r) => mapTeam(franchise, r, conferenceByTeamIndex));
}
