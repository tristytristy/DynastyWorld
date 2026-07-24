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
 * True if the line has any real production. Leaguewide, most players dress but
 * do nothing in a given game — those all-zero lines would only ever be filtered
 * out at display anyway (see GameDetail's hasMeaningfulStats), so skip them at
 * extraction to keep the (now leaguewide) snapshot lean.
 */
function lineHasStats(category: GameStatCategory, line: OffensiveGameLine | DefensiveGameLine): boolean {
  if (category === 'offense') {
    const l = line as OffensiveGameLine;
    return l.passAttempts > 0 || l.rushAttempts > 0 || l.receptions > 0;
  }
  const l = line as DefensiveGameLine;
  return (
    l.tackles > 0 ||
    l.assistedTackles > 0 ||
    l.tacklesForLoss > 0 ||
    l.sacks > 0 ||
    l.interceptions > 0 ||
    l.forcedFumbles > 0 ||
    l.fumbleRecoveries > 0 ||
    l.passDeflections > 0
  );
}

/**
 * Leaguewide per-game player box scores for the season being synced — every
 * team, both sides of every game — so the Game Info modal can show a full box
 * score for ANY game, not just the user's (full opponent/CPU-vs-CPU per-game
 * stats DO exist in the save, verified: ~97% of league games carry both teams'
 * lines). Each entry carries self-contained identity because it spans players
 * who aren't in the user's roster snapshot.
 *
 * @param seasonGameIds the SeasonGame ids belonging to the season being synced
 *   (SeasonGame is a flat cross-season table, so a player's lines are filtered
 *   to just this season's games — same reason extract-schedule filters by year).
 */
export async function extractGameLog(
  franchise: OpenFranchise,
  seasonGameIds: number[],
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

  const seasonGames = new Set(seasonGameIds);

  const entries: PlayerGameLogEntry[] = [];
  for (const player of nonEmpty(playerTable.records)) {
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
      if (!seasonGames.has(gameRef.rowNumber)) continue; // only this season's games

      const line = mapLineForCategory(category, resolved.record);
      if (!lineHasStats(category, line)) continue; // drop dressed-but-did-nothing lines

      entries.push({
        playerId: Number(player.PresentationId),
        gameId: gameRef.rowNumber,
        category,
        line,
        ...identity,
      });
    }
  }

  return entries;
}
