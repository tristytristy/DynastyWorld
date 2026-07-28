/**
 * Position filtering by ROLE rather than by the save's raw depth-chart slot.
 *
 * The game stores a handed slot — LT/RT, LG/RG, LE/RE, LOLB/ROLB — but those
 * sides are interchangeable in practice: a right end moved to left end is the
 * same player with the same ratings, and recruits get flipped constantly. So
 * filtering for "RE" hides half the edge rushers in the country for no
 * meaningful reason. These groups collapse the handedness and leave the real
 * distinctions (tackle vs guard, edge vs interior) intact.
 *
 * Order is football order — offense from the ball outward, then defense front
 * to back — not alphabetical, so the list reads the way a depth chart does.
 */

export interface PositionFilterGroup {
  /** Stored filter value. */
  value: string;
  label: string;
  /** The raw save positions this matches. */
  positions: string[];
}

export const POSITION_FILTER_GROUPS: PositionFilterGroup[] = [
  { value: 'QB', label: 'QB', positions: ['QB'] },
  { value: 'HB', label: 'HB', positions: ['HB'] },
  { value: 'FB', label: 'FB', positions: ['FB'] },
  { value: 'WR', label: 'WR', positions: ['WR'] },
  { value: 'TE', label: 'TE', positions: ['TE'] },
  { value: 'OT', label: 'OT', positions: ['LT', 'RT'] },
  { value: 'OG', label: 'OG', positions: ['LG', 'RG'] },
  { value: 'C', label: 'C', positions: ['C'] },
  { value: 'EDGE', label: 'EDGE', positions: ['LE', 'RE'] },
  { value: 'DT', label: 'DT', positions: ['DT'] },
  { value: 'OLB', label: 'OLB', positions: ['LOLB', 'ROLB'] },
  { value: 'MLB', label: 'MLB', positions: ['MLB'] },
  { value: 'CB', label: 'CB', positions: ['CB'] },
  { value: 'S', label: 'S', positions: ['SS'] },
  { value: 'FS', label: 'FS', positions: ['FS'] },
  // Specialists aren't in the football-order list above, but they're real
  // recruits (100+ punters in a national pool) — dropping them from the filter
  // would quietly make them unfindable.
  { value: 'K', label: 'K', positions: ['K'] },
  { value: 'P', label: 'P', positions: ['P'] },
];

/**
 * Wider groupings offered BELOW the main list — they deliberately overlap with
 * it (IOL contains the same players as OG plus C), so they're kept separate
 * rather than mixed in, where the duplication would read as a mistake.
 */
export const POSITION_SUPER_GROUPS: PositionFilterGroup[] = [
  { value: 'IOL', label: 'IOL — interior line', positions: ['LG', 'RG', 'C'] },
  { value: 'SFTY', label: 'SFTY — all safeties', positions: ['SS', 'FS'] },
];

const ALL_GROUPS = [...POSITION_FILTER_GROUPS, ...POSITION_SUPER_GROUPS];
const BY_VALUE = new Map(ALL_GROUPS.map((g) => [g.value, g]));

/** True when a player's raw position belongs to the selected filter. Unknown filter values match nothing. */
export function matchesPositionFilter(filterValue: string, rawPosition: string): boolean {
  if (!filterValue) return true;
  return BY_VALUE.get(filterValue)?.positions.includes(rawPosition) ?? false;
}

/**
 * The groups worth offering for a given set of players — a group with nobody in
 * it is a dead end, so an empty watchlist doesn't show fifteen positions that
 * all return nothing.
 */
export function availablePositionGroups(rawPositions: Iterable<string>): {
  groups: PositionFilterGroup[];
  superGroups: PositionFilterGroup[];
} {
  const present = new Set(rawPositions);
  const has = (g: PositionFilterGroup) => g.positions.some((p) => present.has(p));
  return {
    groups: POSITION_FILTER_GROUPS.filter(has),
    superGroups: POSITION_SUPER_GROUPS.filter(has),
  };
}
