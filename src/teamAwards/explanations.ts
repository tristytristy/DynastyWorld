import type { AwardCandidate } from './types';

function fmt(value: number): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return rounded.toLocaleString();
}

/**
 * Builds a plain-language explanation directly from the candidate's own real
 * season stat line — never a fabricated narrative claim ("great leader",
 * "heart of the team"), per the spec's explicit examples. Position-templated
 * rather than derived from the abstract scoring components, since a
 * candidate's most legible stats (passing yards, sacks, etc.) read far
 * better than citing "Position-Adjusted Performance: 71.4".
 */
export function buildExplanation(candidate: AwardCandidate): string {
  const name = `${candidate.firstName} ${candidate.lastName}`;
  const parts: string[] = [];

  if (candidate.offense) {
    const o = candidate.offense;
    if (o.passAttempts > 0) {
      parts.push(`${fmt(o.passYards)} passing yards`, `${fmt(o.passTDs)} passing touchdowns`);
    }
    if (o.rushAttempts > 0) {
      parts.push(`${fmt(o.rushYards)} rushing yards`);
      if (o.rushTDs > 0) parts.push(`${fmt(o.rushTDs)} rushing touchdowns`);
    }
    if (o.receptions > 0) {
      parts.push(`${fmt(o.receivingYards)} receiving yards`);
      if (o.receivingTDs > 0) parts.push(`${fmt(o.receivingTDs)} receiving touchdowns`);
    }
    if (o.kickReturns > 0) parts.push(`${fmt(o.kickReturnYards)} kick return yards`);
    if (o.puntReturns > 0) parts.push(`${fmt(o.puntReturnYards)} punt return yards`);
  }

  if (candidate.defense) {
    const d = candidate.defense;
    const totalTackles = d.tackles + d.assistedTackles;
    if (totalTackles > 0) parts.push(`${fmt(totalTackles)} tackles`);
    if (d.sacks > 0) parts.push(`${fmt(d.sacks)} sacks`);
    if (d.interceptions > 0) parts.push(`${fmt(d.interceptions)} interceptions`);
    if (d.tacklesForLoss > 0) parts.push(`${fmt(d.tacklesForLoss)} tackles for loss`);
    if (d.kickReturns > 0) parts.push(`${fmt(d.kickReturnYards)} kick return yards`);
    if (d.puntReturns > 0) parts.push(`${fmt(d.puntReturnYards)} punt return yards`);
  }

  if (candidate.kicking) {
    const k = candidate.kicking;
    if (k.fgAttempts > 0) parts.push(`${fmt(k.fgMade)}-of-${fmt(k.fgAttempts)} field goals`);
    if (k.xpAttempts > 0) parts.push(`${fmt(k.xpMade)}-of-${fmt(k.xpAttempts)} extra points`);
    if (k.puntAttempts > 0) parts.push(`${fmt(k.puntYards)} punting yards`);
  }

  if (parts.length === 0) {
    return `${name} ranked highest among eligible candidates on the statistics available this season.`;
  }

  return `Recommended because he posted ${parts.slice(0, 3).join(', ')} this season.`;
}
