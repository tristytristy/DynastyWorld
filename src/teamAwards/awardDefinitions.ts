import { buildWeightedScore } from './scoring';
import { checkEligibility, gamesPlayedFor } from './eligibility';
import { TEAM_AWARDS_VERSION } from './calculationVersions';
import {
  POSITION_GROUPS,
  ballSecurityRaw,
  dbSubgroup,
  percentileByGroup,
  productionRawScore,
  skillSubgroup,
  specialTeamsEfficiencyRaw,
  specialTeamsGroup,
  specialTeamsProductionRaw,
  teamProductionShare,
} from './formulas';
import type { AwardCandidate, AwardDefinition, AwardTeamContext, CandidateScoreResult } from './types';

/**
 * Phase 1 ships a real, but intentionally reduced, MVP formula. The full
 * spec formula is:
 *   Position-Adjusted Performance x 0.45 + Share of Team Production x 0.20
 *   + Game Impact x 0.15 + Big-Game Performance x 0.10 + Consistency x 0.10
 * Game Impact, Big-Game Performance, and Consistency all need per-game
 * context (which games mattered, game-by-game variance) that only exists
 * once gamelog is joined to the schedule — Phase 5 scope. They're listed
 * below as real components with a null rawValue so buildWeightedScore's
 * generic missing-input redistribution proportionally folds their 0.35
 * combined weight into the two components that ARE available today, and
 * they show up honestly in missingInputs rather than being silently
 * dropped from the formula's own record of itself.
 */
function computeMvpCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = MVP_DEFINITION;
  const raw = candidates.map((c) => ({ playerId: c.playerId, groupKey: POSITION_GROUPS[c.position] ?? null, rawValue: productionRawScore(c) }));
  const percentiles = percentileByGroup(raw);

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const percentile = percentiles.get(candidate.playerId);

    if (!eligibility.passed || percentile === undefined) {
      return {
        playerId: candidate.playerId,
        rawScore: 0,
        normalizedScore: 0,
        positionPercentile: null,
        eligibilityPassed: false,
        eligibilityReasons: eligibility.passed ? ['No position-adjusted production score available.'] : eligibility.reasons,
        components: [],
        missingInputs: [],
      };
    }

    const teamShare = teamProductionShare(candidate, team);
    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'positionAdjusted', label: 'Position-Adjusted Performance', weight: 0.45, rawValue: productionRawScore(candidate), normalizedValue: percentile },
      { key: 'teamShare', label: 'Share of Team Production', weight: 0.2, rawValue: teamShare, normalizedValue: teamShare },
      { key: 'gameImpact', label: 'Game Impact', weight: 0.15, rawValue: null, normalizedValue: null },
      { key: 'bigGame', label: 'Big-Game Performance', weight: 0.1, rawValue: null, normalizedValue: null },
      { key: 'consistency', label: 'Consistency', weight: 0.1, rawValue: null, normalizedValue: null },
    ]);

    return {
      playerId: candidate.playerId,
      rawScore: productionRawScore(candidate) ?? 0,
      normalizedScore,
      positionPercentile: percentile,
      eligibilityPassed: true,
      eligibilityReasons: [],
      components,
      missingInputs,
    };
  });
}

const MVP_DEFINITION: AwardDefinition = {
  id: 'mvp',
  name: 'Most Valuable Player',
  description: 'The single most valuable player on the team this season, compared across positions using position-adjusted percentile scoring.',
  category: 'major',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeMvpCandidates,
};

const NEWCOMER_DEFINITION: AwardDefinition = {
  id: 'newcomerOfTheYear',
  name: 'Newcomer of the Year',
  description: 'The most impactful first-year addition to the program. Selected manually — the save data has no transfer/newcomer field to calculate this from.',
  category: 'major',
  calculationMode: 'manual',
  enabled: true,
  retired: true,
  finalistCount: 0,
  calculationVersion: TEAM_AWARDS_VERSION,
};

