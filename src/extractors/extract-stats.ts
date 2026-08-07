import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';

export interface OffensiveStatLine {
  gamesPlayed: number;
  gamesStarted: number;
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
  /** Real field (RUSHFUMBLES) — fumbles committed on rushing plays. Not a "fumbles lost" count (no such field exists on this table) and doesn't cover receiving/passing-play fumbles, which aren't tracked separately anywhere in the save. */
  fumbles: number;
  receptions: number;
  receivingYards: number;
  receivingTDs: number;
  receivingLongest: number;
  /**
   * Return duty is tracked on a separate table variant (CareerOffensiveKPReturnStats /
   * SeasonOffensiveKPReturnStats) that only players with real return snaps resolve to —
   * everyone else's CareerStats/SeasonStats reference the plain CareerOffensiveStats /
   * SeasonOffensiveStats table, which has no return columns at all. 0 for those players
   * is a real "not a designated returner" fact, not a guess — see mapOffensiveLine.
   */
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTDs: number;
  kickReturnLongest: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTDs: number;
  puntReturnLongest: number;
}

export interface DefensiveStatLine {
  gamesPlayed: number;
  gamesStarted: number;
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
  /** Same real-vs-not-a-returner distinction as OffensiveStatLine — see mapDefensiveLine. */
  kickReturns: number;
  kickReturnYards: number;
  kickReturnTDs: number;
  kickReturnLongest: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnTDs: number;
  puntReturnLongest: number;
}

/**
 * Linemen's own box score. Kept apart from offense/defense because it is a
 * different table with four columns, not a variant of either — a guard has no
 * rushing line to sit alongside.
 */
export interface OLineStatLine {
  gamesPlayed: number;
  gamesStarted: number;
  /** OLINEPANCAKES — the one counting stat the position actually gets credited for. */
  pancakes: number;
  sacksAllowed: number;
}

export type StatCategory = 'offense' | 'defense' | 'oline';

export interface PlayerStatsData {
  /** Matches RosterPlayerData.id (PresentationId). */
  playerId: number;
  category: StatCategory;
  career: OffensiveStatLine | DefensiveStatLine | OLineStatLine | null;
  season: OffensiveStatLine | DefensiveStatLine | OLineStatLine | null;
}

const PLAYER_FIELDS = ['PresentationId', 'TeamIndex', 'CareerStats', 'SeasonStats'];

/**
 * A player with real return duty (kick/punt returner) has their CareerStats/
 * SeasonStats reference resolve to CareerOffensiveKPReturnStats or
 * CareerDefensiveKPReturnStats instead of the plain offense/defense table —
 * same passing/rushing/receiving/tackle fields plus extra KRET-prefixed and
 * PRET-prefixed return columns, not a separate stat category. Before this fix, these players'
 * CareerStats table name went unrecognized and they were silently dropped
 * from stats entirely — confirmed on a real player (TJ Abrams, a real WR with
 * 11 kick returns for 295 yards) who had zero stats shown anywhere in the app
 * despite real receiving/rushing production. Kicking (K/P) is a genuinely
 * separate category — see extract-kicking.ts — and O-Line stats remain out of
 * scope (not box-score counting stats).
 */
export function categoryFromTableName(name: string): StatCategory | undefined {
  if (name === 'CareerOffensiveStats' || name === 'CareerOffensiveKPReturnStats') return 'offense';
  if (name === 'CareerDefensiveStats' || name === 'CareerDefensiveKPReturnStats') return 'defense';
  // Linemen resolve to their own table. Previously unrecognised, so every
  // offensive lineman was dropped from stats entirely — which is why pancakes
  // could not be shown anywhere.
  if (name === 'CareerOLineStats') return 'oline';
  return undefined;
}

/** True only for records resolved from a *KPReturn table variant — the plain offense/defense tables have no KRETATTEMPTS column at all. */
function hasReturnFields(r: FranchiseRecord): boolean {
  return 'KRETATTEMPTS' in r.fields;
}

function mapOLineLine(r: FranchiseRecord): OLineStatLine {
  return {
    gamesPlayed: Number(r.GAMESPLAYED),
    gamesStarted: Number(r.GAMESSTARTED),
    pancakes: Number(r.OLINEPANCAKES),
    sacksAllowed: Number(r.OLINESACKSALLOWED),
  };
}

function mapOffensiveLine(r: FranchiseRecord): OffensiveStatLine {
  const hasReturns = hasReturnFields(r);
  return {
    gamesPlayed: Number(r.GAMESPLAYED),
    gamesStarted: Number(r.GAMESSTARTED),
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
    fumbles: Number(r.RUSHFUMBLES),
    receptions: Number(r.RECEIVECATCHES),
    receivingYards: Number(r.RECEIVEYARDS),
    receivingTDs: Number(r.RECEIVETDS),
    receivingLongest: Number(r.RECEIVELONGEST),
    kickReturns: hasReturns ? Number(r.KRETATTEMPTS) : 0,
    kickReturnYards: hasReturns ? Number(r.KRETYARDS) : 0,
    kickReturnTDs: hasReturns ? Number(r.KRETTDS) : 0,
    kickReturnLongest: hasReturns ? Number(r.KRETLONGEST) : 0,
    puntReturns: hasReturns ? Number(r.PRETATTEMPTS) : 0,
    puntReturnYards: hasReturns ? Number(r.PRETYARDS) : 0,
    puntReturnTDs: hasReturns ? Number(r.PRETTDS) : 0,
    puntReturnLongest: hasReturns ? Number(r.PRETLONGEST) : 0,
  };
}

