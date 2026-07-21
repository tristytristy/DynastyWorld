/**
 * Compact class-year label for recruit table rows, shared by the National
 * Recruits and My Board pages so the two read consistently. High school → "HS";
 * JUCO years are abbreviated ("JUCO Soph" / "JUCO Jr" / "JUCO Sr" / "JUCO Fr")
 * so they don't overflow a table cell.
 */
export function formatClassYearShort(raw: string): string {
  if (raw === 'HighSchool') return 'HS';
  if (raw.startsWith('JuniorCollege_')) {
    const year = raw.replace('JuniorCollege_', '');
    const short: Record<string, string> = { Freshman: 'Fr', Sophomore: 'Soph', Junior: 'Jr', Senior: 'Sr' };
    return `JUCO ${short[year] ?? year}`;
  }
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2');
}