/**
 * Offensive Player of the Year. Ball Security now uses the real RUSHFUMBLES
 * field (see OffensiveStatLine.fumbles) — it covers rushing-play fumbles
 * only, not a "fumbles lost" figure (no such field exists), but it's real
 * data, not fabricated.
 */
function computeOffensivePoyCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('offensivePlayerOfTheYear')!;
  const groupOf = (c: AwardCandidate) => POSITION_GROUPS[c.position] ?? null;

  const production = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: productionRawScore(c) })));
  const efficiency = percentileByGroup(
    candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: offensiveEfficiencyRaw(c) })),
  );
  const scoring = percentileByGroup(
    candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: totalOffensiveTDs(c) })),
  );
  const ballSecurity = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: ballSecurityRaw(c) })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const prodPercentile = production.get(candidate.playerId);

    if (!eligibility.passed || prodPercentile === undefined) {
      return emptyIneligible(candidate, eligibility);
    }

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'production', label: 'Position-Adjusted Production', weight: 0.55, rawValue: productionRawScore(candidate), normalizedValue: prodPercentile },
      { key: 'efficiency', label: 'Efficiency', weight: 0.2, rawValue: offensiveEfficiencyRaw(candidate), normalizedValue: efficiency.get(candidate.playerId) ?? null },
      { key: 'scoring', label: 'Scoring', weight: 0.15, rawValue: totalOffensiveTDs(candidate), normalizedValue: scoring.get(candidate.playerId) ?? null },
      { key: 'ballSecurity', label: 'Ball Security', weight: 0.1, rawValue: ballSecurityRaw(candidate), normalizedValue: ballSecurity.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, productionRawScore(candidate) ?? 0, normalizedScore, prodPercentile, components, missingInputs);
  });
}

function offensiveEfficiencyRaw(candidate: AwardCandidate): number | null {
  if (!candidate.offense) return null;
  const o = candidate.offense;
  const group = POSITION_GROUPS[candidate.position];
  if (group === 'qb') return o.passAttempts > 0 ? o.passYards / o.passAttempts : null;
  if (group === 'backs' || group === 'receivers') {
    const touches = o.rushAttempts + o.receptions;
    return touches > 0 ? (o.rushYards + o.receivingYards) / touches : null;
  }
  return null;
}

function totalOffensiveTDs(candidate: AwardCandidate): number | null {
  if (!candidate.offense) return null;
  const o = candidate.offense;
  const group = POSITION_GROUPS[candidate.position];
  if (group === 'qb') return o.passTDs + o.rushTDs;
  return o.rushTDs + o.receivingTDs;
}

const OFFENSIVE_POY_DEFINITION: AwardDefinition = {
  id: 'offensivePlayerOfTheYear',
  name: 'Offensive Player of the Year',
  description: 'The best offensive player, across QB/HB/FB/WR/TE.',
  category: 'major',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligiblePositions: ['QB', 'HB', 'FB', 'WR', 'TE'],
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeOffensivePoyCandidates,
};

/** Defensive Player of the Year — all four components are fully real; no missing-data gaps here. */
function computeDefensivePoyCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('defensivePlayerOfTheYear')!;
  const groupOf = (c: AwardCandidate) => POSITION_GROUPS[c.position] ?? null;

  const production = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: productionRawScore(c) })));
  const impact = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: impactPlaysRaw(c) })));
  const turnovers = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: turnoverScoringRaw(c) })));
  const availability = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: c.defense ? c.defense.gamesPlayed : null })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const prodPercentile = production.get(candidate.playerId);
    if (!eligibility.passed || prodPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'production', label: 'Position-Adjusted Production', weight: 0.5, rawValue: productionRawScore(candidate), normalizedValue: prodPercentile },
      { key: 'impact', label: 'Impact Plays', weight: 0.3, rawValue: impactPlaysRaw(candidate), normalizedValue: impact.get(candidate.playerId) ?? null },
      { key: 'turnovers', label: 'Turnovers and Scoring', weight: 0.15, rawValue: turnoverScoringRaw(candidate), normalizedValue: turnovers.get(candidate.playerId) ?? null },
      { key: 'availability', label: 'Availability', weight: 0.05, rawValue: candidate.defense?.gamesPlayed ?? null, normalizedValue: availability.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, productionRawScore(candidate) ?? 0, normalizedScore, prodPercentile, components, missingInputs);
  });
}

