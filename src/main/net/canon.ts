/**
 * The shared-history canon (user request, 2026-09-07): this dynasty universe
 * IS real college football, diverged at the dynasty's first season. Everything
 * that really happened before that — champions, dynasties, legendary coaches,
 * famous games and collapses — happened here too, and the fans remember it.
 *
 * The generation model already knows that history; what stopped it from ever
 * surfacing was our own "everything factual must come from the data" rule,
 * written to prevent invented DYNASTY results. This note reconciles the two
 * worlds instead of banning one: real pre-divergence history may be drawn on
 * freely, dynasty-era facts still come only from the archive.
 *
 * The divergence year is per-dynasty on purpose: the current save forked
 * after the real 2025 season, but the imported CFB 26 record book forked
 * after 2024 — its 2025 champion is its own.
 */

/** Seasoning strength — for the feed, board, and comment sections. */
export function realHistoryNote(firstSeasonYear: number): string {
  const lastRealSeason = firstSeasonYear - 1;
  return `\n\nSHARED HISTORY: this universe is real college football, diverged at the ${firstSeasonYear} season. Everything that happened in real CFB through the ${lastRealSeason} season — champions, dynasties, legendary coaches and players, famous games, historic collapses — happened here too, and the fans lived through it. Draw on that real history naturally for the occasional callback or comparison ("best MAC run since...", "worst top-5 collapse since 2007"), the way real fans do. Seasoning, not the subject — most posts stay about the present. Facts from ${firstSeasonYear} onward must still come ONLY from the provided data, and never reference real-world events after the ${lastRealSeason} season as if they happened here.`;
}

/** Analysis strength — for the Historian and The Shows, where comparisons to real history are expected, not just permitted. */
export function realHistoryAnalysisNote(firstSeasonYear: number): string {
  const lastRealSeason = firstSeasonYear - 1;
  return `\n\nSHARED HISTORY: this universe is real college football, diverged at the ${firstSeasonYear} season. All real CFB history through the ${lastRealSeason} season is canon here, and a real analyst would lean on it — so comparisons to real teams, coaches, and eras are welcome and EXPECTED where they illuminate ("a defense with a case against 2011 Alabama's", "the best mid-major run since 2006 Boise State", "numbers that echo 2019 LSU"). Be precise with the real history you invoke. Facts from ${firstSeasonYear} onward must still come ONLY from the provided archive data, and never treat real-world events after ${lastRealSeason} as having happened in this universe.`;
}
