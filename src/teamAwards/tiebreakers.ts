import type { CandidateScoreResult } from './types';

export type TiebreakerFn = (a: CandidateScoreResult, b: CandidateScoreResult) => number;

/**
 * Ranks candidates best-first: normalized score, then each tiebreaker in
 * order, then a stable playerId comparison as the final fallback — never
 * alphabetical, per the spec's explicit rule, and never random/order-of-
 * insertion either.
 */
export function rankWithTiebreakers(
  scores: CandidateScoreResult[],
  tiebreakers: TiebreakerFn[] = [],
): CandidateScoreResult[] {
  return [...scores].sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) return b.normalizedScore - a.normalizedScore;
    for (const tiebreaker of tiebreakers) {
      const result = tiebreaker(a, b);
      if (result !== 0) return result;
    }
    return a.playerId - b.playerId;
  });
}
