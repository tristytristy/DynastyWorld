import { getLargestTable, type FranchiseRecord, type FranchiseTable, type OpenFranchise } from './lib/franchise';

/**
 * SCORING SUMMARIES — who scored, when, and what the score became.
 *
 * THE ONE THING TO KNOW: the save keeps scoring summaries for the CURRENT WEEK
 * ONLY. Verified on three unrelated saves — a week-5 file held 63 summaries, all
 * of them week 5 and none for weeks 0-4; a week-1 file held 68, all week 1; a
 * save sitting on the National Championship held exactly one, that game. So this
 * can never be backfilled, and a season only accumulates the weeks it was
 * actually synced. importExtraction MERGES rather than replaces for exactly that
 * reason — a week-6 sync must not erase what week 5 captured.
 *
 * THE DATA MODEL, reverse-engineered and then verified against every game in two
 * saves (131/131 reconciled to the final score exactly):
 *
 *   SeasonGame.ScoringSummaries -> a `ScoringSummary[]` container of 36 slots
 *   -> each slot a `ScoringSummary` row:
 *
 *     Quarter, TimeStampInSec           when (the clock REMAINING, max 900)
 *     Home/AwayPreviousScore            the score before this play
 *     Home/AwayCurrentScore             the score after the play, BEFORE the try
 *     Conversion                        the try that followed
 *     Home/AwayPlayerSnapshots          both teams' leaders at that moment
 *
 * The scoring team is whichever side's score moved. The delta IS the play, and
 * only ever takes four values leaguewide: 6 (touchdown), 3 (field goal),
 * 2 (safety), or 0. A zero-delta row is a PERIOD MARKER, not a score — every
 * game carries one at 0:00 of the second quarter (halftime) — so they are
 * dropped here rather than shown as a scoreless play.
 *
 * `Conversion` is the try AFTERWARDS, not the play itself, and its points are
 * not yet in CurrentScore — they show up in the next row's PreviousScore. That
 * one-row lag is the whole subtlety: reading `Conversion` as the play type, or
 * adding its points to every row, over-counts. Applied correctly it reconciles
 * 131/131; applied to the running total as well it broke 37 of 63.
 *
 *   FieldGoal -> +1, the kicked extra point (369 of 627 rows)
 *   Touchdown -> +2, the two-point conversion (10 rows)
 *   None      -> +0, either a field goal/safety or a failed try (248 rows)
 *
 * The enum names are the game's, and they describe how the try was scored, which
 * is why "FieldGoal" means a kicked PAT and "Touchdown" means a two-point play.
 * Confusing, so it is normalised to points here and the raw name never leaves
 * this file.
 */

/** A single score. Ordered as the game was played. */
export interface ScoringPlayData {
  /** Row index into SeasonGame — the same `gameId` the schedule and gamelog snapshots use. */
  gameId: number;
  quarter: number;
  /** Seconds REMAINING in the quarter, so 564 is 9:24 on the clock. */
  clockSeconds: number;
  /** Which side scored. Null only if the team reference failed to resolve. */
  teamIndex: number | null;
  isHome: boolean;
  /** Points from the play itself — 6, 3 or 2. The try is separate. */
  points: number;
  /** Points added by the try afterwards: 1 kicked, 2 for a two-point play, 0 for none. */
  conversionPoints: number;
  playType: 'touchdown' | 'fieldGoal' | 'safety';
  /** The score AFTER this play and its try — what a scoreboard would read. */
  homeScore: number;
  awayScore: number;
  /**
   * Who scored, by PresentationId — the same identity the roster, stats and
   * player modal key on, so these names get hover cards for free.
   *
   * DERIVED, and only for touchdowns. The save names nobody: what it stores is
   * a snapshot of each side's three offensive leaders (a QB, a back and a
   * receiver) with their cumulative line at that moment. Diffing a row's
   * snapshot against the previous row's finds whoever's touchdown count went
   * up — which on a passing score is TWO players, the thrower and the catcher,
   * both of whom are credited.
   *
   * Empty when the scorer isn't in that three-man snapshot (a tight end, a
   * fourth receiver, any defensive or special-teams score) and always for field
   * goals, since kickers appear in no snapshot at all. Empty means "not
   * recorded", never "nobody" — the UI must not imply otherwise.
   */
  scorers: number[];
}

/** The `ScoringSummary[]` container's slots. 36 is the schema's capacity, not a guess. */
const MAX_SLOTS = 36;

