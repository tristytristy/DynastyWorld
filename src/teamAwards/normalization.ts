/**
 * Percentile rank of `value` within `group` (0-100), using the standard
 * "fraction scored lower or tied" formula. This is how cross-position
 * comparisons stay fair — a QB's raw production score and an HB's raw
 * production score are never compared directly, only each one's percentile
 * among their own position group. A group of size 1 returns 100 (nothing to
 * rank against).
 */
export function percentileRank(value: number, group: number[]): number {
  if (group.length <= 1) return 100;
  const lower = group.filter((v) => v < value).length;
  const equal = group.filter((v) => v === value).length;
  return (100 * (lower + 0.5 * equal)) / group.length;
}

/** Safe ratio — returns null (not NaN/Infinity) when the denominator is 0, so callers can flag it as a missing input rather than silently scoring a fabricated 0. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}
