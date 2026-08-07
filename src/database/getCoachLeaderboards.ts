import { getSnapshot } from './helpers';
import { activeCoachId, coachSeasons } from './hallOfLegends';
import type {
  PlayerStatsData,
  OffensiveStatLine,
  DefensiveStatLine,
  OLineStatLine,
} from '../extractors/extract-stats';
import type { RosterPlayerData } from '../extractors/extract-roster';
import type { CoachLeaderboards, CoachLeaderboard, CoachLeaderboardRow } from '../shared/types';

/**
 * TOP 25 IN EVERY CATEGORY, over a career under this coach.
 *
 * Each player's seasons are folded into ONE line first, then ranked — so a
 * four-year starter appears once with four years added together, not four
 * times. That is what makes these boards a shortlist of *players* rather than
 * of seasons, which is what the Hall wants from them.
 *
 * Built from SEASON lines for the same reason getCoachStatistics is: a career
 * line carries years under other coaches at other schools, and crediting those
 * here would rank someone for football this coach never saw.
 *
 * A player is identified by PresentationId, which is stable across seasons, so
 * folding is just a keyed sum. Name and position come from the LAST season he
 * appears in — players change position and get renamed, and the most recent
 * reading is the one that matches how the user thinks of him now.
 */

const TOP_N = 25;

/**
 * Rate stats need a floor or they are meaningless: a backup who threw one
 * completion sits at 100% above every real quarterback. 150 attempts over a
 * career under one coach is roughly a season and a half of starting — enough
 * that the number describes a passer rather than an accident.
 */
const MIN_ATTEMPTS_FOR_RATE = 150;

interface Folded {
  playerId: number;
  name: string;
  position: string | null;
  firstSeason: number;
  lastSeason: number;
  seasons: number;
  off: OffensiveStatLine | null;
  def: DefensiveStatLine | null;
  ol: OLineStatLine | null;
}

type AnyLine = OffensiveStatLine | DefensiveStatLine | OLineStatLine;

function isOffense(line: AnyLine): line is OffensiveStatLine {
  return 'passYards' in line;
}
function isOLine(line: AnyLine): line is OLineStatLine {
  return 'pancakes' in line;
}

/**
 * Adds every numeric field of `from` into `into`, creating it on first sight.
 *
 * Cast internally rather than constraining T to Record<string, number>: the
 * stat-line interfaces are all-number but carry no index signature, and adding
 * one to them would weaken every other use. The cast is contained here, and the
 * shapes really are flat number maps — nothing nested to get wrong.
 */
function accumulate<T extends object>(into: T | null, from: T): T {
  if (!into) return { ...from };
  const out = { ...into } as Record<string, number>;
  const src = from as unknown as Record<string, number>;
  for (const key of Object.keys(src)) out[key] = (out[key] ?? 0) + src[key];
  return out as unknown as T;
}

/** One board. `value` is what ranks; `detail` is the context line under the number. */
interface Spec {
  key: string;
  label: string;
  unit: string;
  value: (p: Folded) => number;
  detail?: (p: Folded) => string | null;
  /** Rate stats rank only among players who cleared the floor. */
  eligible?: (p: Folded) => boolean;
}