/**
 * Reference fields typed `record` rather than `record[]` in the schema, which
 * the library declines to decode — `getReferenceDataByKey` returns null for
 * them. The bit layout is the ordinary one, so the words are read straight off
 * the row and split by hand: [2 flag][13 table][17 row].
 */
function decodeReference(word: number): { tableId: number; rowNumber: number } {
  const bits = word.toString(2).padStart(32, '0');
  return { tableId: parseInt(bits.slice(2, 15), 2), rowNumber: parseInt(bits.slice(16), 2) };
}

function conversionPoints(raw: string): number {
  if (raw === 'FieldGoal') return 1;
  if (raw === 'Touchdown') return 2;
  return 0;
}

function classify(points: number): ScoringPlayData['playType'] | null {
  if (points === 6) return 'touchdown';
  if (points === 3) return 'fieldGoal';
  if (points === 2) return 'safety';
  // Anything else is a shape this was never verified against — dropped rather
  // than guessed at, so a future title can't invent a play type here.
  return null;
}

/** One player's cumulative touchdowns at a moment in the game, keyed by PresentationId. */
type TouchdownTally = Map<number, { touchdowns: number; position: string }>;

/** Who the save named, before the passer/scorer ordering is applied. */
interface SnapshotPlayer {
  presentationId: number;
  position: string;
}

async function readTouchdownTally(
  franchise: OpenFranchise,
  entry: FranchiseRecord,
  key: 'HomePlayerSnapshots' | 'AwayPlayerSnapshots',
  playerCache: Map<string, SnapshotPlayer | null>,
): Promise<TouchdownTally> {
  const tally: TouchdownTally = new Map();
  const ref = entry.getReferenceDataByKey(key);
  if (!ref || !ref.tableId) return tally;

  const container = franchise.getTableById(ref.tableId) as unknown as FranchiseTable | null;
  if (!container) return tally;
  await container.readRecords();
  const row = container.records[ref.rowNumber];
  if (!row) return tally;

  // The container row is a flat run of 32-bit reference words; a zero word is an
  // unused slot. `hexData` is the row's raw bytes — the only way at them, since
  // the typed accessors won't decode these.
  const raw = (row as unknown as { hexData?: Buffer }).hexData;
  if (!raw) return tally;

  for (let offset = 0; offset + 4 <= raw.length; offset += 4) {
    const word = raw.readUInt32BE(offset);
    if (!word) continue;
    const snapRef = decodeReference(word);
    const snapTable = franchise.getTableById(snapRef.tableId) as unknown as FranchiseTable | null;
    if (!snapTable) continue;
    await snapTable.readRecords();
    const snap = snapTable.records[snapRef.rowNumber];
    if (!snap || snap.isEmpty) continue;

    const touchdowns = Number(snap.Touchdowns);
    if (!Number.isFinite(touchdowns)) continue;

    const playerBits = String(snap.PlayerRef ?? '');
    if (playerBits.length !== 32) continue;
    const player = await resolvePlayer(franchise, playerBits, playerCache);
    if (!player) continue;
    tally.set(player.presentationId, { touchdowns, position: player.position });
  }

  return tally;
}

/**
 * PlayerRef -> identity. Cached by the raw bit string because the same three
 * leaders repeat on every scoring row of a game — a 14-score game would
 * otherwise resolve the same handful of players 84 times.
 *
 * Position is read alongside the id purely to order a passing touchdown's two
 * names correctly; see newScorers.
 */
async function resolvePlayer(
  franchise: OpenFranchise,
  playerBits: string,
  cache: Map<string, SnapshotPlayer | null>,
): Promise<SnapshotPlayer | null> {
  const cached = cache.get(playerBits);
  if (cached !== undefined) return cached;

  const ref = decodeReference(parseInt(playerBits, 2));
  const table = franchise.getTableById(ref.tableId) as unknown as FranchiseTable | null;
  let resolved: SnapshotPlayer | null = null;
  if (table) {
    await table.readRecords(['PresentationId', 'Position']);
    const player = table.records[ref.rowNumber];
    if (player && !player.isEmpty) {
      const id = Number(player.PresentationId);
      // 0 means "no id" everywhere else in this app, and a modded save can leave
      // it unset — see extract-coaches for the same rule.
      if (Number.isFinite(id) && id !== 0) {
        resolved = { presentationId: id, position: String(player.Position ?? '') };
      }
    }
  }
  cache.set(playerBits, resolved);
  return resolved;
}

