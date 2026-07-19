import { getLargestTable, preloadAllInstances, resolveReferenceWithTable, type OpenFranchise } from './lib/franchise';

/**
 * The user's own team's full season box-score totals — sourced from
 * Team.TeamSeasonStats (schema type TeamStats[], a real 5-slot array).
 * Confirmed via two real saves that slot 0 always holds the CURRENT
 * season's real, live-accumulating totals (cross-checked exactly against
 * the team's own separately-extracted ConfWin/ConfLoss/NonConfWin/
 * NonConfLoss fields — a 7-6 record matched exactly): a fresh preseason
 * save reads slot 0 as all zeros (correct — nothing's happened yet), a
 * post-season save reads slot 0 fully populated. Slots 1-4 hold what looks
 * like pre-baked default program history (real win/loss records but every
 * other field zeroed) rather than this dynasty's own prior seasons — not
 * reliable data, not read here. This app's own multi-season history
 * already comes from re-syncing each season individually (see
 * importExtraction.ts), not from this save-internal window.
 *
 * No POINTS/POINTS ALLOWED field exists anywhere in TeamStats — scoring
 * totals are derived from the schedule's own game scores instead (already
 * extracted, see extract-schedule.ts), not fabricated here.
 */
export interface TeamStatsData {
  wins: number;
  losses: number;
  ties: number;
  homeWins: number;
  homeLosses: number;
  homeTies: number;
  totalYards: number;
  offPassYards: number;
  offRushYards: number;
  defPassYards: number;
  defRushYards: number;
  passAttempts: number;
  passCompletions: number;
  passTds: number;
  passInts: number;
  rushAttempts: number;
  rushTds: number;
  firstDowns: number;
  thirdDownConv: number;
  thirdDowns: number;
  fourthDownConv: number;
  fourthDowns: number;
  offRedZones: number;
  offRedZoneTds: number;
  offRedZoneFgs: number;
  defRedZones: number;
  defRedZoneTds: number;
  defRedZoneFgs: number;
  sacks: number;
  sacksAllowed: number;
  defInts: number;
  passDeflections: number;
  fumbleRec: number;
  fumblesLost: number;
  takeaways: number;
  giveaways: number;
  penalties: number;
  penaltyYards: number;
  /** Seconds, not minutes — a full season's total reads in the tens of thousands. */
  possessionTime: number;
  punts: number;
  puntYards: number;
  kickReturnYards: number;
  puntReturnYards: number;
  twoPointConvAttempts: number;
  twoPointConvMade: number;
}

function mapTeamStats(r: { [key: string]: unknown }): TeamStatsData {
  return {
    wins: Number(r.WINS),
    losses: Number(r.LOSSES),
    ties: Number(r.TIES),
    homeWins: Number(r.HOMEWINS),
    homeLosses: Number(r.HOMELOSSES),
    homeTies: Number(r.HOMETIES),
    totalYards: Number(r.TOTALYARDS),
    offPassYards: Number(r.OFFPASSYARDS),
    offRushYards: Number(r.OFFRUSHYARDS),
    defPassYards: Number(r.DEFPASSYARDS),
    defRushYards: Number(r.DEFRUSHYARDS),
    passAttempts: Number(r.PASSATTEMPTS),
    passCompletions: Number(r.PASSCOMPLETIONS),
    passTds: Number(r.PASSTDS),
    passInts: Number(r.PASSINTS),
    rushAttempts: Number(r.RUSHATTEMPTS),
    rushTds: Number(r.RUSHTDS),
    firstDowns: Number(r.FIRSTDOWNS),
    thirdDownConv: Number(r.THIRDDOWNCONV),
    thirdDowns: Number(r.THIRDDOWNS),
    fourthDownConv: Number(r.FOURTHDOWNCONV),
    fourthDowns: Number(r.FOURTHDOWNS),
    offRedZones: Number(r.OFFREDZONES),
    offRedZoneTds: Number(r.OFFREDZONETDS),
    offRedZoneFgs: Number(r.OFFREDZONEFGS),
    defRedZones: Number(r.DEFREDZONES),
    defRedZoneTds: Number(r.DEFREDZONETDS),
    defRedZoneFgs: Number(r.DEFREDZONEFGS),
    sacks: Number(r.SACKS),
    sacksAllowed: Number(r.SACKSALLOWED),
    defInts: Number(r.DEFINTS),
    passDeflections: Number(r.PASSDEFLECTIONS),
    fumbleRec: Number(r.FUMBLEREC),
    fumblesLost: Number(r.FUMBLESLOST),
    takeaways: Number(r.TAKEAWAYS),
    giveaways: Number(r.GIVEAWAYS),
    penalties: Number(r.PENALTIES),
    penaltyYards: Number(r.PENALTYYARDS),
    possessionTime: Number(r.POSSESSIONTIME),
    punts: Number(r.PUNTS),
    puntYards: Number(r.PUNTYARDS),
    kickReturnYards: Number(r.KICKRETURNYARDS),
    puntReturnYards: Number(r.PUNTRETURNYARDS),
    twoPointConvAttempts: Number(r.TWOPOINTCONVATTEMPTS),
    twoPointConvMade: Number(r.TWOPOINTCONVMADE),
  };
}

export async function extractTeamStats(franchise: OpenFranchise, teamIndex: number): Promise<TeamStatsData | null> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords(['TeamIndex', 'TeamSeasonStats']);
  const team = teamTable.records.find((r) => !r.isEmpty && Number(r.TeamIndex) === teamIndex);
  if (!team) return null;

  await Promise.all(['TeamStats', 'TeamStats[]'].map((name) => preloadAllInstances(franchise, name)));

  const container = resolveReferenceWithTable(franchise, team, 'TeamSeasonStats');
  if (!container) return null;

  const slot0Key = Object.keys(container.record.fields)[0];
  if (!slot0Key) return null;
  const current = resolveReferenceWithTable(franchise, container.record, slot0Key);
  if (!current) return null;

  return mapTeamStats(current.record);
}
