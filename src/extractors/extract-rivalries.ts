import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type OpenFranchise,
} from './lib/franchise';
import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';

export interface RivalryData {
  opponentTeamIndex: number;
  /**
   * Real rivalry name from the save's own `Rivalry` table (e.g. "I-35
   * Rivalry" for Texas State/UTSA — confirmed real, trimmed of a trailing
   * space present in the raw data) when a named record resolved for this
   * specific opponent; null if the opponent is still a real rival (present
   * in Rival1/2/3TeamRef) but no matching named record was found.
   */
  name: string | null;
}

/**
 * Reads a team's rivalry opponents from two real, verified sources:
 * `Rival1TeamRef`/`Rival2TeamRef`/`Rival3TeamRef` (always present, exactly 3
 * slots, verified against real save data — Ohio State's Rival1 correctly
 * resolves to Michigan) as the reliable "is this a rival" signal, and the
 * `Rivalries` array (up to 12 slots, resolving to a `Rivalry` table with real
 * matchup names and history) for a nicer display name where one resolves.
 */
export async function extractRivalries(
  franchise: OpenFranchise,
  userTeamIndex: number,
): Promise<RivalryData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords();
  const userTeam = nonEmpty(teamTable.records).find((r) => Number(r.TeamIndex) === userTeamIndex);
  if (!userTeam) return [];

  // 'Rivalries' resolves to a row in the array table "Rivalry[]" (literal brackets
  // in the name — the same gotcha as SeasonStats/GameStats earlier this project),
  // which is a different table from "Rivalry" (the per-matchup record itself).
  // Both need preloading.
  await Promise.all([
    preloadAllInstances(franchise, 'Team'),
    preloadAllInstances(franchise, 'Rivalry'),
    preloadAllInstances(franchise, 'Rivalry[]'),
  ]);

  const opponentIndices = new Set<number>();
  for (const key of ['Rival1TeamRef', 'Rival2TeamRef', 'Rival3TeamRef']) {
    const resolved = resolveReferenceWithTable(franchise, userTeam, key);
    if (resolved && resolved.record.TeamIndex !== undefined) {
      opponentIndices.add(Number(resolved.record.TeamIndex));
    }
  }

  const namedByOpponent = new Map<number, string>();
  const rivalriesRow = resolveReferenceWithTable(franchise, userTeam, 'Rivalries');
  if (rivalriesRow) {
    for (const slotKey of Object.keys(rivalriesRow.record.fields)) {
      const rivalry = resolveReferenceWithTable(franchise, rivalriesRow.record, slotKey);
      if (!rivalry) continue;

      const team1 = resolveReferenceWithTable(franchise, rivalry.record, 'Team1');
      const team2 = resolveReferenceWithTable(franchise, rivalry.record, 'Team2');
      const team1Index = team1 && team1.record.TeamIndex !== undefined ? Number(team1.record.TeamIndex) : null;
      const team2Index = team2 && team2.record.TeamIndex !== undefined ? Number(team2.record.TeamIndex) : null;
      const opponentIndex =
        team1Index === userTeamIndex ? team2Index : team2Index === userTeamIndex ? team1Index : null;
      if (opponentIndex === null) continue;

      const name = String(rivalry.record.Name).trim();
      if (name) namedByOpponent.set(opponentIndex, name);
    }
  }

  return [...opponentIndices].map((opponentTeamIndex) => ({
    opponentTeamIndex,
    name: namedByOpponent.get(opponentTeamIndex) ?? null,
  }));
}

/**
 * One rivalry as a PAIRING of two programs, by display name.
 *
 * Names rather than team indices because that is what the renderer's rivalry
 * lookup is keyed on (see rivalryAssetMapping's `rivalryPairKey`) — the art
 * ships named by matchup, and keying on names means a browsed team's schedule
 * and any league game's box score resolve without a team table to hand.
 */
export interface LeagueRivalryData {
  teamA: string;
  teamB: string;
  /** The save's own name for it ("Iron Bowl"), where a `Rivalry` record resolved. */
  name: string | null;
}

