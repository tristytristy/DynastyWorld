import { ALL_RATING_FIELDS, RATING_SECTIONS } from '../../../../shared/playerEditorFields';
import type { PlayerEditFields } from '../../../../shared/types';

/**
 * Which ratings actually decide whether a player at this position is good.
 *
 * ONE map, and one only. Overview's Player DNA and the Ratings destination both
 * need "what matters for a corner", and two copies of that judgement would drift
 * the first time somebody decided press coverage mattered more than they'd
 * thought. Keys come from `RATING_SECTIONS` — this file chooses among them, it
 * never invents a label, an abbreviation or a key of its own.
 *
 * The lists are deliberately SHORT. A summary that names eight strengths names
 * none; the point is to answer "what is he" in a glance, and the full grid is
 * one disclosure away for anyone who wants the rest.
 */
const POSITION_RATINGS: Record<string, string[]> = {
  QB: ['thp', 'tas', 'tad', 'tor', 'pac', 'tup', 'bsk', 'awr', 'spd'],
  HB: ['spd', 'acc', 'agi', 'trk', 'btk', 'jkm', 'car', 'bcv', 'cth'],
  FB: ['rbk', 'lbk', 'trk', 'car', 'cth', 'str'],
  WR: ['cth', 'cit', 'srr', 'mrr', 'drr', 'spc', 'rls', 'spd', 'acc'],
  TE: ['cth', 'cit', 'srr', 'spc', 'rbk', 'pbk', 'str', 'spd'],
  LT: ['pbk', 'rbk', 'pbp', 'pbf', 'rbp', 'rbf', 'str', 'awr'],
  LG: ['rbk', 'pbk', 'rbp', 'rbf', 'pbp', 'str', 'awr'],
  C: ['rbk', 'pbk', 'awr', 'str', 'rbp', 'pbp'],
  RG: ['rbk', 'pbk', 'rbp', 'rbf', 'pbp', 'str', 'awr'],
  RT: ['pbk', 'rbk', 'pbp', 'pbf', 'rbp', 'rbf', 'str', 'awr'],
  LE: ['pmv', 'fmv', 'bsh', 'pur', 'tak', 'str', 'acc'],
  RE: ['pmv', 'fmv', 'bsh', 'pur', 'tak', 'str', 'acc'],
  DT: ['bsh', 'pmv', 'fmv', 'str', 'tak', 'pur'],
  LOLB: ['tak', 'bsh', 'pur', 'prc', 'zcv', 'pmv', 'spd'],
  MLB: ['tak', 'bsh', 'pur', 'prc', 'zcv', 'awr', 'spd'],
  ROLB: ['tak', 'bsh', 'pur', 'prc', 'zcv', 'pmv', 'spd'],
  CB: ['mcv', 'zcv', 'prs', 'spd', 'acc', 'agi', 'prc', 'cth'],
  FS: ['zcv', 'mcv', 'prc', 'pur', 'tak', 'spd', 'cth'],
  SS: ['tak', 'zcv', 'mcv', 'pur', 'prc', 'htp', 'spd'],
  K: ['kpw', 'kac', 'awr'],
  P: ['kpw', 'kac', 'awr'],
};

/** Anything unmapped (a position the save invents, a placeholder) still gets an honest, position-neutral read. */
const FALLBACK_RATINGS = ['spd', 'acc', 'agi', 'str', 'awr', 'sta'];

export interface RatedField {
  key: string;
  abbr: string;
  value: number;
}

const FIELD_BY_KEY = new Map(ALL_RATING_FIELDS.map((f) => [f.key, f]));

/**
 * The position-relevant ratings a player actually has, best first.
 *
 * Filters to keys that exist in the rating set rather than trusting the map:
 * kicker keys (`kpw`/`kac`) aren't in `RATING_SECTIONS` on every schema, and a
 * summary that reported a confident 0 for a rating the save never had would be
 * worse than one that stayed quiet.
 */
export function relevantRatings(position: string, fields: PlayerEditFields): RatedField[] {
  const keys = POSITION_RATINGS[position.toUpperCase()] ?? FALLBACK_RATINGS;
  return keys
    .flatMap((key) => {
      const def = FIELD_BY_KEY.get(key);
      const value = fields.ratings[key];
      return def && typeof value === 'number' ? [{ key, abbr: def.abbr, value }] : [];
    })
    .sort((a, b) => b.value - a.value);
}

export interface PlayerDna {
  strength: RatedField | null;
  weakness: RatedField | null;
  /** The lowest relevant rating, phrased as what to work on — the same field as `weakness`, named for what the user does with it. */
  priority: RatedField | null;
}

/**
 * A player's evaluation in three numbers: what he's best at, what he's worst at,
 * and therefore what to develop.
 *
 * Returns nulls rather than guesses when there's nothing to read. Historical
 * players have no live ratings at all (the save state is gone), and inventing a
 * qualitative label for them would be the profile lying with confidence.
 */
export function playerDna(position: string, fields: PlayerEditFields | null): PlayerDna {
  if (!fields) return { strength: null, weakness: null, priority: null };
  const ranked = relevantRatings(position, fields);
  if (ranked.length === 0) return { strength: null, weakness: null, priority: null };
  const weakest = ranked[ranked.length - 1];
  return {
    strength: ranked[0],
    weakness: weakest,
    // With one relevant rating, best and worst are the same number and calling
    // it a development priority would be noise dressed as insight.
    priority: ranked.length > 1 ? weakest : null,
  };
}

/**
 * The rating sections, ordered so the decision-relevant ones come first for this
 * position — Phase 4's Ratings destination leads with these and keeps the rest
 * behind a disclosure. Section definitions still come from `RATING_SECTIONS`;
 * this only decides the order.
 */
export function orderedRatingSections(position: string): typeof RATING_SECTIONS {
  const relevant = new Set(POSITION_RATINGS[position.toUpperCase()] ?? FALLBACK_RATINGS);
  const score = (section: (typeof RATING_SECTIONS)[number]) =>
    section.fields.filter((f) => relevant.has(f.key)).length;
  return [...RATING_SECTIONS].sort((a, b) => score(b) - score(a));
}
