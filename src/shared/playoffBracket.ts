import { isGamePlayed } from './gameStatus';
import { CFP_FIRST_ROUND, CFP_QUARTERFINAL, CFP_SEMIFINAL } from './cfpBowls';
import type { PlayoffRound } from './types';

/**
 * The bracket's shape and wiring — everything about the twelve-team playoff
 * that is true regardless of where the data came from.
 *
 * Kept out of the database layer deliberately. The slot derivation below is the
 * one genuinely non-obvious piece of this feature, and here it can be exercised
 * against real extracted games without standing up SQLite. It also means the
 * renderer can share the wiring rather than re-deriving the layout.
 *
 * Structural input type rather than importing `GameData`: shared/ is imported
 * BY the extractors, so depending on them back would invert the layering.
 * `GameData` satisfies this shape as-is.
 */
export interface BracketGameInput {
  gameId: number;
  status: string;
  bowlName: string | null;
  isNationalChampionship: boolean;
  homeTeamIndex: number | null;
  awayTeamIndex: number | null;
  homeScore: number;
  awayScore: number;
  playoffBracketSlot?: number | null;
}

export const FIRST_ROUND_SLOTS = [0, 1, 2, 3];
export const QUARTERFINAL_SLOTS = [4, 5, 6, 7];
export const SEMIFINAL_SLOTS = [8, 9];
export const CHAMPIONSHIP_SLOT = 10;

/** All eleven, in bracket order. */
export const ALL_SLOTS = [
  ...FIRST_ROUND_SLOTS,
  ...QUARTERFINAL_SLOTS,
  ...SEMIFINAL_SLOTS,
  CHAMPIONSHIP_SLOT,
];

/**
 * Where each slot's winner goes. Verified against every actual matchup across
 * two full postseasons: first-round slot N feeds quarterfinal N+4;
 * quarterfinals 4 and 7 feed semifinal 8; 5 and 6 feed semifinal 9; both
 * semifinals feed the title game.
 */
export const FEEDS_INTO: Record<number, number | null> = {
  0: 4,
  1: 5,
  2: 6,
  3: 7,
  4: 8,
  7: 8,
  5: 9,
  6: 9,
  8: 10,
  9: 10,
  10: null,
};

export function roundOf(slot: number): PlayoffRound {
  if (FIRST_ROUND_SLOTS.includes(slot)) return 'first-round';
  if (QUARTERFINAL_SLOTS.includes(slot)) return 'quarterfinal';
  if (SEMIFINAL_SLOTS.includes(slot)) return 'semifinal';
  return 'championship';
}

/** A CFP game of any round, by the save's own naming. */
export function isPlayoffGame(game: BracketGameInput): boolean {
  if (game.isNationalChampionship) return true;
  return (
    game.bowlName === CFP_FIRST_ROUND ||
    game.bowlName === CFP_QUARTERFINAL ||
    game.bowlName === CFP_SEMIFINAL
  );
}

/**
 * A CFP seed from a poll rank.
 *
 * The CFP poll IS the seeding — verified across both captured postseasons,
 * where every matchup's ranks read exactly as the bracket showed them, and
 * confirmed to survive into offseason stage 1 so an archived season keeps its
 * seeding. The poll ranks all 138 FBS teams though, so anything outside 1-12
 * isn't a seed: 0 means the poll hasn't been released, 255 is the FCS
 * placeholder.
 */
export function seedOf(rank: number | undefined): number | null {
  if (rank === undefined || rank < 1 || rank > 12) return null;
  return rank;
}

/**
 * Bracket positions for a season synced before `playoffBracketSlot` shipped.
 *
 * Reconstructed from seeds, which old snapshots do carry, on the same principle
 * lib/neutralVenues.ts uses: the save's own value wins when present, and this is
 * a floor rather than a ceiling. The geometry is fixed by the CFP's own rules,
 * so this is derivation, not guesswork:
 *
 * - First round pairs 5v12, 6v11, 7v10, 8v9 into slots 3, 2, 1, 0 — so a game's
 *   slot is `8 - (its better seed)`.
 * - Each quarterfinal holds exactly one bye seed 1-4, in slots 4, 5, 6, 7 — so
 *   its slot is `3 + (that bye seed)`.
 * - Semifinal 8 takes the winners out of quarterfinals 4 and 7, semifinal 9
 *   takes 5 and 6; a quarterfinal winner appears again in the semifinal, so the
 *   participant itself is the link.
 *
 * Returns gameId → slot, leaving out anything it can't place rather than
 * forcing it somewhere plausible. Semifinals can only be placed once their
 * quarterfinals are played — before that the slots are empty anyway.
 */
