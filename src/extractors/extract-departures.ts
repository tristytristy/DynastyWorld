import {
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseTable,
  type OpenFranchise,
} from './lib/franchise';
import { PLAYER_FIELDS } from './lib/playerFields';

/**
 * Who left the league this offseason and why — the `LeavingPlayer` table, which
 * the game populates at OffSeason stage 2 ("Players Leaving"); it's empty at
 * every other phase, so this returns [] except in that window (persistExtraction
 * write-onces it onto the concluded season — see importExtraction.ts / memory
 * reference-sync-phase-map).
 *
 * NFL departures are declarations with a PROJECTED round only — CFB doesn't
 * simulate the draft pick-by-pick and there's no destination team (verified on a
 * full cycle: PLYR_DRAFTROUND/PICK never populate). Transfers carry the game's
 * stated motivation (Transfer_ProPotential, Transfer_PlayingTime, …).
 */
export type DepartureType = 'nfl' | 'transfer' | 'other';

export interface DepartureData {
  /** Player.PresentationId — matches the roster/portrait ids used everywhere else. */
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  overallRating: number;
  portraitAssetName: string | null;
  /** The team they left FROM (their teamIndex on the leaving record's player). */
  teamIndex: number;
  type: DepartureType;
  /** NFL declarations: projected round 1–7. Null for transfers/other. */
  projectedRound: number | null;
  /** Transfers: the game's stated reason, humanized (e.g. "Pro Potential"). Null otherwise. */
  reason: string | null;
}

/** "Transfer_ProPotential" -> "Pro Potential". */
function humanizeTransferReason(leaveType: string): string {
  return leaveType
    .replace(/^Transfer_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

export async function extractDepartures(franchise: OpenFranchise): Promise<DepartureData[]> {
  // The Player refs on each LeavingPlayer row can point at any Player instance,
  // so load them all before resolving.
  await preloadAllInstances(franchise, 'Player', PLAYER_FIELDS);

  const instances = franchise.getAllTablesByName('LeavingPlayer') as unknown as FranchiseTable[];
  let table: FranchiseTable | null = null;
  let best = -1;
  for (const t of instances) {
    try {
      await t.readRecords();
      const count = t.records.filter((r) => !r.isEmpty).length;
      if (count > best) {
        best = count;
        table = t;
      }
    } catch {
      /* skip an unreadable instance */
    }
  }
  if (!table || best <= 0) return [];

  const departures: DepartureData[] = [];
  for (const rec of nonEmpty(table.records)) {
    const resolved = resolveReferenceWithTable(franchise, rec, 'Player');
    if (!resolved) continue;
    const p = resolved.record;
    const leaveType = String(rec.LeaveType ?? '');

    let type: DepartureType = 'other';
    let projectedRound: number | null = null;
    let reason: string | null = null;
    if (leaveType.startsWith('EarlyNFL')) {
      type = 'nfl';
      const round = Number(rec.ProjectRound);
      projectedRound = round >= 1 && round <= 7 ? round : null;
    } else if (leaveType.startsWith('Transfer')) {
      type = 'transfer';
      reason = humanizeTransferReason(leaveType);
    }

    departures.push({
      playerId: Number(p.PresentationId),
      firstName: String(p.FirstName),
      lastName: String(p.LastName),
      position: String(p.Position),
      overallRating: Number(p.OverallRating),
      portraitAssetName: String(p.GenericHeadAssetName || '').trim() || null,
      teamIndex: Number(p.TeamIndex),
      type,
      projectedRound,
      reason,
    });
  }
  return departures;
}
