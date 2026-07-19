import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type OpenFranchise,
} from './lib/franchise';

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
