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
  /** The player's team — lets the Game Info box score toggle between the two sides. */
  teamIndex: number;
  // Self-contained identity (same source fields as extract-roster) so the box
  // score can render OPPONENT players too, who aren't in the user's roster
  // snapshot. Mirrors RosterPlayerData's identity fields.
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
}

const PLAYER_FIELDS = [
  'PresentationId',
  'TeamIndex',
  'GameStats',
  'FirstName',
  'LastName',
  'Position',
  'JerseyNum',
  'SchoolYear',
  'GenericHeadAssetName',
];

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

/**
 * @param teamIndex the user's team.
 * @param opponentTeamIndexes the teams the user played (from the schedule) — their
 *   players are captured too so each of the user's games can show BOTH box scores.
 * @param userGameIds the SeasonGame ids the user actually played. Opponent players
 *   carry lines for ALL of their own games, so restrict to these to keep only the
 *   game against the user.
 *
 * Scoping to {user + opponents} rather than the whole league keeps this fast
 * (~a dozen teams instead of ~140) — full opponent per-game stats DO exist
 * league-wide in the save, but we only need the user's own matchups here.
 */
export async function extractGameLog(
  franchise: OpenFranchise,
  teamIndex: number,
  opponentTeamIndexes: number[],
  userGameIds: number[],
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

  const includeTeams = new Set<number>([teamIndex, ...opponentTeamIndexes]);
  const userGames = new Set(userGameIds);
  const players = nonEmpty(playerTable.records).filter((r) => includeTeams.has(Number(r.TeamIndex)));

  const entries: PlayerGameLogEntry[] = [];
  for (const player of players) {
    const gameStatsRow = resolveReferenceWithTable(franchise, player, 'GameStats');
    if (!gameStatsRow) continue;

    const identity = {
      teamIndex: Number(player.TeamIndex),
      firstName: String(player.FirstName),
      lastName: String(player.LastName),
      position: String(player.Position),
      jerseyNumber: Number(player.JerseyNum),
      schoolYear: String(player.SchoolYear),
      portraitAssetName: String(player.GenericHeadAssetName || '').trim() || null,
    };

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
      if (!userGames.has(gameRef.rowNumber)) continue; // only the user's own games

      entries.push({
        playerId: Number(player.PresentationId),
        gameId: gameRef.rowNumber,
        category,
        line: mapLineForCategory(category, resolved.record),
        ...identity,
      });
    }
  }

  return entries;
}
