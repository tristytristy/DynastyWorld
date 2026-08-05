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
  /**
   * The school's global logo asset id (TEAM_LOGO). Distinct from teamIndex —
   * it's an index into EA's full alphabetical school master list (FBS + FCS +
   * others), which is the SAME id space that Coach.AlmaMater / HomeTown use.
   * Resolving a coach's alma mater requires matching AlmaMater against THIS,
   * not teamIndex (verified: Kirby Smart alma=34 -> logoId 34 = Georgia, where
   * teamIndex 34 = Indiana). See getCoaches.ts.
   */
  logoId: number;
  displayName: string;
  shortName: string;
  nickName: string;
  assetName: string;
  confWins: number;
  confLosses: number;
  nonConfWins: number;
  nonConfLosses: number;
  /**
   * In-game poll ranks. The polls rank ALL 138 FBS teams, not a top 25 — 0
   * means the poll has not been released yet (every team reads 0 before the
   * first CFP poll), and 255 is the FCS placeholder pool. Treat "ranked" as
   * <= 25 downstream; a bare rank of 112 is not a ranking worth showing.
   */
  mediaPollRank: number;
  coachesPollRank: number;
  cfpRank: number;
  /**
   * The same poll one week earlier — `MediaPoll_LastWeeksRank` /
   * `CoachesPoll_LastWeeksRank`, siblings of the CurrentRank fields above,
   * with the identical 0/255 convention. This is the whole basis of the hub's
   * rank-movement chips: the save keeps no per-week poll history anywhere, so
   * one week back is genuinely all that exists in a single snapshot.
   *
   * `CFPPoll_LastWeeksRank` exists too and is deliberately NOT pulled: across
   * seven real saves (preseason, mid-season, and two post-playoff) it never
   * once differed from `CFPPoll_CurrentRank`, so a CFP "movement" number built
   * from it would always read as zero movement. Checked, not assumed.
   *
   * Absent on seasons synced before this shipped.
   */
  mediaPollLastWeekRank?: number;
  coachesPollLastWeekRank?: number;
  /** Where the media poll had this team before a game was played. Media only — the coaches and CFP polls carry no start-of-season sibling field. Absent on seasons synced before this shipped. */
  mediaPollStartOfSeasonRank?: number;
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
   * The game's own computed position-group grades (0-99), the same numbers
   * that drive the in-game Team Ratings screen — confirmed on a real save
   * (Alabama 76-94 range, Akron 66-71 — sane, differentiated values, not
   * placeholders). This is what "team needs" actually is: no separate
   * need/grade field exists anywhere on Team, but a low position-group grade
   * relative to the team's own overall IS the game's own signal for a thin
   * spot on the roster.
   */
  positionGrades: {
    qb: number;
    rb: number;
    wr: number;
    te: number;
    ol: number;
    dl: number;
    lb: number;
    db: number;
    st: number;
    offense: number;
    defense: number;
    overall: number;
  };
  /**
   * Null if the team couldn't be matched to a conference. Team records carry no direct
   * conference-membership field — this is built by inverting Conference.TeamSlots (an
   * array-of-references, same pattern as other array tables in this codebase), not read
   * from a single field. Used to classify schedule games as conference/non-conference.
   */
  conferenceName: string | null;
  /**
   * The division within the conference (e.g. "East"/"West", "Division 1"/"Division 2"),
   * or null when the conference isn't split into divisions this season. Built by
   * resolving Conference.Divisions -> Division.Teams (each an array-of-references whose
   * container table must be loaded before its slots resolve — the gotcha that made this
   * look empty until the array table was read first). Only conferences with 2+ real
   * named divisions are treated as divided downstream.
   */
  divisionName: string | null;
  /** The game's own 0-based rank within the division (0 = division leader). Only meaningful when divisionName is set. */
  divisionStanding: number;
  divisionWins: number;
  divisionLosses: number;
}

const FIELDS = [
  'DisplayName',
  'ShortName',
  'NickName',
  'TEAM_ORIGID',
  'TEAM_LOGO',
  'TeamIndex',
  'AssetName',
  'ConfWin',
  'ConfLoss',
  'NonConfWin',
  'NonConfLoss',
  'DivisionWin',
  'DivisionLoss',
  'CurSeasonDivStanding',
  'MediaPoll_CurrentRank',
  'MediaPoll_LastWeeksRank',
  'MediaPoll_StartOfSeasonRank',
  'CoachesPoll_CurrentRank',
  'CoachesPoll_LastWeeksRank',
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
  'TEAM_RATINGQB',
  'TEAM_RATINGRB',
  'TEAM_RATINGWR',
  'TEAM_RATINGTE',
  'TEAM_RATINGOL',
  'TEAM_RATINGDL',
  'TEAM_RATINGLB',
  'TEAM_RATINGDB',
  'TEAM_RATINGST',
  'TEAM_RATINGOFF',
  'TEAM_RATINGDEF',
  'TEAM_RATINGOVR',
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
  divisionByTeamIndex: Map<number, string>,
): TeamData {
  const teamIndex = Number(r.TeamIndex);
  return {
    teamIndex,
    origId: Number(r.TEAM_ORIGID),
    logoId: Number(r.TEAM_LOGO),
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
    mediaPollLastWeekRank: Number(r.MediaPoll_LastWeeksRank),
    coachesPollLastWeekRank: Number(r.CoachesPoll_LastWeeksRank),
    mediaPollStartOfSeasonRank: Number(r.MediaPoll_StartOfSeasonRank),
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
    positionGrades: {
      qb: Number(r.TEAM_RATINGQB),
      rb: Number(r.TEAM_RATINGRB),
      wr: Number(r.TEAM_RATINGWR),
      te: Number(r.TEAM_RATINGTE),
      ol: Number(r.TEAM_RATINGOL),
      dl: Number(r.TEAM_RATINGDL),
      lb: Number(r.TEAM_RATINGLB),
      db: Number(r.TEAM_RATINGDB),
      st: Number(r.TEAM_RATINGST),
      offense: Number(r.TEAM_RATINGOFF),
      defense: Number(r.TEAM_RATINGDEF),
      overall: Number(r.TEAM_RATINGOVR),
    },
    conferenceName: conferenceByTeamIndex.get(teamIndex) ?? null,
    divisionName: divisionByTeamIndex.get(teamIndex) ?? null,
    divisionStanding: Number(r.CurSeasonDivStanding),
    divisionWins: Number(r.DivisionWin),
    divisionLosses: Number(r.DivisionLoss),
  };
}

