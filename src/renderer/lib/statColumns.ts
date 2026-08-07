import type { ColumnDef } from '../components/common/StatisticsCategorySection';
import { passerRating } from '../../shared/passerRating';
import type { DefensiveStatLine, KickingStatLine, OffensiveStatLine } from '../../shared/types';

/**
 * The per-category stat-table column definitions, shared by the Team Hub
 * Statistics page and the NCAA Hub national leaderboards so both render the
 * identical columns/formatting from one source. A `perGame: true` column is
 * divided by games played in Per-Game mode (see withMode in
 * StatisticsCategorySection); rates/longest/GP are left as-is.
 */
export function pct(made: number, attempted: number): number | null {
  return attempted > 0 ? (made / attempted) * 100 : null;
}

export const pctFormat = (value: number) => `${value.toFixed(1)}%`;
export const oneDecimal = (value: number) => value.toFixed(1);

export const PASSING_COLUMNS: ColumnDef<OffensiveStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'passCompletions', label: 'Cmp', raw: (l) => l.passCompletions, perGame: true },
  { key: 'passAttempts', label: 'Att', raw: (l) => l.passAttempts, perGame: true },
  { key: 'passCompletionPct', label: 'Cmp%', raw: (l) => pct(l.passCompletions, l.passAttempts), format: pctFormat },
  { key: 'passYards', label: 'Yds', raw: (l) => l.passYards, perGame: true },
  {
    key: 'passYardsPerAttempt',
    label: 'Y/A',
    raw: (l) => (l.passAttempts > 0 ? l.passYards / l.passAttempts : null),
    format: oneDecimal,
  },
  { key: 'passTDs', label: 'TD', raw: (l) => l.passTDs, perGame: true },
  { key: 'passInts', label: 'Int', raw: (l) => l.passInts, perGame: true },
  { key: 'passLongest', label: 'Lng', raw: (l) => l.passLongest },
  /*
    NCAA passer rating, derived (see shared/passerRating.ts — the save stores no
    such field). Last, the way a college box score prints it: it is the summary
    of every column left of it, so it reads as the conclusion rather than as one
    more counting stat.

    NO `perGame`. It is already a rate — dividing it by games played would
    produce a number that means nothing at all. `raw` returning null for a
    player with no attempts is exactly what the column machinery wants; nobody
    gets a rating for passes they never threw.
  */
  { key: 'passerRating', label: 'Rtg', raw: (l) => passerRating(l), format: oneDecimal },
];

export const RUSHING_COLUMNS: ColumnDef<OffensiveStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'rushAttempts', label: 'Att', raw: (l) => l.rushAttempts, perGame: true },
  { key: 'rushYards', label: 'Yds', raw: (l) => l.rushYards, perGame: true },
  {
    key: 'rushYardsPerCarry',
    label: 'Y/C',
    raw: (l) => (l.rushAttempts > 0 ? l.rushYards / l.rushAttempts : null),
    format: oneDecimal,
  },
  { key: 'rushTDs', label: 'TD', raw: (l) => l.rushTDs, perGame: true },
  { key: 'rushLongest', label: 'Lng', raw: (l) => l.rushLongest },
];

export const RECEIVING_COLUMNS: ColumnDef<OffensiveStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'receptions', label: 'Rec', raw: (l) => l.receptions, perGame: true },
  { key: 'receivingYards', label: 'Yds', raw: (l) => l.receivingYards, perGame: true },
  {
    key: 'receivingYardsPerCatch',
    label: 'Y/R',
    raw: (l) => (l.receptions > 0 ? l.receivingYards / l.receptions : null),
    format: oneDecimal,
  },
  { key: 'receivingTDs', label: 'TD', raw: (l) => l.receivingTDs, perGame: true },
  { key: 'receivingLongest', label: 'Lng', raw: (l) => l.receivingLongest },
];

export const KICKING_COLUMNS: ColumnDef<KickingStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'fgMade', label: 'FGM', raw: (l) => l.fgMade, perGame: true },
  { key: 'fgAttempts', label: 'FGA', raw: (l) => l.fgAttempts, perGame: true },
  { key: 'fgPct', label: 'FG%', raw: (l) => pct(l.fgMade, l.fgAttempts), format: pctFormat },
  { key: 'fgLongest', label: 'Lng', raw: (l) => l.fgLongest },
  { key: 'xpMade', label: 'XPM', raw: (l) => l.xpMade, perGame: true },
  { key: 'xpAttempts', label: 'XPA', raw: (l) => l.xpAttempts, perGame: true },
  { key: 'xpPct', label: 'XP%', raw: (l) => pct(l.xpMade, l.xpAttempts), format: pctFormat },
];

export const PUNTING_COLUMNS: ColumnDef<KickingStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'puntAttempts', label: 'Punts', raw: (l) => l.puntAttempts, perGame: true },
  { key: 'puntYards', label: 'Yds', raw: (l) => l.puntYards, perGame: true },
  {
    key: 'puntAvg',
    label: 'Avg',
    raw: (l) => (l.puntAttempts > 0 ? l.puntYards / l.puntAttempts : null),
    format: oneDecimal,
  },
  { key: 'puntNetYards', label: 'Net Yds', raw: (l) => l.puntNetYards, perGame: true },
  { key: 'puntLongest', label: 'Lng', raw: (l) => l.puntLongest },
  { key: 'puntIn20', label: 'In 20', raw: (l) => l.puntIn20, perGame: true },
];

export const DEFENSE_COLUMNS: ColumnDef<DefensiveStatLine>[] = [
  { key: 'gamesPlayed', label: 'GP', raw: (l) => l.gamesPlayed },
  { key: 'tackles', label: 'Tkl', raw: (l) => l.tackles, perGame: true },
  { key: 'assistedTackles', label: 'Ast', raw: (l) => l.assistedTackles, perGame: true },
  { key: 'tacklesForLoss', label: 'TFL', raw: (l) => l.tacklesForLoss, perGame: true },
  { key: 'sacks', label: 'Sck', raw: (l) => l.sacks, perGame: true, format: oneDecimal },
  { key: 'interceptions', label: 'Int', raw: (l) => l.interceptions, perGame: true },
  { key: 'interceptionReturnYards', label: 'IntYds', raw: (l) => l.interceptionReturnYards },
  { key: 'passDeflections', label: 'PD', raw: (l) => l.passDeflections, perGame: true },
  { key: 'forcedFumbles', label: 'FF', raw: (l) => l.forcedFumbles, perGame: true },
  { key: 'fumbleRecoveries', label: 'FR', raw: (l) => l.fumbleRecoveries, perGame: true },
];
