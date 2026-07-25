import type { TeamGameStat } from '../../shared/types';

/**
 * The Statistics page's shared filter + aggregation layer (Phase 1). Both the
 * Team Stats and Player Stats views derive from ONE filtered game set so their
 * numbers can never disagree. Aggregation is ratio-correct: countable stats are
 * summed and ratios (3rd-down %, etc.) are computed from summed conversions ÷
 * summed attempts — never by averaging per-game percentages.
 *
 * Season-only stats (red-zone %, return yards, completion %) are NOT here —
 * they have no per-game source (see Phase 0 findings / TeamStats).
 */

export type TeamGameTypeFilter = 'all' | 'conference' | 'non-conference' | 'bowl' | 'home' | 'away' | 'neutral';

export interface TeamStatFilter {
  gameType: TeamGameTypeFilter;
  /** Opponent display name, or 'all'. */
  opponent: string;
}

/** The played games matching the current filter — the single source of truth. */
export function filterTeamGames(games: TeamGameStat[], filter: TeamStatFilter): TeamGameStat[] {
  return games.filter((g) => {
    if (!g.played) return false;
    if (filter.opponent !== 'all' && g.opponent !== filter.opponent) return false;
    switch (filter.gameType) {
      case 'all':
        return true;
      case 'conference':
      case 'non-conference':
      case 'bowl':
        return g.gameType === filter.gameType;
      case 'home':
      case 'away':
      case 'neutral':
        return g.siteType === filter.gameType;
      default:
        return true;
    }
  });
}

/** Summed team + opponent (defense) totals over a filtered game set. Ratios are computed by the view from the conv/att pairs. */
export interface TeamAggregate {
  games: number;
  points: number;
  pointsAllowed: number;
  totalYards: number;
  passYards: number;
  rushYards: number;
  defTotalYards: number;
  defPassYards: number;
  defRushYards: number;
  firstDowns: number;
  thirdDownConv: number;
  thirdDownAtt: number;
  fourthDownConv: number;
  fourthDownAtt: number;
  /** Opponent 3rd-down (i.e. "3rd-down allowed") — available per-game via opponentStats. */
  defThirdDownConv: number;
  defThirdDownAtt: number;
  giveaways: number;
  takeaways: number;
  sacks: number;
  sacksAllowed: number;
  penalties: number;
  penaltyYards: number;
  possessionSeconds: number;
  punts: number;
  puntYards: number;
}

function emptyAggregate(): TeamAggregate {
  return {
    games: 0, points: 0, pointsAllowed: 0,
    totalYards: 0, passYards: 0, rushYards: 0,
    defTotalYards: 0, defPassYards: 0, defRushYards: 0,
    firstDowns: 0, thirdDownConv: 0, thirdDownAtt: 0, fourthDownConv: 0, fourthDownAtt: 0,
    defThirdDownConv: 0, defThirdDownAtt: 0,
    giveaways: 0, takeaways: 0, sacks: 0, sacksAllowed: 0,
    penalties: 0, penaltyYards: 0, possessionSeconds: 0, punts: 0, puntYards: 0,
  };
}

export function aggregateTeamGames(games: TeamGameStat[]): TeamAggregate {
  return games.reduce<TeamAggregate>((a, g) => {
    a.games += 1;
    a.points += g.teamScore ?? 0;
    a.pointsAllowed += g.opponentScore ?? 0;
    const t = g.teamStats;
    if (t) {
      a.totalYards += t.totalYards;
      a.passYards += t.passYards;
      a.rushYards += t.rushYards;
      a.firstDowns += t.firstDowns;
      a.thirdDownConv += t.thirdDownConversions;
      a.thirdDownAtt += t.thirdDownAttempts;
      a.fourthDownConv += t.fourthDownConversions;
      a.fourthDownAtt += t.fourthDownAttempts;
      a.giveaways += t.turnovers;
      a.takeaways += t.takeaways;
      a.sacks += t.sacks;
      a.sacksAllowed += t.sacksAllowed;
      a.penalties += t.penalties;
      a.penaltyYards += t.penaltyYards;
      a.possessionSeconds += t.possessionTimeSeconds;
      a.punts += t.punts;
      a.puntYards += t.puntYards;
    }
    const o = g.opponentStats;
    if (o) {
      a.defTotalYards += o.totalYards;
      a.defPassYards += o.passYards;
      a.defRushYards += o.rushYards;
      a.defThirdDownConv += o.thirdDownConversions;
      a.defThirdDownAtt += o.thirdDownAttempts;
    }
    return a;
  }, emptyAggregate());
}

/** Distinct opponents actually played (for the opponent filter list). */
export function opponentOptions(games: TeamGameStat[]): string[] {
  return [...new Set(games.filter((g) => g.played).map((g) => g.opponent))].sort((a, b) => a.localeCompare(b));
}

/** Only the game-type/site buckets that actually occur this season — never fabricated. */
export function availableGameTypes(games: TeamGameStat[]): { value: TeamGameTypeFilter; label: string }[] {
  const played = games.filter((g) => g.played);
  const has = (pred: (g: TeamGameStat) => boolean) => played.some(pred);
  const options: { value: TeamGameTypeFilter; label: string }[] = [{ value: 'all', label: 'All games' }];
  if (has((g) => g.gameType === 'conference')) options.push({ value: 'conference', label: 'Conference' });
  if (has((g) => g.gameType === 'non-conference')) options.push({ value: 'non-conference', label: 'Non-conference' });
  if (has((g) => g.gameType === 'bowl')) options.push({ value: 'bowl', label: 'Bowl / Playoff' });
  if (has((g) => g.siteType === 'home')) options.push({ value: 'home', label: 'Home' });
  if (has((g) => g.siteType === 'away')) options.push({ value: 'away', label: 'Away' });
  if (has((g) => g.siteType === 'neutral')) options.push({ value: 'neutral', label: 'Neutral site' });
  return options;
}

// ── Derivations the views use (kept pure so total/per-game formatting lives in one place) ──

/** A ratio as a percentage, or null when there were no attempts (→ show "—", not 0%). */
export function ratioPct(made: number, attempts: number): number | null {
  return attempts > 0 ? (100 * made) / attempts : null;
}

/** A countable total divided by games (per-game average), or 0 when no games. */
export function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

export function turnoverMargin(a: TeamAggregate): number {
  return a.takeaways - a.giveaways;
}
