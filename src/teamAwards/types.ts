import type { DefensiveStatLine, KickingStatLine, OffensiveStatLine } from '../shared/types';

export type AwardCategory = 'major' | 'offense' | 'defense' | 'specialTeams' | 'position' | 'story';
export type AwardCalculationMode = 'automaticWithConfirmation' | 'manual';

/** One roster player joined with their season stat line — the engine's input shape, built once per calculation from getRoster()+getPlayerStats()+getKickingStats(). */
export interface AwardCandidate {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  portraitAssetName: string | null;
  offense: OffensiveStatLine | null;
  defense: DefensiveStatLine | null;
  /** Kicking is a genuinely separate stat category (own save table, shared by K and P) — never both this and offense/defense at once for the same player. See extract-kicking.ts. */
  kicking: KickingStatLine | null;
}

/** Team-level season context a scoring model may need for "share of team production" components. Any field can be 0 (team hasn't played yet) — scoring models must guard division by zero themselves. */
export interface AwardTeamContext {
  gamesPlayed: number;
  offPassYards: number;
  offRushYards: number;
  passAttempts: number;
  rushAttempts: number;
  /** Team receptions — approximated as team pass completions (every completion is a reception by someone), since no standalone team-receptions field exists. */
  receptions: number;
  passTds: number;
  rushTds: number;
  sacks: number;
  defInts: number;
  fumbleRec: number;
  passDeflections: number;
  takeaways: number;
}

export interface ScoringComponentValue {
  key: string;
  label: string;
  rawValue: number | null;
  normalizedValue: number | null;
  weight: number;
  weightedScore: number;
}

export interface CandidateScoreResult {
  playerId: number;
  rawScore: number;
  normalizedScore: number;
  positionPercentile: number | null;
  eligibilityPassed: boolean;
  eligibilityReasons: string[];
  components: ScoringComponentValue[];
  missingInputs: string[];
}

/**
 * Config-driven award definition. `computeCandidates` carries the actual
 * scoring logic rather than a fully-declarative weight table — real formulas
 * need position-aware normalization and shared-context math (team totals,
 * cross-position percentile grouping) that a pure data table can't express
 * cleanly. The declarative parts (eligiblePositions/eligibleClasses/
 * minimumGamesPlayedFraction) still drive real, generic eligibility
 * filtering in eligibility.ts, and every component's weight/raw/normalized
 * value is still recorded per candidate for the Calculation Details drawer —
 * transparency doesn't require a pure-config engine, just a documented one.
 */
export interface AwardDefinition {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  category: AwardCategory;
  calculationMode: AwardCalculationMode;
  /** False awards are visible (so the full 12-award scope is honest and discoverable) but not calculable yet — see disabledReason. */
  enabled: boolean;
  disabledReason?: string;
  /**
   * Permanently removed from the active award package (a coaching-philosophy
   * decision, not a data limitation) — distinct from `enabled: false`
   * ("coming later") and from a user's own `disabledAwardIds` toggle
   * ("reversible, hidden from the workflow"). A retired award is never
   * offered for future calculation/finalists/settings, but its definition
   * object is kept forever so any already-stored `team_award_results` row
   * (real historical data, possibly already confirmed) still resolves a
   * name via getAwardDefinition() instead of orphaning that data.
   */
  retired?: boolean;
  eligiblePositions?: string[];
  eligibleClasses?: string[];
  /** e.g. 0.25 = must have played in at least 25% of the team's games so far this season. */
  minimumGamesPlayedFraction?: number;
  /** Award-specific participation rules beyond position/class/games-played (e.g. QB needing 20% of team pass attempts) — returns failure reasons, or an empty array when the candidate passes. */
  customEligibility?: (candidate: AwardCandidate, team: AwardTeamContext) => string[];
  finalistCount: number;
  calculationVersion: string;
  /** Present only for calculationMode: 'automaticWithConfirmation' awards. */
  computeCandidates?: (
    candidates: AwardCandidate[],
    team: AwardTeamContext,
  ) => CandidateScoreResult[];
}

export interface AwardEngineResult {
  recommendedWinnerId: number | null;
  finalistIds: number[];
  candidateScores: CandidateScoreResult[];
  explanation: string | null;
  missingInputs: string[];
  insufficientData: boolean;
}