/**
 * EVERY program's rivals, not just the user's.
 *
 * User report (2026-08-07): "Michigan vs Ohio State, one of the biggest
 * rivalries in all of college football, looks just like a regular game." It did,
 * and the reason was scope, not data. `extractRivalries` above reads the USER
 * team's three rival slots, so the moment you browse anybody else's schedule
 * there is no rivalry flag at all — and The Game has no dedicated art in the
 * shipped pairing list either, so nothing lit up from that side.
 *
 * The save has known this the whole time: all 138 teams carry
 * `Rival1/2/3TeamRef`, and walking every one of them yields 272 distinct
 * pairings — Michigan | Ohio State included. Three reference resolutions per
 * team, once per sync, for the thing that makes a rivalry look like a rivalry
 * anywhere in the app.
 *
 * DEDUPED AND ORDER-INDEPENDENT: A lists B and B lists A, so each pairing is
 * emitted once, with the two names sorted. The renderer's `rivalryPairKey` sorts
 * too, so either order would resolve — but storing one row per matchup rather
 * than two keeps the snapshot honest about how many rivalries there are.
 *
 * The FCS pool and any unresolvable slot are skipped: index 255 is a bucket, not
 * a program, and "your rival is FCS West" is not a fact worth storing.
 */
export async function extractLeagueRivalries(franchise: OpenFranchise): Promise<LeagueRivalryData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords();

  await Promise.all([
    preloadAllInstances(franchise, 'Team'),
    preloadAllInstances(franchise, 'Rivalry'),
    preloadAllInstances(franchise, 'Rivalry[]'),
  ]);

  const displayNameByIndex = new Map<number, string>();
  for (const team of nonEmpty(teamTable.records)) {
    const name = String(team.DisplayName || '').trim();
    if (name && Number(team.TeamIndex) !== FCS_POOL_TEAM_INDEX) {
      displayNameByIndex.set(Number(team.TeamIndex), name);
    }
  }

  /** pairKey -> row, so the second team to list the same matchup doesn't duplicate it. */
  const byPair = new Map<string, LeagueRivalryData>();

  for (const team of nonEmpty(teamTable.records)) {
    const teamIndex = Number(team.TeamIndex);
    const teamName = displayNameByIndex.get(teamIndex);
    if (!teamName) continue;

    // The named records first: a name found from either side belongs to the
    // pairing, so filling these in as we go means a rivalry named on only one
    // team's `Rivalries` array still gets its name.
    const namedByOpponent = new Map<number, string>();
    const rivalriesRow = resolveReferenceWithTable(franchise, team, 'Rivalries');
    if (rivalriesRow) {
      for (const slotKey of Object.keys(rivalriesRow.record.fields)) {
        const rivalry = resolveReferenceWithTable(franchise, rivalriesRow.record, slotKey);
        if (!rivalry) continue;
        const team1 = resolveReferenceWithTable(franchise, rivalry.record, 'Team1');
        const team2 = resolveReferenceWithTable(franchise, rivalry.record, 'Team2');
        const i1 = team1?.record.TeamIndex !== undefined ? Number(team1?.record.TeamIndex) : null;
        const i2 = team2?.record.TeamIndex !== undefined ? Number(team2?.record.TeamIndex) : null;
        const opponentIndex = i1 === teamIndex ? i2 : i2 === teamIndex ? i1 : null;
        if (opponentIndex === null) continue;
        const name = String(rivalry.record.Name).trim();
        if (name) namedByOpponent.set(opponentIndex, name);
      }
    }

    for (const key of ['Rival1TeamRef', 'Rival2TeamRef', 'Rival3TeamRef']) {
      const resolved = resolveReferenceWithTable(franchise, team, key);
      if (!resolved || resolved.record.TeamIndex === undefined) continue;
      const opponentIndex = Number(resolved.record.TeamIndex);
      const opponentName = displayNameByIndex.get(opponentIndex);
      if (!opponentName || opponentIndex === teamIndex) continue;

      const [teamA, teamB] = [teamName, opponentName].sort();
      const pair = `${teamA}|${teamB}`;
      const existing = byPair.get(pair);
      const name = namedByOpponent.get(opponentIndex) ?? null;
      if (existing) {
        // The other side may carry the name this side lacked.
        if (!existing.name && name) existing.name = name;
      } else {
        byPair.set(pair, { teamA, teamB, name });
      }
    }
  }

  return [...byPair.values()];
}
