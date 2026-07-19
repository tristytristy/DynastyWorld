import type { AwardCandidate, AwardDefinition, AwardTeamContext } from './types';

export function gamesPlayedFor(candidate: AwardCandidate): number {
  return candidate.offense?.gamesPlayed ?? candidate.defense?.gamesPlayed ?? candidate.kicking?.gamesPlayed ?? 0;
}

export interface EligibilityCheck {
  passed: boolean;
  reasons: string[];
}

/** Generic eligibility gate every automatic award routes through before scoring — position, class, and participation-share checks, all driven by the definition's own declarative fields, plus any award-specific customEligibility rule. */
export function checkEligibility(
  def: AwardDefinition,
  candidate: AwardCandidate,
  team: AwardTeamContext,
): EligibilityCheck {
  const reasons: string[] = [];

  if (def.eligiblePositions && !def.eligiblePositions.includes(candidate.position)) {
    reasons.push(`Position ${candidate.position} is not eligible for this award.`);
  }

  if (def.eligibleClasses && !def.eligibleClasses.includes(candidate.schoolYear)) {
    reasons.push(`Class ${candidate.schoolYear} is not eligible for this award.`);
  }

  if (def.minimumGamesPlayedFraction && team.gamesPlayed > 0) {
    const required = def.minimumGamesPlayedFraction * team.gamesPlayed;
    const played = gamesPlayedFor(candidate);
    if (played < required) {
      reasons.push(
        `Played in ${played} of the team's ${team.gamesPlayed} games — below the ${Math.round(def.minimumGamesPlayedFraction * 100)}% participation minimum.`,
      );
    }
  }

  if (!candidate.offense && !candidate.defense && !candidate.kicking) {
    reasons.push('No recorded season statistics.');
  }

  if (def.customEligibility) {
    reasons.push(...def.customEligibility(candidate, team));
  }

  return { passed: reasons.length === 0, reasons };
}
