import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

/**
 * Kicking/punting is a genuinely separate table (CareerKickingStats /
 * SeasonKickingStats) shared by both K and P — real CFB27 kickers and punters
 * both resolve their CareerStats/SeasonStats reference here, never to the
 * offense/defense tables extract-stats.ts reads. Distance-bucketed FG splits
 * (29-or-less/30-39/40-49/50-plus) and "game-winning FG" counters exist on
 * the real table but are left out here, matching this app's existing level
 * of granularity for other positions (counting stats, not situational splits).
 */
export interface KickingStatLine {
  gamesPlayed: number;
  gamesStarted: number;
  fgMade: number;
  fgAttempts: number;
  fgLongest: number;
  fgBlocked: number;
  xpMade: number;
  xpAttempts: number;
  xpBlocked: number;
  puntAttempts: number;
  puntYards: number;
  puntNetYards: number;
  puntLongest: number;
  puntIn20: number;
  puntTouchbacks: number;
  puntBlocked: number;
}

export interface PlayerKickingStatsData {
  /** Matches RosterPlayerData.id (PresentationId). */
  playerId: number;
  career: KickingStatLine | null;
  season: KickingStatLine | null;
}

const PLAYER_FIELDS = ['PresentationId', 'TeamIndex', 'CareerStats', 'SeasonStats'];

function mapKickingLine(r: FranchiseRecord): KickingStatLine {
  return {
    gamesPlayed: Number(r.GAMESPLAYED),
    gamesStarted: Number(r.GAMESSTARTED),
    fgMade: Number(r.KICKFGMADE),
    fgAttempts: Number(r.KICKFGATTEMPTS),
    fgLongest: Number(r.KICKFGLONGEST),
    fgBlocked: Number(r.KICKFGBLOCKED),
    xpMade: Number(r.KICKEPMADE),
    xpAttempts: Number(r.KICKEPATTEMPTS),
    xpBlocked: Number(r.KICKEPBLOCKED),
    puntAttempts: Number(r.PUNTATTEMPTS),
    puntYards: Number(r.PUNTYARDS),
    puntNetYards: Number(r.PUNTNETYARDS),
    puntLongest: Number(r.PUNTLONGEST),
    puntIn20: Number(r.PUNTIN20),
    puntTouchbacks: Number(r.PUNTTOUCHBACKS),
    puntBlocked: Number(r.PUNTBLOCKED),
  };
}

export async function extractKicking(
  franchise: OpenFranchise,
  teamIndex: number,
  expectedRelativeYear: number,
): Promise<PlayerKickingStatsData[]> {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords(PLAYER_FIELDS);

  await Promise.all(
    ['SeasonStats[]', 'CareerKickingStats', 'SeasonKickingStats'].map((name) => preloadAllInstances(franchise, name)),
  );

  const players = nonEmpty(playerTable.records).filter((r) => Number(r.TeamIndex) === teamIndex);

  const stats: PlayerKickingStatsData[] = [];
  for (const player of players) {
    const careerResolved = resolveReferenceWithTable(franchise, player, 'CareerStats');
    if (!careerResolved || careerResolved.table.name !== 'CareerKickingStats') continue;

    const career = mapKickingLine(careerResolved.record);

    // Same exact-SEAS_YEAR-match rule as extract-stats.ts (see its comment) —
    // the old max-slot heuristic showed a player's previous season as
    // "current" until they recorded a new-season stat line.
    let season: KickingStatLine | null = null;
    const seasonRow = resolveReferenceWithTable(franchise, player, 'SeasonStats');
    if (seasonRow) {
      let currentSlot: FranchiseRecord | undefined;
      for (const slotKey of Object.keys(seasonRow.record.fields)) {
        const resolved = resolveReferenceWithTable(franchise, seasonRow.record, slotKey);
        if (!resolved) continue;
        if (Number(resolved.record.SEAS_YEAR) === expectedRelativeYear) {
          currentSlot = resolved.record;
          break;
        }
      }
      if (currentSlot) season = mapKickingLine(currentSlot);
    }

    stats.push({
      playerId: Number(player.PresentationId),
      career,
      season,
    });
  }

  return stats;
}
