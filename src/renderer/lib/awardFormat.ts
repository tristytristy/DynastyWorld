import { AWARD_DISPLAY_ORDER } from '../../shared/awardOrder';

export { AWARD_DISPLAY_ORDER };

/**
 * Human-readable labels for the save's raw `AwardType` strings, each paired
 * with the closest real-world college football award. Only Heisman is a
 * literal name match; everything else is a generic position-based name in
 * the save (`BEST_QB`, `BEST_LB`, etc.), so this is a reasoned equivalence,
 * not a save-provided string — verified against the exact display order and
 * real winners the user confirmed from actually playing the game (see
 * AWARD_DISPLAY_ORDER below).
 *
 * **`BEST_SR` / `MOST_VERSATILE` correction (2026-07-16):** these two were
 * originally swapped. `MOST_VERSATILE` was mapped to "The Jet Award" on the
 * (wrong) assumption that Jet's real tagline is "most versatile player" —
 * it's actually "most outstanding return specialist"; the "most versatile"
 * tagline belongs to the **Paul Hornung Award**. There was no way to catch
 * this from the save data alone (no in-game award name string exists
 * anywhere to check against) — it took a user who'd actually seen the
 * in-game ceremony confirming Eugene Wilson III won "The Jet Award", cross-
 * checked directly against a real save's `LeagueHistoryAward` table, where
 * Eugene Wilson III is filed under `BEST_SR`, not `MOST_VERSATILE`. So
 * `BEST_SR` is the game's own (oddly-named) internal id for the Jet Award,
 * and `MOST_VERSATILE` is Hornung. Every one of the other 22 mappings was
 * independently re-verified against the user's own exact real-world award
 * order (AWARD_DISPLAY_ORDER) and confirmed already correct.
 *
 * `BEST_DE` has no clean 1:1 real award (Lombardi/Bednarik already cover the
 * other line/defense slots) and falls back to a generic label. `BEST_DEF_1`
 * (Bronko Nagurski) is a real, real-data-backed AwardType but is
 * deliberately excluded from AWARD_DISPLAY_ORDER — confirmed by the user
 * that the playable game does not surface it as a distinct named award
 * alongside `BEST_DEF_2` (Chuck Bednarik).
 *
 * All-American tiers (`ALL_AM_*`, 10 variants) and weekly honors
 * (`Offensive_Player_of_Week`/`Defensive_Player_of_Week`, 4 variants) are
 * NOT single-winner awards — a whole team of honorees or a repeatable
 * per-week nod — so they're formatted procedurally below instead of a fixed
 * lookup, and get no dedicated trophy art (see trophyAssetMapping.ts).
 */
const AWARD_LABELS: Record<string, string> = {
  HEISMAN: 'Heisman Trophy',
  BEST_PLAYER: 'Maxwell Award',
  BEST_POTY: 'Walter Camp Award',
  BEST_HC: 'Bear Bryant Award',
  BEST_QB: "Davey O'Brien Award",
  BEST_DEF_2: 'Chuck Bednarik Award',
  BEST_DB: 'Jim Thorpe Award',
  BEST_RB: 'Doak Walker Award',
  BEST_REC: 'Fred Biletnikoff Award',
  BEST_DL: 'Lombardi Award',
  BEST_SR_QB: 'Unitas Golden Arm Award',
  BEST_DE: 'Best Defensive End',
  BEST_IL: 'Outland Trophy',
  BEST_TE: 'John Mackey Award',
  BEST_AC: 'Broyles Award',
  BEST_LB: 'Dick Butkus Award',
  BEST_C: 'Rimington Trophy',
  BEST_KICK: 'Lou Groza Award',
  BEST_PUNT: 'Ray Guy Award',
  BEST_SR: 'The Jet Award',
  BEST_FRESHMAN_POTY: 'Shaun Alexander Award',
  MOST_VERSATILE: 'Paul Hornung Award',
  BEST_ACADEMIC: 'William V. Campbell Trophy',
  // Real, real-data-backed award, just not part of the curated display order
  // (see the comment above) — kept here so formatAwardLabel() never falls
  // through to the raw string if this type shows up somewhere unexpected.
  BEST_DEF_1: 'Bronko Nagurski Trophy',
};

/** Sorts (and filters to) the curated 22-award display set, in the game's own real order — drops anything not in AWARD_DISPLAY_ORDER (e.g. BEST_DEF_1, HEISMAN — Heisman gets its own dedicated section). */
export function sortAnnualAwards<T extends { awardType: string }>(awards: T[]): T[] {
  const orderIndex = new Map(AWARD_DISPLAY_ORDER.map((type, index) => [type, index]));
  return awards
    .filter((award) => orderIndex.has(award.awardType))
    .sort((a, b) => (orderIndex.get(a.awardType) ?? 0) - (orderIndex.get(b.awardType) ?? 0));
}

export type HonorKind = 'all-american' | 'all-conference';
export type HonorTier = 'first' | 'second' | 'freshman';

export function isAllAmericanHonor(awardType: string): boolean {
  return awardType.startsWith('ALL_AM_');
}

/** Preseason projections (`_PRE` variants) are a different, speculative thing from being actually named — excluded from the honors roster browser and team counts, not just hidden. */
export function isPreseasonHonor(awardType: string): boolean {
  return awardType.includes('_PRE');
}

export function getHonorKind(awardType: string): HonorKind {
  return awardType.includes('_CONF') ? 'all-conference' : 'all-american';
}

export function getHonorTier(awardType: string): HonorTier {
  if (awardType.includes('_FR')) return 'freshman';
  if (awardType.includes('_2ND')) return 'second';
  return 'first';
}

/** "ALL_AM_1ST_PRE_CONF" -> "Preseason First Team All-Conference", etc. — 10 real variants, all handled by this one parser rather than an exhaustive lookup. */
function formatAllAmerican(awardType: string): string | null {
  if (!isAllAmericanHonor(awardType)) return null;
  const tier = getHonorTier(awardType);
  const tierLabel = tier === 'freshman' ? 'Freshman' : tier === 'second' ? 'Second Team' : 'First Team';
  const kind = getHonorKind(awardType) === 'all-conference' ? 'All-Conference' : 'All-American';
  const prefix = isPreseasonHonor(awardType) ? 'Preseason ' : '';
  return `${prefix}${tierLabel} ${kind}`;
}

/** "Offensive_Player_of_Week_Conf" -> "Conference Offensive Player of the Week", etc. */
function formatWeeklyHonor(awardType: string): string | null {
  if (!awardType.includes('Player_of_Week')) return null;
  const side = awardType.startsWith('Offensive') ? 'Offensive' : 'Defensive';
  const scope = awardType.endsWith('_Conf') ? 'Conference' : 'National';
  return `${scope} ${side} Player of the Week`;
}

/** Falls back to the raw AwardType string itself for anything unrecognized, rather than hiding it. */
export function formatAwardLabel(awardType: string): string {
  return AWARD_LABELS[awardType] ?? formatAllAmerican(awardType) ?? formatWeeklyHonor(awardType) ?? awardType;
}

/** True for the ~24 leaguewide single-winner season awards (has dedicated trophy art); false for All-American tiers and weekly honors (text-only). */
export function isMarqueeAward(awardType: string): boolean {
  return awardType in AWARD_LABELS;
}

/** Collapses repeat weekly honors (e.g. three separate "Offensive Player of the Week" entries) into one labeled count each, so a season of nods doesn't render as a wall of duplicate badges. */
export function groupWeeklyHonors(awards: { awardType: string }[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const award of awards) {
    const label = formatAwardLabel(award.awardType);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}
