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
const SKILL_POSITIONS = new Set<string>(['QB', 'HB', 'WR', 'TE']);

export function isSkillPosition(position: string): boolean {
  return SKILL_POSITIONS.has(position);
}

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

export function abbreviateClass(schoolYear: string): string {
  return CLASS_ABBREVIATIONS[schoolYear] ?? schoolYear;
}
