import { getLargestTable, nonEmpty, type FranchiseRecord, type OpenFranchise } from './lib/franchise';

export interface RosterPlayerData {
  /** PresentationId — verified unique across the whole league (85/85 on a real roster). */
  id: number;
  firstName: string;
  lastName: string;
  portraitAssetName: string | null;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  overallRating: number;
  archetype: string;
  developmentTrait: string;
  heightInches: number;
  weightPounds: number;
  hometown: string;
  homeState: string;
  redshirtStatus: string;
  /** PLYR_ISCAPTAIN — sparse in practice (12 of ~16,255 real players leaguewide on the test save), so most rosters legitimately have none; not a bug when it's false for everyone on a given team. */
  isCaptain: boolean;
}

const FIELDS = [
  'FirstName',
  'LastName',
  'TeamIndex',
  'Position',
  'JerseyNum',
  'SchoolYear',
  'OverallRating',
  'PlayerType',
  'TraitDevelopment',
  'Height',
  'Weight',
  'PLYR_HOME_TOWN',
  'PLYR_HOME_STATE',
  'RedshirtStatus',
  'PresentationId',
  'GenericHeadAssetName',
  'PLYR_ISCAPTAIN',
];

/**
 * Weight isn't stored as raw pounds — empirically, raw value + 160 lines up with
 * realistic per-position body weights (e.g. offensive tackles land ~320-330 lbs,
 * safeties ~200-210). No documented formula for this exists; derived by comparing
 * extracted values against known-plausible position weights in the real save.
 */
const WEIGHT_OFFSET = 160;

/** "HB_ElusiveBack" -> "Elusive Back" (position prefix dropped, camelCase spaced). */
function formatArchetype(playerType: string): string {
  const withoutPositionPrefix = playerType.replace(/^[A-Z0-9]+_/, '');
  return withoutPositionPrefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function formatDevTrait(traitDevelopment: string): string {
  return traitDevelopment.replace(/^College_/, '').replace(/_/g, ' ');
}

function mapPlayer(r: FranchiseRecord): RosterPlayerData {
  return {
    id: Number(r.PresentationId),
    firstName: String(r.FirstName),
    lastName: String(r.LastName),
    portraitAssetName: String(r.GenericHeadAssetName || '').trim() || null,
    position: String(r.Position),
    jerseyNumber: Number(r.JerseyNum),
    schoolYear: String(r.SchoolYear),
    overallRating: Number(r.OverallRating),
    archetype: formatArchetype(String(r.PlayerType)),
    developmentTrait: formatDevTrait(String(r.TraitDevelopment)),
    heightInches: Number(r.Height),
    weightPounds: Number(r.Weight) + WEIGHT_OFFSET,
    hometown: String(r.PLYR_HOME_TOWN),
    homeState: String(r.PLYR_HOME_STATE),
    redshirtStatus: String(r.RedshirtStatus),
    isCaptain: Boolean(r.PLYR_ISCAPTAIN),
  };
}

export async function extractRoster(
  franchise: OpenFranchise,
  teamIndex: number,
): Promise<RosterPlayerData[]> {
  const table = getLargestTable(franchise, 'Player');
  await table.readRecords(FIELDS);
  return nonEmpty(table.records)
    .filter((r) => r.LastName && Number(r.TeamIndex) === teamIndex)
    .map(mapPlayer);
}