function impactPlaysRaw(candidate: AwardCandidate): number | null {
  if (!candidate.defense) return null;
  const d = candidate.defense;
  return d.sacks * 4 + d.tacklesForLoss * 2 + d.forcedFumbles * 4;
}

function turnoverScoringRaw(candidate: AwardCandidate): number | null {
  if (!candidate.defense) return null;
  const d = candidate.defense;
  return d.interceptions * 5 + d.fumbleRecoveries * 3 + d.interceptionTDs * 8;
}

const DEFENSIVE_POY_DEFINITION: AwardDefinition = {
  id: 'defensivePlayerOfTheYear',
  name: 'Defensive Player of the Year',
  description: 'The best defensive player, across every defensive position.',
  category: 'major',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligiblePositions: ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'SS', 'FS'],
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeDefensivePoyCandidates,
};

/** Best Quarterback — a single-position award, so percentile grouping is just "every eligible QB." */
function computeBestQbCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('bestQuarterback')!;
  const qbGroup = (c: AwardCandidate) => (c.position === 'QB' ? 'qb' : null);

  const production = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: qbGroup(c), rawValue: c.offense?.passYards ?? null })));
  const efficiency = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: qbGroup(c), rawValue: offensiveEfficiencyRaw(c) })));
  const tds = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: qbGroup(c), rawValue: c.offense?.passTDs ?? null })));
  const rushing = percentileByGroup(
    candidates.map((c) => ({ playerId: c.playerId, groupKey: qbGroup(c), rawValue: c.offense ? c.offense.rushYards + c.offense.rushTDs * 20 : null })),
  );
  const ballSecurity = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: qbGroup(c), rawValue: ballSecurityRaw(c) })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const prodPercentile = production.get(candidate.playerId);
    if (!eligibility.passed || prodPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const rushRaw = candidate.offense ? candidate.offense.rushYards + candidate.offense.rushTDs * 20 : null;
    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'passProduction', label: 'Passing Production', weight: 0.35, rawValue: candidate.offense?.passYards ?? null, normalizedValue: prodPercentile },
      { key: 'passEfficiency', label: 'Passing Efficiency', weight: 0.25, rawValue: offensiveEfficiencyRaw(candidate), normalizedValue: efficiency.get(candidate.playerId) ?? null },
      { key: 'tdProduction', label: 'Touchdown Production', weight: 0.2, rawValue: candidate.offense?.passTDs ?? null, normalizedValue: tds.get(candidate.playerId) ?? null },
      { key: 'rushing', label: 'Rushing Contribution', weight: 0.1, rawValue: rushRaw, normalizedValue: rushing.get(candidate.playerId) ?? null },
      { key: 'ballSecurity', label: 'Ball Security', weight: 0.1, rawValue: ballSecurityRaw(candidate), normalizedValue: ballSecurity.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, candidate.offense?.passYards ?? 0, normalizedScore, prodPercentile, components, missingInputs);
  });
}

const BEST_QB_DEFINITION: AwardDefinition = {
  id: 'bestQuarterback',
  name: 'Best Quarterback',
  description: 'The team’s top quarterback this season.',
  category: 'position',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  retired: true,
  eligiblePositions: ['QB'],
  customEligibility: (candidate, team) => {
    if (team.passAttempts <= 0) return [];
    const share = (candidate.offense?.passAttempts ?? 0) / team.passAttempts;
    if (share < 0.2) {
      return [`Threw ${Math.round(share * 100)}% of the team's pass attempts — below the 20% minimum.`];
    }
    return [];
  },
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeBestQbCandidates,
};

