/**
 * The FCS / placeholder pool.
 *
 * The save has no real FCS teams. It has ONE bucket at teamIndex 255 (0xFF =
 * "none") that every non-FBS entity is dumped into: the five "FCS East / West /
 * Midwest / Northwest / Southeast" rows, plus practice squads. All five carry
 * the same index, no conference, and prestige 0.
 *
 * **It is not a team, and treating it as one crashes the app.** Measured on a
 * real archive: **4,525 players sit on index 255** — the entire non-FBS pool
 * collapsed into a single roster. Anything that renders "a team's roster" for
 * that index tries to lay out thousands of rows with portraits and takes the
 * renderer down. Every other derived view is nonsense too: a "record" for the
 * pool merges five different opponents, and its stats would rank a fictional
 * team against the 139 real ones.
 *
 * So: the pool is excluded from team lists, rosters, team pages, series
 * records, and every ranked population.
 *
 * What is NOT excluded, deliberately: YOUR games against an FCS opponent. That
 * result is real, it counts in your record, and dropping it would quietly
 * corrupt the season. Those rows stay — they just aren't clickable.
 *
 * Defined once here because it had been re-declared in seven separate files,
 * which is exactly how one of them ends up forgetting the guard.
 */
export const FCS_POOL_TEAM_INDEX = 255;

/** True when this index is the placeholder pool rather than a real program. */
export function isFcsPool(teamIndex: number | null | undefined): boolean {
  return teamIndex === FCS_POOL_TEAM_INDEX;
}