/**
 * Whoever's touchdown count rose between the two snapshots, SCORER FIRST.
 *
 * A passing touchdown increments two players — the thrower and the catcher —
 * and the save lists them in snapshot order, which is quarterback first. Read
 * out in that order it renders as "Aaron Philo from Tye Melvin", crediting the
 * catch to the passer and the throw to the receiver: exactly backwards. The
 * quarterback is therefore moved to the end, so the man who reached the end zone
 * leads and the phrasing comes out "Tye Melvin from Aaron Philo".
 *
 * A quarterback keeper is untouched by this — he is the only name, so there is
 * no order to get wrong.
 */
function newScorers(before: TouchdownTally, after: TouchdownTally): number[] {
  const scored: { playerId: number; position: string }[] = [];
  for (const [playerId, entry] of after) {
    if (entry.touchdowns > (before.get(playerId)?.touchdowns ?? 0)) {
      scored.push({ playerId, position: entry.position });
    }
  }
  return scored
    .sort((a, b) => Number(a.position === 'QB') - Number(b.position === 'QB'))
    .map((s) => s.playerId);
}

export async function extractScoring(
  franchise: OpenFranchise,
  /** Team index per gameId, from the schedule — so a play knows whose it is without re-resolving team references. */
  gameSides: Map<number, { homeTeamIndex: number | null; awayTeamIndex: number | null }>,
): Promise<ScoringPlayData[]> {
  const seasonGame = getLargestTable(franchise, 'SeasonGame');
  await seasonGame.readRecords();

  const plays: ScoringPlayData[] = [];
  const playerCache = new Map<string, SnapshotPlayer | null>();

  for (const [index, record] of seasonGame.records.entries()) {
    if (record.isEmpty) continue;
    const listRef = record.getReferenceDataByKey('ScoringSummaries');
    if (!listRef || !listRef.tableId) continue;

    const list = franchise.getTableById(listRef.tableId) as unknown as FranchiseTable | null;
    if (!list) continue;
    await list.readRecords();
    const listRow = list.records[listRef.rowNumber];
    if (!listRow) continue;

    const sides = gameSides.get(index);
    let previousHome: TouchdownTally = new Map();
    let previousAway: TouchdownTally = new Map();

    for (let slot = 0; slot < MAX_SLOTS; slot++) {
      const entryRef = listRow.getReferenceDataByKey(`ScoringSummary${slot}`);
      if (!entryRef || !entryRef.tableId) continue;
      const entryTable = franchise.getTableById(entryRef.tableId) as unknown as FranchiseTable | null;
      if (!entryTable) continue;
      await entryTable.readRecords();
      const entry = entryTable.records[entryRef.rowNumber];
      if (!entry || entry.isEmpty) continue;

      const homeCurrent = Number(entry.HomeCurrentScore);
      const awayCurrent = Number(entry.AwayCurrentScore);
      const homeDelta = homeCurrent - Number(entry.HomePreviousScore);
      const awayDelta = awayCurrent - Number(entry.AwayPreviousScore);

      // Snapshots advance even on the period markers, so they are read before
      // the drop — otherwise the next real score diffs against a stale baseline
      // and credits a scorer twice.
      const homeTally = await readTouchdownTally(franchise, entry, 'HomePlayerSnapshots', playerCache);
      const awayTally = await readTouchdownTally(franchise, entry, 'AwayPlayerSnapshots', playerCache);

      const isHome = homeDelta > 0;
      const points = isHome ? homeDelta : awayDelta;
      const playType = classify(points);

      if (playType) {
        const conversion = conversionPoints(String(entry.Conversion));
        plays.push({
          gameId: index,
          quarter: Number(entry.Quarter),
          clockSeconds: Number(entry.TimeStampInSec),
          teamIndex: (isHome ? sides?.homeTeamIndex : sides?.awayTeamIndex) ?? null,
          isHome,
          points,
          conversionPoints: conversion,
          playType,
          // The try's points belong to the scoring side and to this row — see
          // the header note on the one-row lag.
          homeScore: homeCurrent + (isHome ? conversion : 0),
          awayScore: awayCurrent + (isHome ? 0 : conversion),
          scorers:
            playType === 'touchdown'
              ? newScorers(isHome ? previousHome : previousAway, isHome ? homeTally : awayTally)
              : [],
        });
      }

      previousHome = homeTally;
      previousAway = awayTally;
    }
  }

  return plays;
}