function mapDefensiveLine(r: FranchiseRecord): DefensiveStatLine {
  const hasReturns = hasReturnFields(r);
  return {
    gamesPlayed: Number(r.GAMESPLAYED),
    gamesStarted: Number(r.GAMESSTARTED),
    tackles: Number(r.DEFTACKLES),
    assistedTackles: Number(r.ASSDEFTACKLES),
    tacklesForLoss: Number(r.DEFTACKLESFORLOSS),
    // Half-sacks are recorded separately from whole sacks, not pre-summed.
    sacks: Number(r.DLINESACKS) + Number(r.DLINEHALFSACK) * 0.5,
    interceptions: Number(r.DSECINTS),
    interceptionReturnYards: Number(r.DSECINTRETURNYARDS),
    interceptionTDs: Number(r.DSECINTTDS),
    forcedFumbles: Number(r.DLINEFORCEDFUMBLES),
    fumbleRecoveries: Number(r.DLINEFUMBLERECOVERIES),
    passDeflections: Number(r.DEFPASSDEFLECTIONS),
    kickReturns: hasReturns ? Number(r.KRETATTEMPTS) : 0,
    kickReturnYards: hasReturns ? Number(r.KRETYARDS) : 0,
    kickReturnTDs: hasReturns ? Number(r.KRETTDS) : 0,
    kickReturnLongest: hasReturns ? Number(r.KRETLONGEST) : 0,
    puntReturns: hasReturns ? Number(r.PRETATTEMPTS) : 0,
    puntReturnYards: hasReturns ? Number(r.PRETYARDS) : 0,
    puntReturnTDs: hasReturns ? Number(r.PRETTDS) : 0,
    puntReturnLongest: hasReturns ? Number(r.PRETLONGEST) : 0,
  };
}

export function mapLineForCategory(
  category: StatCategory,
  r: FranchiseRecord,
): OffensiveStatLine | DefensiveStatLine | OLineStatLine {
  if (category === 'offense') return mapOffensiveLine(r);
  if (category === 'oline') return mapOLineLine(r);
  return mapDefensiveLine(r);
}

export async function extractStats(
  franchise: OpenFranchise,
  teamIndex: number,
  expectedRelativeYear: number,
): Promise<PlayerStatsData[]> {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords(PLAYER_FIELDS);

  // Reference targets are resolved by table ID, not by name, so every
  // same-named instance must be preloaded — not just the largest.
  await Promise.all(
    // The array table's real name includes brackets: "SeasonStats[]", not "SeasonStats".
    [
      'SeasonStats[]',
      'CareerOffensiveStats',
      'CareerDefensiveStats',
      'SeasonOffensiveStats',
      'SeasonDefensiveStats',
      'CareerOffensiveKPReturnStats',
      'CareerDefensiveKPReturnStats',
      'SeasonOffensiveKPReturnStats',
      'SeasonDefensiveKPReturnStats',
      'CareerOLineStats',
      'SeasonOLineStats',
    ].map((name) => preloadAllInstances(franchise, name)),
  );

  const players = nonEmpty(playerTable.records).filter((r) => Number(r.TeamIndex) === teamIndex);

  const stats: PlayerStatsData[] = [];
  for (const player of players) {
    const careerResolved = resolveReferenceWithTable(franchise, player, 'CareerStats');
    if (!careerResolved) continue;

    const category = categoryFromTableName(careerResolved.table.name);
    if (!category) continue;

    const career = mapLineForCategory(category, careerResolved.record);

    // SeasonStats is an 18-slot history array, one slot per season of this
    // player's tracked career — each slot's own SEAS_YEAR field (0, 1, 2, ...)
    // says which season it is, using the SAME 0-based relative-year convention
    // as SeasonGame.SeasonYear (see extract-schedule.ts). "This season" is the
    // slot whose SEAS_YEAR EQUALS the season actually being synced — NOT the
    // highest populated slot: that older heuristic silently returned a
    // player's *previous* season as "current" whenever they hadn't recorded a
    // stat line in the new season yet (confirmed on a real player, Ryan
    // Browne, in a fresh 2027 preseason — his only slot was his completed
    // 2026 season and read as current). No matching slot now honestly means
    // "no stats this season yet" (season: null), the same principle as the
    // schedule extractor's own year filter.
    let season: OffensiveStatLine | DefensiveStatLine | OLineStatLine | null = null;
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
      if (currentSlot) season = mapLineForCategory(category, currentSlot);
    }

    stats.push({
      playerId: Number(player.PresentationId),
      category,
      career,
      season,
    });
  }

  return stats;
}