/** Best Offensive Skill Player — normalizes backs (HB/FB) and pass-catchers (WR/TE) as separate subgroups, per the spec's own instruction, since a bellcow back's yards-per-touch and a slot receiver's yards-per-catch aren't comparable raw numbers. */
function computeBestSkillCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('bestOffensiveSkillPlayer')!;
  const groupOf = (c: AwardCandidate) => skillSubgroup(c.position);
  const scrimmageRaw = (c: AwardCandidate) => (c.offense ? c.offense.rushYards + c.offense.receivingYards : null);
  const tdRaw = (c: AwardCandidate) => (c.offense ? c.offense.rushTDs + c.offense.receivingTDs : null);
  const efficiencyRaw = (c: AwardCandidate) => {
    if (!c.offense) return null;
    const touches = skillSubgroup(c.position) === 'backs' ? c.offense.rushAttempts + c.offense.receptions : c.offense.receptions;
    const yards = skillSubgroup(c.position) === 'backs' ? c.offense.rushYards + c.offense.receivingYards : c.offense.receivingYards;
    return touches > 0 ? yards / touches : null;
  };

  const scrimmage = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: scrimmageRaw(c) })));
  const scoring = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: tdRaw(c) })));
  const efficiency = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: efficiencyRaw(c) })));
  const ballSecurity = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: ballSecurityRaw(c) })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const scrimmagePercentile = scrimmage.get(candidate.playerId);
    if (!eligibility.passed || scrimmagePercentile === undefined) return emptyIneligible(candidate, eligibility);

    const teamShare = teamProductionShare(candidate, team);
    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'scrimmage', label: 'Yards From Scrimmage', weight: 0.35, rawValue: scrimmageRaw(candidate), normalizedValue: scrimmagePercentile },
      { key: 'scoring', label: 'Total Touchdowns', weight: 0.25, rawValue: tdRaw(candidate), normalizedValue: scoring.get(candidate.playerId) ?? null },
      { key: 'efficiency', label: 'Efficiency', weight: 0.15, rawValue: efficiencyRaw(candidate), normalizedValue: efficiency.get(candidate.playerId) ?? null },
      { key: 'teamShare', label: 'Share of Team Production', weight: 0.15, rawValue: teamShare, normalizedValue: teamShare },
      { key: 'ballSecurity', label: 'Ball Security', weight: 0.1, rawValue: ballSecurityRaw(candidate), normalizedValue: ballSecurity.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, scrimmageRaw(candidate) ?? 0, normalizedScore, scrimmagePercentile, components, missingInputs);
  });
}

const BEST_SKILL_DEFINITION: AwardDefinition = {
  id: 'bestOffensiveSkillPlayer',
  name: 'Best Offensive Skill Player',
  description: 'The team’s top HB, FB, WR, or TE this season.',
  category: 'position',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligiblePositions: ['HB', 'FB', 'WR', 'TE'],
  customEligibility: (candidate, team) => {
    const group = skillSubgroup(candidate.position);
    if (group === 'backs' && team.rushAttempts > 0) {
      const share = (candidate.offense?.rushAttempts ?? 0) / team.rushAttempts;
      if (share < 0.15) return [`Carried ${Math.round(share * 100)}% of the team's rush attempts — below the 15% minimum.`];
    }
    if (group === 'receivers' && team.receptions > 0) {
      const share = (candidate.offense?.receptions ?? 0) / team.receptions;
      if (share < 0.1) return [`Caught ${Math.round(share * 100)}% of the team's receptions — below the 10% minimum.`];
    }
    return [];
  },
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeBestSkillCandidates,
};

