import {
  OVR_FORMULAS,
  PLAYER_TYPE_IDS,
  POSITION_IDS,
  UNSUPPORTED_FORMULA_KEYS,
  type OvrFormula,
} from './ovrFormulas.generated';

/**
 * The game's own overall-rating calculation, so the editor can show what a
 * rating change actually does instead of leaving OVR as a number the user has
 * to guess at and type in by hand.
 *
 * Each (position, archetype) pair has a weight vector and a pair of bounds. The
 * weights decide WHAT matters; the bounds decide how hard the weighted average
 * is stretched onto the 0-99 scale. See ovrFormulas.generated.ts for where the
 * tables come from and how accurate they measured.
 *
 * This is a READ-ONLY derivation — it never writes. Whether the game recomputes
 * OverallRating itself when it loads a save is not something a file round-trip
 * can answer, so the editor presents this as the computed value and leaves the
 * decision to write it to the caller.
 */

/** The formula's rounding: nearest integer, but an exact .5 goes DOWN (the workbook's note about in-game behaviour). */
function roundHalfDown(value: number): number {
  const floor = Math.floor(value);
  return Math.abs(value - floor - 0.5) < 1e-10 ? floor : Math.floor(value + 0.5);
}

function formulaKey(position: string, playerType: string): string | null {
  const ppos = POSITION_IDS[position];
  const plty = PLAYER_TYPE_IDS[playerType];
  if (ppos === undefined || plty === undefined) return null;
  return `${ppos}:${plty}`;
}

/** Why an overall could not be computed — surfaced so the UI can say something true rather than nothing. */
export type OverallUnavailableReason =
  /** The save's position/archetype pair isn't one we hold a formula for. */
  | 'unknown-archetype'
  /**
   * A formula exists but is knowingly wrong or uncomputable for this position:
   * kickers and punters need kicking ratings the editor doesn't expose, and
   * K/P/FS weights changed in CFB 27 from the ones we have.
   */
  | 'unsupported-position';

export interface OverallResult {
  overall: number | null;
  reason: OverallUnavailableReason | null;
}

/** True when a live overall can be trusted for this position/archetype. */
export function canCalculateOverall(position: string, playerType: string): boolean {
  const key = formulaKey(position, playerType);
  return key !== null && !UNSUPPORTED_FORMULA_KEYS.has(key) && OVR_FORMULAS[key] !== undefined;
}

/**
 * The overall this player's ratings produce, or null with a reason.
 *
 * `ratings` is keyed by RatingFieldDef.key — the same record the editor already
 * holds — so a caller can pass its in-progress edits straight in and see the
 * result before saving.
 */
export function calculateOverall(
  ratings: Record<string, number>,
  position: string,
  playerType: string,
): OverallResult {
  const key = formulaKey(position, playerType);
  if (key === null || OVR_FORMULAS[key] === undefined) {
    return { overall: null, reason: 'unknown-archetype' };
  }
  if (UNSUPPORTED_FORMULA_KEYS.has(key)) {
    return { overall: null, reason: 'unsupported-position' };
  }

  const formula: OvrFormula = OVR_FORMULAS[key];
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const [attribute, weight] of Object.entries(formula.weights)) {
    const rating = ratings[attribute];
    // A rating the caller simply hasn't got is not zero — treating it as zero
    // would drag the average down and produce a confidently wrong overall. Drop
    // the term AND its weight so the average stays over what we actually know.
    if (typeof rating !== 'number' || !Number.isFinite(rating)) continue;
    weightedTotal += rating * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return { overall: null, reason: 'unknown-archetype' };

  const weightedAverage = weightedTotal / totalWeight;
  const raw = ((weightedAverage - formula.low) * 99) / (formula.high - formula.low);
  return { overall: Math.max(12, Math.min(99, roundHalfDown(raw))), reason: null };
}
