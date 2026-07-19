import { rankWithTiebreakers } from './tiebreakers';
import { buildExplanation } from './explanations';
import type { AwardCandidate, AwardDefinition, AwardEngineResult, AwardTeamContext } from './types';

/** Orchestrates one automatic award's calculation: score every candidate, filter to eligible, rank, take finalists, recommend the top-ranked finalist, build its explanation. */
export function calculateAward(
  def: AwardDefinition,
  candidates: AwardCandidate[],
  team: AwardTeamContext,
): AwardEngineResult {
  if (def.calculationMode !== 'automaticWithConfirmation' || !def.computeCandidates) {
    throw new Error(`Award "${def.id}" is not an automatically-calculated award.`);
  }

  const scores = def.computeCandidates(candidates, team);
  const eligible = scores.filter((s) => s.eligibilityPassed);

  if (eligible.length === 0) {
    return {
      recommendedWinnerId: null,
      finalistIds: [],
      candidateScores: scores,
      explanation: null,
      missingInputs: [],
      insufficientData: true,
    };
  }

  const ranked = rankWithTiebreakers(eligible);
  const finalists = ranked.slice(0, def.finalistCount);
  const winnerScore = finalists[0];
  const winnerCandidate = candidates.find((c) => c.playerId === winnerScore.playerId);

  return {
    recommendedWinnerId: winnerScore.playerId,
    finalistIds: finalists.map((f) => f.playerId),
    candidateScores: scores,
    explanation: winnerCandidate ? buildExplanation(winnerCandidate) : null,
    missingInputs: winnerScore.missingInputs,
    insufficientData: false,
  };
}