/** Best Defensive Front Player — a single position pool (no subgroup split). Quarterback Hurries doesn't exist anywhere in this save's data model, so it's modeled as a real, always-missing component whose weight is honestly redistributed every time, not silently omitted from the formula's own record. */
function computeBestFrontCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('bestDefensiveFrontPlayer')!;
  const frontGroup = (c: AwardCandidate) => (POSITION_GROUPS[c.position] === 'front7' ? 'front7' : null);
  const totalTacklesRaw = (c: AwardCandidate) => (c.defense ? c.defense.tackles + c.defense.assistedTackles : null);

  const sacks = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: frontGroup(c), rawValue: c.defense?.sacks ?? null })));
  const tfl = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: frontGroup(c), rawValue: c.defense?.tacklesForLoss ?? null })));
  const ff = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: frontGroup(c), rawValue: c.defense?.forcedFumbles ?? null })));
  const tackles = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: frontGroup(c), rawValue: totalTacklesRaw(c) })));
  const scoring = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: frontGroup(c), rawValue: c.defense?.interceptionTDs ?? null })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const sacksPercentile = sacks.get(candidate.playerId);
    if (!eligibility.passed || sacksPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'sacks', label: 'Sacks', weight: 0.3, rawValue: candidate.defense?.sacks ?? null, normalizedValue: sacksPercentile },
      { key: 'tfl', label: 'Tackles for Loss', weight: 0.25, rawValue: candidate.defense?.tacklesForLoss ?? null, normalizedValue: tfl.get(candidate.playerId) ?? null },
      { key: 'forcedFumbles', label: 'Forced Fumbles', weight: 0.15, rawValue: candidate.defense?.forcedFumbles ?? null, normalizedValue: ff.get(candidate.playerId) ?? null },
      { key: 'hurries', label: 'Quarterback Hurries', weight: 0.15, rawValue: null, normalizedValue: null },
      { key: 'tackles', label: 'Total Tackles', weight: 0.1, rawValue: totalTacklesRaw(candidate), normalizedValue: tackles.get(candidate.playerId) ?? null },
      { key: 'scoring', label: 'Defensive Scoring', weight: 0.05, rawValue: candidate.defense?.interceptionTDs ?? null, normalizedValue: scoring.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, candidate.defense?.sacks ?? 0, normalizedScore, sacksPercentile, components, missingInputs);
  });
}

const BEST_FRONT_DEFINITION: AwardDefinition = {
  id: 'bestDefensiveFrontPlayer',
  name: 'Best Defensive Front Player',
  description: 'The team’s top defensive lineman or edge/linebacker.',
  category: 'position',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligiblePositions: ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB'],
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeBestFrontCandidates,
};

/** Best Defensive Back — corners and safeties normalized as separate subgroups per the spec, since safeties naturally rack up more tackles. */
function computeBestBackCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('bestDefensiveBack')!;
  const groupOf = (c: AwardCandidate) => dbSubgroup(c.position);
  const totalTacklesRaw = (c: AwardCandidate) => (c.defense ? c.defense.tackles + c.defense.assistedTackles : null);
  const tflSacksRaw = (c: AwardCandidate) => (c.defense ? c.defense.tacklesForLoss + c.defense.sacks : null);

  const interceptions = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: c.defense?.interceptions ?? null })));
  const deflections = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: c.defense?.passDeflections ?? null })));
  const ff = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: c.defense?.forcedFumbles ?? null })));
  const scoring = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: c.defense?.interceptionTDs ?? null })));
  const tackles = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: totalTacklesRaw(c) })));
  const tflSacks = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: tflSacksRaw(c) })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const intPercentile = interceptions.get(candidate.playerId);
    if (!eligibility.passed || intPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'interceptions', label: 'Interceptions', weight: 0.3, rawValue: candidate.defense?.interceptions ?? null, normalizedValue: intPercentile },
      { key: 'deflections', label: 'Pass Deflections', weight: 0.2, rawValue: candidate.defense?.passDeflections ?? null, normalizedValue: deflections.get(candidate.playerId) ?? null },
      { key: 'forcedFumbles', label: 'Forced Fumbles', weight: 0.15, rawValue: candidate.defense?.forcedFumbles ?? null, normalizedValue: ff.get(candidate.playerId) ?? null },
      { key: 'scoring', label: 'Defensive Touchdowns', weight: 0.15, rawValue: candidate.defense?.interceptionTDs ?? null, normalizedValue: scoring.get(candidate.playerId) ?? null },
      { key: 'tackles', label: 'Tackles', weight: 0.1, rawValue: totalTacklesRaw(candidate), normalizedValue: tackles.get(candidate.playerId) ?? null },
      { key: 'tflSacks', label: 'Tackles for Loss and Sacks', weight: 0.1, rawValue: tflSacksRaw(candidate), normalizedValue: tflSacks.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, candidate.defense?.interceptions ?? 0, normalizedScore, intPercentile, components, missingInputs);
  });
}

