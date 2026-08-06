/**
 * Total offense vs all-purpose yards — the distinction the app was collapsing.
 *
 * THE SAVE'S `TOTALYARDS` IS ALL-PURPOSE, NOT OFFENSE. Verified across 2,168
 * team-game lines in two unrelated saves, both formulas holding on every one:
 *
 *   OFFYARDS   = OFFPASSYARDS + OFFRUSHYARDS
 *   TOTALYARDS = OFFYARDS + KICKRETURNYARDS + PUNTRETURNYARDS
 *
 * The app rendered `TOTALYARDS` under labels that say offense — "Total Yards"
 * on the box score, "Total Off / G" on a team profile, `offenseYardsPerGame` in
 * the coach metrics, the national offensive ranking. User-reported 2026-08-04
 * against the game's own box score: a USC line read 530 where the game said 422,
 * the 108 difference being USC's kick return yards that afternoon. The correct
 * number was already on screen — pass 251 + rush 171 = 422 — one row below the
 * wrong one.
 *
 * DEFENSE WAS WORSE IN KIND. "Yards allowed" summed the OPPONENT's all-purpose
 * total, charging a defense for kickoff returns it was never on the field for.
 *
 * NEITHER HELPER NEEDS A RE-SYNC. Offense is pass + rush, which every archive
 * already stores, and it is provably identical to the save's own `OFFYARDS` on
 * all 2,168 lines — so existing seasons are corrected simply by reading them
 * this way. That is why this derives rather than extracting a new field.
 *
 * Interception return yards are NOT in either number; they are not part of the
 * save's team-level yardage at all.
 */

/** The yardage fields these helpers need — structural, so any stat line fits. */
export interface YardageFields {
  totalYards: number;
  passYards: number;
  rushYards: number;
}

/** Total offense: what the game's box score calls "Total Offense". */
export function offenseYards(line: YardageFields): number {
  return line.passYards + line.rushYards;
}

/**
 * Kick + punt return yardage, as the remainder of the save's all-purpose total.
 *
 * Derived rather than extracted because the per-game team stat line carries no
 * return columns of its own — the save keeps them only inside `TOTALYARDS`.
 * Floored at zero: the formula holds on every line measured, and a negative
 * would mean the invariant broke rather than that a team lost return yardage.
 */
export function returnYards(line: YardageFields): number {
  return Math.max(0, line.totalYards - offenseYards(line));
}

/**
 * The SEASON-level team stat line (extract-team-stats) names the same two
 * fields differently — `offPassYards`/`offRushYards` rather than
 * `passYards`/`rushYards` — so it needs its own entry point rather than a
 * rename that would churn every consumer of that type.
 *
 * Same table, same `TOTALYARDS` semantics: all-purpose, not offense.
 */
export interface SeasonYardageFields {
  totalYards: number;
  offPassYards: number;
  offRushYards: number;
}

export function seasonOffenseYards(line: SeasonYardageFields): number {
  return line.offPassYards + line.offRushYards;
}

