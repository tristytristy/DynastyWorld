/**
 * Which week holds the conference championships.
 *
 * The save does NOT give these their own `SeasonWeekType` — verified on a real
 * week-16 save, where all ten championship games sit in `RegularSeason`
 * alongside the rest of the year. So the week is derived: it's the LAST
 * regular-season week on the calendar, which in the tested save is 16 (week 15
 * carries no games at all).
 *
 * Derived rather than hardcoded on purpose. A user can shift the calendar, and
 * a literal `week === 16` would silently stop identifying anything; the last
 * regular-season week is true whatever the schedule looks like.
 *
 * Returns null when there are no regular-season games to reason about.
 */
export function conferenceChampionshipWeek(games: { week: number; isBowlGame: boolean }[]): number | null {
  let max: number | null = null;
  for (const game of games) {
    if (game.isBowlGame) continue;
    if (max === null || game.week > max) max = game.week;
  }
  return max;
}
