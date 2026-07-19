import { percentileRank, safeRatio } from './normalization';
import type { AwardCandidate, AwardTeamContext } from './types';

/**
 * Shared position groupings used by every cross-position award (MVP,
 * Offensive/Defensive POY, Freshman of the Year, Defensive Front/Back).
 * O-line (LT/LG/C/RG/RT) has no offensive counting stats, so it's
 * deliberately absent — not because it's unimportant, there's just nothing
 * real to score it by. K/P are absent because kicking stats aren't
 * extracted yet (Phase 4).
 */
export const POSITION_GROUPS: Record<string, string> = {
  QB: 'qb',
  HB: 'backs',
  FB: 'backs',
  WR: 'receivers',
  TE: 'receivers',
  LE: 'front7',
  RE: 'front7',
  DT: 'front7',
  LOLB: 'front7',
  MLB: 'front7',
  ROLB: 'front7',
  CB: 'secondary',
  SS: 'secondary',
  FS: 'secondary',
};

/** Sub-split of the defensive-back group specifically — corners and safeties are kept separate per the spec ("safeties naturally record more tackles"), distinct from the front7/secondary split used elsewhere. */
export function dbSubgroup(position: string): string | null {
  if (position === 'CB') return 'cb';
  if (position === 'SS' || position === 'FS') return 'safety';
  return null;
}

/** Sub-split of the offensive skill group — backs (HB/FB) vs. pass-catchers (WR/TE), used where the spec calls for normalizing them separately (e.g. yards-per-touch vs. yards-per-catch efficiency). */
export function skillSubgroup(position: string): string | null {
  if (position === 'HB' || position === 'FB') return 'backs';
  if (position === 'WR' || position === 'TE') return 'receivers';
  return null;
}

/** A single position-appropriate production score — the same "how much did this player produce" measure MVP pioneered, reused everywhere a cross-position or within-group percentile is needed. Null when the position has no real scorable stat (O-line, K/P) or the player has no matching stat category. */
export function productionRawScore(candidate: AwardCandidate): number | null {
  const group = POSITION_GROUPS[candidate.position];
  if (!group) return null;

  if (group === 'qb' && candidate.offense) {
    const o = candidate.offense;
    return o.passYards / 25 + o.passTDs * 6 + o.rushYards / 10 + o.rushTDs * 6 - o.passInts * 4;
  }
  if ((group === 'backs' || group === 'receivers') && candidate.offense) {
    const o = candidate.offense;
    return o.rushYards / 10 + o.rushTDs * 6 + o.receivingYards / 10 + o.receivingTDs * 6;
  }
  if ((group === 'front7' || group === 'secondary') && candidate.defense) {
    const d = candidate.defense;
    return (
      d.tackles * 1.0 +
      d.assistedTackles * 0.5 +
      d.tacklesForLoss * 2.0 +
      d.sacks * 4.0 +
      d.interceptions * 5.0 +
      d.forcedFumbles * 4.0 +
      d.fumbleRecoveries * 3.0 +
      d.passDeflections * 1.5 +
      d.interceptionTDs * 8.0
    );
  }
  return null;
}

/** Role-specific share of team production, scaled 0-100 to sit alongside percentile-scored components. Null (a real missing input) rather than 0 when the team hasn't recorded any games yet. */
export function teamProductionShare(candidate: AwardCandidate, team: AwardTeamContext): number | null {
  const group = POSITION_GROUPS[candidate.position];

  if (group === 'qb' && candidate.offense) {
    const o = candidate.offense;
    const yardShare = safeRatio(o.passYards, team.offPassYards);
    const tdShare = safeRatio(o.passTDs + o.rushTDs, team.passTds + team.rushTds);
    const parts = [yardShare, tdShare].filter((v): v is number => v !== null);
    return parts.length > 0 ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
  }
  if ((group === 'backs' || group === 'receivers') && candidate.offense) {
    const o = candidate.offense;
    const yardShare = safeRatio(o.rushYards + o.receivingYards, team.offRushYards + team.offPassYards);
    const tdShare = safeRatio(o.rushTDs + o.receivingTDs, team.rushTds + team.passTds);
    const parts = [yardShare, tdShare].filter((v): v is number => v !== null);
    return parts.length > 0 ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
  }
  if ((group === 'front7' || group === 'secondary') && candidate.defense) {
    const d = candidate.defense;
    const sackShare = safeRatio(d.sacks, team.sacks);
    const takeawayShare = safeRatio(d.interceptions + d.forcedFumbles + d.fumbleRecoveries, team.takeaways);
    const deflectionShare = safeRatio(d.passDeflections, team.passDeflections);
    const parts = [sackShare, takeawayShare, deflectionShare].filter((v): v is number => v !== null);
    return parts.length > 0 ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
  }
  return null;
}