export function deriveBracketSlots(
  games: BracketGameInput[],
  seedByTeam: Map<number, number>,
): Map<number, number> {
  const slotByGameId = new Map<number, number>();
  const seedsOf = (g: BracketGameInput): number[] =>
    [g.homeTeamIndex, g.awayTeamIndex]
      .map((i) => (i === null ? undefined : seedByTeam.get(i)))
      .filter((s): s is number => s !== undefined);

  for (const g of games) {
    if (g.bowlName !== CFP_FIRST_ROUND) continue;
    const seeds = seedsOf(g);
    if (seeds.length !== 2) continue;
    const better = Math.min(...seeds);
    if (better < 5 || better > 8) continue;
    slotByGameId.set(g.gameId, 8 - better);
  }

  const quarterfinals = games.filter((g) => g.bowlName === CFP_QUARTERFINAL);
  for (const g of quarterfinals) {
    // The bye seed is the only 1-4 in the pairing; the other side came out of
    // the first round and is seeded 5-12.
    const bye = seedsOf(g).find((s) => s <= 4);
    if (bye === undefined) continue;
    slotByGameId.set(g.gameId, 3 + bye);
  }

  /*
    A FIRST-ROUND GAME PLACED BY WHERE ITS WINNER TURNED UP (user report
    2026-08-07). The rule above needs both teams' seeds, and seeds come from the
    CURRENT cfp poll — which keeps moving after the bracket is set. A team that
    entered as the 5 seed can be sitting at 15 by the time the season is synced
    (seen exactly that: a first-round game between the 14 and the 6), and then
    `seedOf` returns null, the game is skipped, and the bracket prints TO BE
    DECIDED for a game whose score is on the Scores page.

    The wiring answers it without any seed at all: first-round slot N feeds
    quarterfinal N+4, and a first-round WINNER plays in that quarterfinal. So
    find the placed quarterfinal this game's winner appears in and subtract four.

    Runs after the seed rule and never overwrites it — the save's own numbering
    wins, then seeds, then this. And it refuses a slot another game already
    holds, because two first-round games claiming one position would be worse
    than one empty box.
  */
  const quarterfinalSlotByParticipant = new Map<number, number>();
  for (const g of quarterfinals) {
    const slot = slotByGameId.get(g.gameId);
    if (slot === undefined) continue;
    for (const teamIndex of [g.homeTeamIndex, g.awayTeamIndex]) {
      if (teamIndex !== null) quarterfinalSlotByParticipant.set(teamIndex, slot);
    }
  }
  const takenSlots = new Set(slotByGameId.values());
  for (const g of games) {
    if (g.bowlName !== CFP_FIRST_ROUND || slotByGameId.has(g.gameId)) continue;
    if (!isGamePlayed(g.status)) continue;
    const winner = g.homeScore > g.awayScore ? g.homeTeamIndex : g.awayTeamIndex;
    if (winner === null) continue;
    const quarterfinalSlot = quarterfinalSlotByParticipant.get(winner);
    if (quarterfinalSlot === undefined) continue;
    const slot = quarterfinalSlot - 4;
    if (!FIRST_ROUND_SLOTS.includes(slot) || takenSlots.has(slot)) continue;
    slotByGameId.set(g.gameId, slot);
    takenSlots.add(slot);
  }

  const quarterfinalSlotOfWinner = new Map<number, number>();
  for (const g of quarterfinals) {
    const slot = slotByGameId.get(g.gameId);
    if (slot === undefined || !isGamePlayed(g.status)) continue;
    const winner = g.homeScore > g.awayScore ? g.homeTeamIndex : g.awayTeamIndex;
    if (winner !== null) quarterfinalSlotOfWinner.set(winner, slot);
  }

  for (const g of games) {
    if (g.bowlName !== CFP_SEMIFINAL) continue;
    const from = [g.homeTeamIndex, g.awayTeamIndex]
      .map((i) => (i === null ? undefined : quarterfinalSlotOfWinner.get(i)))
      .filter((s): s is number => s !== undefined);
    if (from.length === 0) continue;
    slotByGameId.set(g.gameId, from.some((s) => s === 4 || s === 7) ? 8 : 9);
  }

  const championship = games.find((g) => g.isNationalChampionship);
  if (championship) slotByGameId.set(championship.gameId, CHAMPIONSHIP_SLOT);

  return slotByGameId;
}

/**
 * Slots for every playoff game, preferring the save's own numbering.
 *
 * "Every playoff game has one" is the test rather than "some do": the field is
 * absent wholesale on a season synced before it was extracted, so a partial
 * result would mean something unexpected and derivation is the safer read.
 */
export function bracketSlots(
  games: BracketGameInput[],
  seedByTeam: Map<number, number>,
): { slotByGameId: Map<number, number>; fromSave: boolean } {
  const fromSave =
    games.length > 0 &&
    games.every((g) => g.playoffBracketSlot !== null && g.playoffBracketSlot !== undefined);

  if (fromSave) {
    return {
      slotByGameId: new Map(games.map((g) => [g.gameId, g.playoffBracketSlot as number])),
      fromSave: true,
    };
  }
  return { slotByGameId: deriveBracketSlots(games, seedByTeam), fromSave: false };
}
