import type { ScoringComponentValue } from './types';

export interface ComponentInput {
  key: string;
  label: string;
  /** Intended weight if every component were available — weights across one award's full component list should sum to 1. */
  weight: number;
  rawValue: number | null;
  /** Pre-normalized to a common 0-100 scale (percentile or ratio*100) — the caller's job, since normalization differs per component. Null means this input is unavailable for this candidate (missing stat, zero-denominator ratio), not a real zero. */
  normalizedValue: number | null;
}

export interface WeightedScoreResult {
  normalizedScore: number;
  components: ScoringComponentValue[];
  missingInputs: string[];
}

/**
 * Builds a weighted score from a component list, redistributing any missing
 * component's weight proportionally across the components that ARE
 * available — the "drop it, redistribute the weight, record what's missing"
 * rule applied generically so no award formula needs to hand-roll this.
 */
export function buildWeightedScore(inputs: ComponentInput[]): WeightedScoreResult {
  const available = inputs.filter((c) => c.normalizedValue !== null);
  const availableWeightTotal = available.reduce((sum, c) => sum + c.weight, 0);
  const redistributionFactor = availableWeightTotal > 0 ? 1 / availableWeightTotal : 0;

  const components: ScoringComponentValue[] = inputs.map((c) => {
    if (c.normalizedValue === null) {
      return { key: c.key, label: c.label, rawValue: c.rawValue, normalizedValue: null, weight: 0, weightedScore: 0 };
    }
    const adjustedWeight = c.weight * redistributionFactor;
    return {
      key: c.key,
      label: c.label,
      rawValue: c.rawValue,
      normalizedValue: c.normalizedValue,
      weight: adjustedWeight,
      weightedScore: c.normalizedValue * adjustedWeight,
    };
  });

  return {
    normalizedScore: components.reduce((sum, c) => sum + c.weightedScore, 0),
    components,
    missingInputs: inputs.filter((c) => c.normalizedValue === null).map((c) => c.label),
  };
}