const BEST_BACK_DEFINITION: AwardDefinition = {
  id: 'bestDefensiveBack',
  name: 'Best Defensive Back',
  description: 'The team’s top cornerback or safety.',
  category: 'position',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligiblePositions: ['CB', 'SS', 'FS'],
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeBestBackCandidates,
};

/**
 * Freshman of the Year. True-freshman only for now — the eligibility
 * setting to also include redshirt freshmen is deferred until
 * RosterPlayer.redshirtStatus's real value set is verified against a real
 * save (it's currently just a raw, unparsed free-text field). Reuses the
 * same position-adjusted production score as MVP so a freshman's output is
 * judged against the same real production measure, not a separate
 * fabricated one.
 */
function computeFreshmanCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('freshmanOfTheYear')!;
  const groupOf = (c: AwardCandidate) => POSITION_GROUPS[c.position] ?? null;

  const production = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: productionRawScore(c) })));
  const participation = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: gamesPlayedFor(c) || null })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const prodPercentile = production.get(candidate.playerId);
    if (!eligibility.passed || prodPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'production', label: 'Position-Adjusted Performance', weight: 0.85, rawValue: productionRawScore(candidate), normalizedValue: prodPercentile },
      { key: 'participation', label: 'Participation', weight: 0.15, rawValue: gamesPlayedFor(candidate), normalizedValue: participation.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, productionRawScore(candidate) ?? 0, normalizedScore, prodPercentile, components, missingInputs);
  });
}

const FRESHMAN_DEFINITION: AwardDefinition = {
  id: 'freshmanOfTheYear',
  name: 'Freshman of the Year',
  description: 'The best true-freshman performer this season.',
  category: 'major',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  eligibleClasses: ['Freshman'],
  customEligibility: (candidate, team) => {
    const played = gamesPlayedFor(candidate);
    const started = candidate.offense?.gamesStarted ?? candidate.defense?.gamesStarted ?? 0;
    const raw = productionRawScore(candidate);
    const meetsParticipation = team.gamesPlayed === 0 || played >= 0.25 * team.gamesPlayed;
    const meetsStart = started >= 1;
    const meetsProduction = raw !== null && raw > 0;
    if (!meetsParticipation && !meetsStart && !meetsProduction) {
      return ['Did not meet the 25% participation threshold, has no starts, and has no meaningful recorded production.'];
    }
    return [];
  },
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeFreshmanCandidates,
};

function emptyIneligible(candidate: AwardCandidate, eligibility: { passed: boolean; reasons: string[] }): CandidateScoreResult {
  return {
    playerId: candidate.playerId,
    rawScore: 0,
    normalizedScore: 0,
    positionPercentile: null,
    eligibilityPassed: false,
    eligibilityReasons: eligibility.passed ? ['No position-adjusted production score available.'] : eligibility.reasons,
    components: [],
    missingInputs: [],
  };
}

function scoredCandidate(
  candidate: AwardCandidate,
  rawScore: number,
  normalizedScore: number,
  positionPercentile: number,
  components: CandidateScoreResult['components'],
  missingInputs: string[],
): CandidateScoreResult {
  return {
    playerId: candidate.playerId,
    rawScore,
    normalizedScore,
    positionPercentile,
    eligibilityPassed: true,
    eligibilityReasons: [],
    components,
    missingInputs,
  };
}

/**
 * Special Teams Player of the Year — the first award comparing candidates
 * across three genuinely different roles (kicker, punter, returner) rather
 * than positions within one side of the ball. specialTeamsGroup assigns each
 * candidate to its real role (return duty checked by actual production, not
 * a position list — see formulas.ts), and every component is percentiled
 * within that role's own group before the two roll up into one comparable
 * score, the same subgroup mechanism cb/safety and backs/receivers already
 * use elsewhere in this file.
 */