/**
 * Resolves an array-of-references field to its container row, LOADING that
 * container table's records first. The load is the crucial step: these array
 * tables (Conference.TeamSlots, Conference.Divisions, Division.Teams) are
 * separate tables whose records are lazy — reading a slot before the table is
 * loaded silently yields an empty row, which is exactly what made division
 * membership look absent until the container was read first.
 */
async function resolveArrayRow(
  franchise: OpenFranchise,
  record: FranchiseRecord,
  key: string,
): Promise<FranchiseRecord | null> {
  const ref = record.getReferenceDataByKey(key);
  if (!ref || !ref.tableId) return null;
  const table = franchise.getTableById(ref.tableId) as unknown as
    | { records: FranchiseRecord[]; readRecords(): Promise<void> }
    | null;
  if (!table) return null;
  await table.readRecords();
  return table.records[ref.rowNumber] ?? null;
}

/**
 * Team records have no direct conference/division field. Each Conference record's
 * TeamSlots resolves to an array-row whose slot keys each resolve to a member team;
 * its Divisions resolves to an array-row of Division records, each of which has its
 * own Teams array-row of members. This inverts both structures into flat teamIndex
 * lookups in a single pass.
 */
async function buildConferenceAndDivisionMaps(
  franchise: OpenFranchise,
): Promise<{ conferenceByTeamIndex: Map<number, string>; divisionByTeamIndex: Map<number, string> }> {
  const confTable = getLargestTable(franchise, 'Conference');
  await confTable.readRecords();
  // References are resolved by table ID, which isn't guaranteed to land in the largest
  // "Team" instance if the table is fragmented — preload every instance.
  await preloadAllInstances(franchise, 'Team');

  const conferenceByTeamIndex = new Map<number, string>();
  const divisionByTeamIndex = new Map<number, string>();

  const teamIndexOf = (ref: { tableId: number; rowNumber: number } | null): number | null => {
    if (!ref || !ref.tableId) return null;
    const teamTable = franchise.getTableById(ref.tableId) as unknown as { records: FranchiseRecord[] } | null;
    const teamRec = teamTable?.records[ref.rowNumber];
    return teamRec && !teamRec.isEmpty ? Number(teamRec.TeamIndex) : null;
  };

  for (const conf of nonEmpty(confTable.records)) {
    const conferenceName = String(conf.Name);

    const slotsRow = await resolveArrayRow(franchise, conf, 'TeamSlots');
    if (slotsRow) {
      for (const slotKey of Object.keys(slotsRow.fields)) {
        const idx = teamIndexOf(slotsRow.getReferenceDataByKey(slotKey));
        if (idx !== null) conferenceByTeamIndex.set(idx, conferenceName);
      }
    }

    // Divisions: an array-row of Division records; each has a Name and its own
    // Teams array-row. A conference may have a single unnamed/placeholder
    // division (no real split) — those still map here, but downstream only
    // treats a conference as "divided" when it has 2+ distinct real names.
    const divisionsRow = await resolveArrayRow(franchise, conf, 'Divisions');
    if (divisionsRow) {
      for (const divKey of Object.keys(divisionsRow.fields)) {
        const divRow = await resolveArrayRow(franchise, divisionsRow, divKey);
        if (!divRow || divRow.isEmpty || !divRow.Name) continue;
        const divisionName = String(divRow.Name);
        const teamsRow = await resolveArrayRow(franchise, divRow, 'Teams');
        if (!teamsRow) continue;
        for (const teamKey of Object.keys(teamsRow.fields)) {
          const idx = teamIndexOf(teamsRow.getReferenceDataByKey(teamKey));
          if (idx !== null) divisionByTeamIndex.set(idx, divisionName);
        }
      }
    }
  }

  return { conferenceByTeamIndex, divisionByTeamIndex };
}

export async function extractTeams(franchise: OpenFranchise): Promise<TeamData[]> {
  const table = getLargestTable(franchise, 'Team');
  await table.readRecords(FIELDS);
  await preloadAllInstances(franchise, 'PlayerStatRecords');
  await preloadAllInstances(franchise, 'PlayerStatRecord');

  const { conferenceByTeamIndex, divisionByTeamIndex } = await buildConferenceAndDivisionMaps(franchise);

  return nonEmpty(table.records)
    .filter((r) => r.DisplayName)
    .map((r) => mapTeam(franchise, r, conferenceByTeamIndex, divisionByTeamIndex));
}