const SPECS: Spec[] = [
  { key: 'passYards', label: 'Passing Yards', unit: 'yds', value: (p) => p.off?.passYards ?? 0,
    detail: (p) => (p.off ? `${p.off.passTDs} TD · ${p.off.passInts} INT` : null) },
  { key: 'passTDs', label: 'Passing Touchdowns', unit: '', value: (p) => p.off?.passTDs ?? 0,
    detail: (p) => (p.off ? `${p.off.passYards.toLocaleString()} yds` : null) },
  {
    key: 'passPct', label: 'Completion %', unit: '%',
    value: (p) => (p.off && p.off.passAttempts > 0 ? (p.off.passCompletions / p.off.passAttempts) * 100 : 0),
    detail: (p) => (p.off ? `${p.off.passCompletions} of ${p.off.passAttempts}` : null),
    eligible: (p) => (p.off?.passAttempts ?? 0) >= MIN_ATTEMPTS_FOR_RATE,
  },
  { key: 'rushYards', label: 'Rushing Yards', unit: 'yds', value: (p) => p.off?.rushYards ?? 0,
    detail: (p) => (p.off && p.off.rushAttempts > 0 ? `${(p.off.rushYards / p.off.rushAttempts).toFixed(1)} per carry` : null) },
  { key: 'rushAttempts', label: 'Rushing Attempts', unit: '', value: (p) => p.off?.rushAttempts ?? 0,
    detail: (p) => (p.off ? `${p.off.rushYards.toLocaleString()} yds` : null) },
  { key: 'rushTDs', label: 'Rushing Touchdowns', unit: '', value: (p) => p.off?.rushTDs ?? 0,
    detail: (p) => (p.off ? `${p.off.rushYards.toLocaleString()} yds` : null) },
  { key: 'receptions', label: 'Receptions', unit: '', value: (p) => p.off?.receptions ?? 0,
    detail: (p) => (p.off ? `${p.off.receivingYards.toLocaleString()} yds` : null) },
  { key: 'receivingYards', label: 'Receiving Yards', unit: 'yds', value: (p) => p.off?.receivingYards ?? 0,
    detail: (p) => (p.off ? `${p.off.receptions} rec · ${p.off.receivingTDs} TD` : null) },
  { key: 'receivingTDs', label: 'Receiving Touchdowns', unit: '', value: (p) => p.off?.receivingTDs ?? 0,
    detail: (p) => (p.off ? `${p.off.receivingYards.toLocaleString()} yds` : null) },
  /*
    Pancakes are ranked but sacks allowed rides alongside, because the game
    credits pancakes sparingly — measured on a real roster, the leader had 2
    across 19 games while sacks allowed ranged 1 to 18. Ranking on pancakes
    alone would be a board of ties; the second number is what separates them.
  */
  { key: 'pancakes', label: 'Pancakes', unit: '', value: (p) => p.ol?.pancakes ?? 0,
    detail: (p) => (p.ol ? `${p.ol.sacksAllowed} sacks allowed · ${p.ol.gamesStarted} starts` : null) },
  { key: 'sacks', label: 'Sacks', unit: '', value: (p) => p.def?.sacks ?? 0,
    detail: (p) => (p.def ? `${p.def.tacklesForLoss} TFL` : null) },
  { key: 'tackles', label: 'Tackles', unit: '', value: (p) => p.def?.tackles ?? 0,
    detail: (p) => (p.def ? `${p.def.assistedTackles} assisted` : null) },
  { key: 'interceptions', label: 'Interceptions', unit: '', value: (p) => p.def?.interceptions ?? 0,
    detail: (p) => (p.def ? `${p.def.interceptionReturnYards} return yds` : null) },
  /* Both halves, because a pick-six and a scoop-and-score are the same achievement. */
  /*
    ?? 0 on each half, because a snapshot taken before fumbleTDs was extracted
    has the field missing entirely — and `number + undefined` is NaN, which
    fails the `value > 0` filter and made the whole board disappear rather than
    showing the interception returns it did have. Old archives now show what
    they know and gain the rest on their next sync.
  */
  { key: 'defTDs', label: 'Defensive Touchdowns', unit: '',
    value: (p) => (p.def ? (p.def.interceptionTDs ?? 0) + (p.def.fumbleTDs ?? 0) : 0),
    detail: (p) => (p.def ? `${p.def.interceptionTDs ?? 0} INT · ${p.def.fumbleTDs ?? 0} fumble` : null) },
  /*
    Return duty is tracked on both the offensive and defensive variants — a
    returner is whichever side of the ball he plays on the rest of the time —
    so both are summed rather than picking one.
  */
  { key: 'returnTDs', label: 'Return Touchdowns', unit: '',
    value: (p) =>
      (p.off ? p.off.kickReturnTDs + p.off.puntReturnTDs : 0) +
      (p.def ? p.def.kickReturnTDs + p.def.puntReturnTDs : 0),
    detail: (p) => {
      const kr = (p.off?.kickReturns ?? 0) + (p.def?.kickReturns ?? 0);
      const pr = (p.off?.puntReturns ?? 0) + (p.def?.puntReturns ?? 0);
      return `${kr} kick · ${pr} punt returns`;
    },
  },
];

export function getCoachLeaderboards(dynastyId: string): CoachLeaderboards | undefined {
  const coachId = activeCoachId(dynastyId);
  if (coachId === null) return undefined;

  const seasons = coachSeasons(dynastyId, coachId);
  if (seasons.length === 0) return undefined;

  const folded = new Map<number, Folded>();
  let counted = 0;

  for (const season of seasons) {
    const stats = getSnapshot<PlayerStatsData[]>(season.seasonId, 'stats');
    if (!stats || stats.length === 0) continue;
    counted++;

    const roster = getSnapshot<RosterPlayerData[]>(season.seasonId, 'roster') ?? [];
    const byId = new Map(roster.map((p) => [p.id, p]));

    for (const entry of stats) {
      if (!entry.season) continue;
      const who = byId.get(entry.playerId);
      const existing = folded.get(entry.playerId);
      const base: Folded = existing ?? {
        playerId: entry.playerId,
        name: 'Unknown player',
        position: null,
        firstSeason: season.seasonYear,
        lastSeason: season.seasonYear,
        seasons: 0,
        off: null,
        def: null,
        ol: null,
      };

      // Newest reading wins for identity — players are renamed and move position.
      if (who) {
        base.name = `${who.firstName} ${who.lastName}`.trim();
        base.position = who.position;
      }
      base.firstSeason = Math.min(base.firstSeason, season.seasonYear);
      base.lastSeason = Math.max(base.lastSeason, season.seasonYear);
      base.seasons += 1;

      const line = entry.season;
      if (isOLine(line)) base.ol = accumulate(base.ol, line);
      else if (isOffense(line)) base.off = accumulate(base.off, line);
      else base.def = accumulate(base.def, line);

      folded.set(entry.playerId, base);
    }
  }

  if (counted === 0) return undefined;

  const players = [...folded.values()];
  const boards: CoachLeaderboard[] = SPECS.map((spec) => {
    const rows: CoachLeaderboardRow[] = players
      .filter((p) => (spec.eligible ? spec.eligible(p) : true))
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.name,
        position: p.position,
        span: p.firstSeason === p.lastSeason ? `${p.firstSeason}` : `${p.firstSeason}–${p.lastSeason}`,
        value: spec.value(p),
        detail: spec.detail?.(p) ?? null,
      }))
      // A zero is "he doesn't do this", not a ranking — a board of 25 players
      // with none of the stat would be noise dressed as a leaderboard.
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);

    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      decimals: spec.key === 'passPct' ? 1 : 0,
      minimumNote: spec.eligible ? `minimum ${MIN_ATTEMPTS_FOR_RATE} attempts` : null,
      rows,
    };
  }).filter((b) => b.rows.length > 0);

  return { coachId, seasonsCounted: counted, boards };
}