/** Ball Security raw value — negative fumble count, so a higher (less negative) value is always better within percentileByGroup. Real field (RUSHFUMBLES); covers rushing-play fumbles only (see OffensiveStatLine.fumbles doc comment) — never fabricated as a generic "fumbles lost" figure. */
export function ballSecurityRaw(candidate: AwardCandidate): number | null {
  if (!candidate.offense) return null;
  return -candidate.offense.fumbles;
}

/**
 * Special Teams Player of the Year compares three genuinely different roles
 * on one award — kickers, punters, and kick/punt return specialists — each
 * scored on its own real stat line and then percentile-ranked *within its own
 * group* (same mechanism as cb/safety or backs/receivers elsewhere in this
 * file), so a great punter and a great kicker land on the same 0-100 scale
 * without ever comparing raw yards to raw made-field-goals directly. Return
 * duty isn't tied to a position — any offense/defense player can carry it
 * (see OffensiveStatLine.kickReturns doc comment) — so group assignment
 * checks real production, not a position list.
 */
export function specialTeamsGroup(candidate: AwardCandidate): string | null {
  if (candidate.position === 'K' && candidate.kicking) return 'kicker';
  if (candidate.position === 'P' && candidate.kicking) return 'punter';
  const line = candidate.offense ?? candidate.defense;
  if (line && (line.kickReturns > 0 || line.puntReturns > 0)) return 'returner';
  return null;
}

/** Production raw score — real counting stats only, no fabricated "return TD" bonus beyond what's actually recorded. */
export function specialTeamsProductionRaw(candidate: AwardCandidate): number | null {
  const group = specialTeamsGroup(candidate);
  if (group === 'kicker' && candidate.kicking) {
    const k = candidate.kicking;
    return k.fgMade * 3 + k.xpMade * 1 + (k.fgLongest >= 50 ? 2 : 0);
  }
  if (group === 'punter' && candidate.kicking) {
    const k = candidate.kicking;
    return k.puntNetYards / 20 + k.puntIn20 * 1.5 - k.puntTouchbacks * 0.5;
  }
  if (group === 'returner') {
    const line = candidate.offense ?? candidate.defense;
    if (!line) return null;
    return line.kickReturnYards / 15 + line.puntReturnYards / 15 + (line.kickReturnTDs + line.puntReturnTDs) * 6;
  }
  return null;
}

/** Efficiency raw score — the "how good, not just how much" half of the formula, still scoped to the candidate's own group. */
export function specialTeamsEfficiencyRaw(candidate: AwardCandidate): number | null {
  const group = specialTeamsGroup(candidate);
  if (group === 'kicker' && candidate.kicking) {
    const k = candidate.kicking;
    const makeRate = safeRatio(k.fgMade + k.xpMade, k.fgAttempts + k.xpAttempts);
    return makeRate === null ? null : makeRate * 100;
  }
  if (group === 'punter' && candidate.kicking) {
    const k = candidate.kicking;
    return safeRatio(k.puntNetYards, k.puntAttempts);
  }
  if (group === 'returner') {
    const line = candidate.offense ?? candidate.defense;
    if (!line) return null;
    return safeRatio(line.kickReturnYards + line.puntReturnYards, line.kickReturns + line.puntReturns);
  }
  return null;
}

/**
 * Percentile-ranks a raw value within whatever subgroup each candidate
 * belongs to (e.g. position group, or a finer subgroup like backs/receivers
 * or cb/safety) — the generic version of the group-percentile pattern MVP
 * introduced, reused by every award that needs cross-position or
 * within-role normalization.
 */
export function percentileByGroup(
  candidates: { playerId: number; groupKey: string | null; rawValue: number | null }[],
): Map<number, number> {
  const groups = new Map<string, number[]>();
  for (const c of candidates) {
    if (c.groupKey === null || c.rawValue === null) continue;
    groups.set(c.groupKey, [...(groups.get(c.groupKey) ?? []), c.rawValue]);
  }
  const result = new Map<number, number>();
  for (const c of candidates) {
    if (c.groupKey === null || c.rawValue === null) continue;
    result.set(c.playerId, percentileRank(c.rawValue, groups.get(c.groupKey) ?? [c.rawValue]));
  }
  return result;
}
