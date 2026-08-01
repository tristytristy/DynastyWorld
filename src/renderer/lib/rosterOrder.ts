/**
 * Canonical position order matching the game's own default roster/depth-chart
 * ordering (offense skill positions, then the line left-to-right, then defense
 * front-to-back). Verified against the actual 21 distinct position values
 * present in the real save before hardcoding this — no guessed labels.
 */
export const POSITION_ORDER = [
  'QB',
  'HB',
  'FB',
  'WR',
  'TE',
  'LT',
  'LG',
  'C',
  'RG',
  'RT',
  'LE',
  'RE',
  'DT',
  'LOLB',
  'MLB',
  'ROLB',
  'CB',
  'SS',
  'FS',
  'K',
  'P',
] as const;

export type Unit = 'Offense' | 'Defense' | 'Special Teams';

const OFFENSE_POSITIONS = new Set<string>(['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT']);
const DEFENSE_POSITIONS = new Set<string>(['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'SS', 'FS']);

export function unitForPosition(position: string): Unit {
  if (OFFENSE_POSITIONS.has(position)) return 'Offense';
  if (DEFENSE_POSITIONS.has(position)) return 'Defense';
  return 'Special Teams';
}

/** Conventional offensive skill positions — HB is this game's real position code for running back, not "RB". */
export function positionSortIndex(position: string): number {
  const idx = (POSITION_ORDER as readonly string[]).indexOf(position);
  return idx === -1 ? POSITION_ORDER.length : idx;
}

/** Real, verified school-year values — only these four exist in the data. */
export const CLASS_ORDER = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

const CLASS_ABBREVIATIONS: Record<string, string> = {
  Freshman: 'Fr.',
  Sophomore: 'So.',
  Junior: 'Jr.',
  Senior: 'Sr.',
};

export function classSortIndex(schoolYear: string): number {
  const idx = CLASS_ORDER.indexOf(schoolYear);
  return idx === -1 ? CLASS_ORDER.length : idx;
}

/**
 * REDSHIRTS.
 *
 * `Player.RedshirtStatus` is a four-value enum, verified against a real save
 * (11,730 roster players):
 *
 *   Eligible   — the redshirt is still available, i.e. NOT a redshirt
 *   Ineligible — cannot redshirt (vanishingly rare: 1 player)
 *   Current    — redshirting right now, this season
 *   Previous   — has already used it
 *
 * Both `Current` and `Previous` answer "is this player a redshirt?" with yes —
 * one is using it, one has used it — so both carry the mark. `Eligible` is the
 * majority and stays bare, which is what keeps the prefix meaningful: 1,390 of
 * that save's 3,244 freshmen are redshirts, so marking the other way round
 * would put a badge on most of the roster.
 */
export function isRedshirt(redshirtStatus: string | undefined | null): boolean {
  return redshirtStatus === 'Previous' || redshirtStatus === 'Current';
}

/**
 * "RS Fr." / "Fr.".
 *
 * A two-character prefix on a label the roster table, the player hero, the
 * cards and the hover preview already render — rather than a new column or a
 * badge, either of which would cost layout on every one of those surfaces to
 * say something the class line can say by itself. It is also simply how the
 * sport writes it.
 */
export function abbreviateClass(schoolYear: string, redshirtStatus?: string | null): string {
  const base = CLASS_ABBREVIATIONS[schoolYear] ?? schoolYear;
  return isRedshirt(redshirtStatus) ? `RS ${base}` : base;
}

/** The long form, for filter menus and anywhere with room: "RS Freshman". */
export function classLabel(schoolYear: string, redshirtStatus?: string | null): string {
  return isRedshirt(redshirtStatus) ? `RS ${schoolYear}` : schoolYear;
}

/**
 * The value a class filter matches on — the same string `classLabel` renders,
 * so a dropdown option and the row it selects are the one value rather than two
 * that have to be kept in step.
 */
export function classFilterValue(schoolYear: string, redshirtStatus?: string | null): string {
  return classLabel(schoolYear, redshirtStatus);
}

/**
 * Every class option in roster order, redshirt variant immediately after its
 * base year — Freshman, RS Freshman, Sophomore, RS Sophomore, and so on.
 *
 * Built from the players actually present rather than from a fixed list: a
 * roster with no redshirt juniors shouldn't offer "RS Junior" and then show an
 * empty table when it's picked.
 */
export function classFilterOptions(
  players: { schoolYear: string; redshirtStatus?: string | null }[],
): string[] {
  const present = new Set(players.map((p) => classFilterValue(p.schoolYear, p.redshirtStatus)));
  const ordered: string[] = [];
  for (const year of CLASS_ORDER) {
    if (present.has(year)) ordered.push(year);
    if (present.has(`RS ${year}`)) ordered.push(`RS ${year}`);
  }
  // Anything the save produced that isn't one of the four known years still
  // deserves to be selectable rather than silently unfilterable.
  for (const value of present) if (!ordered.includes(value)) ordered.push(value);
  return ordered;
}