function computeSpecialTeamsCandidates(candidates: AwardCandidate[], team: AwardTeamContext): CandidateScoreResult[] {
  const def = getAwardDefinition('specialTeamsPlayerOfTheYear')!;
  const groupOf = (c: AwardCandidate) => specialTeamsGroup(c);

  const production = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: specialTeamsProductionRaw(c) })));
  const efficiency = percentileByGroup(candidates.map((c) => ({ playerId: c.playerId, groupKey: groupOf(c), rawValue: specialTeamsEfficiencyRaw(c) })));

  return candidates.map((candidate) => {
    const eligibility = checkEligibility(def, candidate, team);
    const prodPercentile = production.get(candidate.playerId);
    if (!eligibility.passed || prodPercentile === undefined) return emptyIneligible(candidate, eligibility);

    const { normalizedScore, components, missingInputs } = buildWeightedScore([
      { key: 'production', label: 'Production', weight: 0.65, rawValue: specialTeamsProductionRaw(candidate), normalizedValue: prodPercentile },
      { key: 'efficiency', label: 'Efficiency', weight: 0.35, rawValue: specialTeamsEfficiencyRaw(candidate), normalizedValue: efficiency.get(candidate.playerId) ?? null },
    ]);

    return scoredCandidate(candidate, specialTeamsProductionRaw(candidate) ?? 0, normalizedScore, prodPercentile, components, missingInputs);
  });
}

const SPECIAL_TEAMS_DEFINITION: AwardDefinition = {
  id: 'specialTeamsPlayerOfTheYear',
  name: 'Special Teams Player of the Year',
  description: 'The best kicker, punter, or return specialist — compared within their own role, then on one combined scale.',
  category: 'specialTeams',
  calculationMode: 'automaticWithConfirmation',
  enabled: true,
  customEligibility: (candidate) => {
    if (specialTeamsGroup(candidate) === null) {
      return ['Not a kicker or punter with recorded stats, and no real kick/punt return production this season.'];
    }
    return [];
  },
  minimumGamesPlayedFraction: 0.25,
  finalistCount: 3,
  calculationVersion: TEAM_AWARDS_VERSION,
  computeCandidates: computeSpecialTeamsCandidates,
};

/**
 * 11 of the spec's original 12 awards — Breakout Player of the Year was
 * removed from scope entirely (2026-07-19, explicit user decision), not just
 * left disabled. 10 of those 11 are enabled as of Phase 4 (2026-07-19,
 * Special Teams Player of the Year shipped); only Single-Game Performance of
 * the Year remains disabled, with a stated reason, so the full scope stays
 * honest and visible rather than silently introduced later.
 */
export const AWARD_DEFINITIONS: AwardDefinition[] = [
  MVP_DEFINITION,
  OFFENSIVE_POY_DEFINITION,
  DEFENSIVE_POY_DEFINITION,
  SPECIAL_TEAMS_DEFINITION,
  FRESHMAN_DEFINITION,
  NEWCOMER_DEFINITION,
  BEST_QB_DEFINITION,
  BEST_SKILL_DEFINITION,
  BEST_FRONT_DEFINITION,
  BEST_BACK_DEFINITION,
  {
    // Phase 5 (2026-07-19): enabled once the gamelog-to-schedule join shipped
    // (GameDetail's per-game box score work). Calculated by the dedicated
    // per-game path in teamAwards/singleGame.ts, NOT the generic component
    // engine — no computeCandidates here on purpose; runTeamAwardCalculation
    // branches on this id. Ranked-opponent bonus permanently dropped (no
    // historical opponent-rank data exists in the save — Phase 1 research).
    id: 'singleGamePerformanceOfTheYear',
    name: 'Single-Game Performance of the Year',
    description: "The single best individual game performance by a player on the team this season.",
    category: 'story',
    calculationMode: 'automaticWithConfirmation',
    enabled: true,
    finalistCount: 3,
    calculationVersion: TEAM_AWARDS_VERSION,
  },
];

export function getAwardDefinition(id: string): AwardDefinition | undefined {
  return AWARD_DEFINITIONS.find((def) => def.id === id);
}

export { gamesPlayedFor };
