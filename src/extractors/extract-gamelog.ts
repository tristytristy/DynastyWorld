import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

export interface OffensiveGameLine {
  started: boolean;
  gameRating: number;
  passAttempts: number;
  passCompletions: number;
  passYards: number;
  passTDs: number;
  passInts: number;
  passLongest: number;
  rushAttempts: number;
  rushYards: number;
  rushTDs: number;
  rushLongest: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  receivingLongest: number;
}

export interface DefensiveGameLine {
  started: boolean;
  gameRating: number;
  tackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptions: number;
  interceptionReturnYards: number;
  interceptionTDs: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  passDeflections: number;
}

export type GameStatCategory = 'offense' | 'defense';

export interface PlayerGameLogEntry {
  /** Matches RosterPlayerData.id (PresentationId). */
  playerId: number;
  /** Row index into the (largest/real) SeasonGame table — matches GameData.gameId. */
  gameId: number;
  category: GameStatCategory;
  line: OffensiveGameLine | DefensiveGameLine;
}

const PLAYER_FIELDS = ['PresentationId', 'TeamIndex', 'GameStats'];

/**
 * Same real-vs-return-table distinction as extract-stats.ts: a player with
 * return duty resolves their per-game stats to GameOffensiveKPReturnStats /
 * GameDefensiveKPReturnStats instead of the plain table — same
 * pass/rush/receive/tackle fields mapOffensiveLine/mapDefensiveLine already
 * read, so no new mapping is needed, just recognizing the table name (the
 * same silent-drop bug extract-stats.ts had, just per-game instead of
 * season/career). Per-game kick/punt-return YARDAGE itself stays deferred —
 * these two mappers don't read the extra KRET/PRET fields, matching
 * Kicking's own per-game deferral below.
 */
function categoryFromTableName(name: string): GameStatCategory | undefined {
  if (name === 'GameOffensiveStats' || name === 'GameOffensiveKPReturnStats') return 'offense';
  if (name === 'GameDefensiveStats' || name === 'GameDefensiveKPReturnStats') return 'defense';
  return undefined;
}

function mapOffensiveLine(r: FranchiseRecord): OffensiveGameLine {
  return {
    started: Number(r.GAMESSTARTED) === 1,
    gameRating: Number(r.GAMERATING),
    passAttempts: Number(r.PASSATTEMPTS),
    passCompletions: Number(r.PASSCOMPLETED),
    passYards: Number(r.PASSYARDS),
    passTDs: Number(r.PASSTDS),
    passInts: Number(r.PASSINTS),
    passLongest: Number(r.PASSLONGEST),
    rushAttempts: Number(r.RUSHATTEMPTS),
    rushYards: Number(r.RUSHYARDS),
    rushTDs: Number(r.RUSHTDS),
    rushLongest: Number(r.RUSHLONGEST),
    receptions: Number(r.RECEIVECATCHES),
    receivingYards: Number(r.RECEIVEYARDS),
    receivingTDs: Number(r.RECEIVETDS),
    receivingLongest: Number(r.RECEIVELONGEST),
  };
}

function mapDefensiveLine(r: FranchiseRecord): DefensiveGameLine {
  return {
    started: Number(r.GAMESSTARTED) === 1,
    gameRating: Number(r.GAMERATING),
    tackles: Number(r.DEFTACKLES),
    assistedTackles: Number(r.ASSDEFTACKLES),
    tacklesForLoss: Number(r.DEFTACKLESFORLOSS),
    sacks: Number(r.DLINESACKS) + Number(r.DLINEHALFSACK) * 0.5,
    interceptions: Number(r.DSECINTS),
    interceptionReturnYards: Number(r.DSECINTRETURNYARDS),
    interceptionTDs: Number(r.DSECINTTDS),
    forcedFumbles: Number(r.DLINEFORCEDFUMBLES),
    fumbleRecoveries: Number(r.DLINEFUMBLERECOVERIES),
    passDeflections: Number(r.DEFPASSDEFLECTIONS),
  };
}

function mapLineForCategory(category: GameStatCategory, r: FranchiseRecord): OffensiveGameLine | DefensiveGameLine {
  return category === 'offense' ? mapOffensiveLine(r) : mapDefensiveLine(r);
}

export async function extractGameLog(
  franchise: OpenFranchise,
  teamIndex: number,
): Promise<PlayerGameLogEntry[]> {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords(PLAYER_FIELDS);

  await Promise.all(
    [
      'GameStats[]',
      'GameOffensiveStats',
      'GameDefensiveStats',
      'GameOffensiveKPReturnStats',
      'GameDefensiveKPReturnStats',
    ].map((name) => preloadAllInstances(franchise, name)),
  );

  const players = nonEmpty(playerTable.records).filter((r) => Number(r.TeamIndex) === teamIndex);

  const entries: PlayerGameLogEntry[] = [];
  for (const player of players) {
    const gameStatsRow = resolveReferenceWithTable(franchise, player, 'GameStats');
    if (!gameStatsRow) continue;

    // The array's slot count isn't a fixed known constant (varies with games-in-season,
    // e.g. conference championship/bowl games) — enumerate whatever slots exist rather
    // than hardcoding a count.
    for (const slotKey of Object.keys(gameStatsRow.record.fields)) {
      const resolved = resolveReferenceWithTable(franchise, gameStatsRow.record, slotKey);
      if (!resolved) continue;

      const category = categoryFromTableName(resolved.table.name);
      if (!category) continue;

      const gameRef = resolved.record.getReferenceDataByKey('SeasonGame');
      if (!gameRef) continue;

      entries.push({
        playerId: Number(player.PresentationId),
        gameId: gameRef.rowNumber,
        category,
        line: mapLineForCategory(category, resolved.record),
      });
    }
  }

  return entries;
}
