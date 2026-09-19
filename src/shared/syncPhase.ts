/**
 * Phase-aware sync (2026-07-25) — the single source of truth for "what part of
 * the dynasty calendar is this save in, and what's safe to ingest?" Derived from
 * SeasonInfo.CurrentWeekType + CurrentOffseasonStage (see extract-league.ts and
 * memory reference-sync-phase-map, mapped from a full Auburn cycle 2026→2027).
 *
 * The save is one mutable snapshot; different data finalizes at different points.
 * These predicates let persistExtraction gate what it writes so a mistimed sync
 * can't corrupt a finished season. Gating is SILENT — the user just sees "Synced".
 */

export type SyncPhaseKind = 'preseason' | 'regular' | 'postseason' | 'offseason';

export interface SyncPhase {
  kind: SyncPhaseKind;
  /** 1–9 while kind==='offseason'; 0 otherwise. */
  offseasonStage: number;
  /** Raw SeasonInfo.CurrentWeekType (PreSeason | RegularSeason | NationalChampionship | OffSeason | …). */
  weekType: string;
  /** A short human label — for storage/diagnostics, not shown to users (silent gating). */
  label: string;
}

export interface SyncPhaseInput {
  currentWeekType: string;
  currentOffseasonStage: number;
}

/** Well-known offseason stages we're confident about; others fall back to a generic label. */
const OFFSEASON_STAGE_LABELS: Record<number, string> = {
  1: 'End of Season Recap',
  2: 'Players Leaving',
  7: 'National Signing Day',
  8: 'Training Results',
};

export function deriveSyncPhase(input: SyncPhaseInput): SyncPhase {
  const weekType = input.currentWeekType;
  const offseasonStage = weekType === 'OffSeason' ? input.currentOffseasonStage : 0;

  let kind: SyncPhaseKind;
  if (weekType === 'PreSeason') kind = 'preseason';
  else if (weekType === 'RegularSeason') kind = 'regular';
  else if (weekType === 'OffSeason') kind = 'offseason';
  else kind = 'postseason'; // NationalChampionship, bowls, playoff rounds, etc.

  let label: string;
  if (kind === 'offseason')
    label = OFFSEASON_STAGE_LABELS[offseasonStage] ?? `Offseason · stage ${offseasonStage}`;
  else if (kind === 'preseason') label = 'Preseason';
  else if (kind === 'regular') label = 'Regular Season';
  else label = 'Postseason';

  return { kind, offseasonStage, weekType, label };
}

/**
 * A user-facing label for WHERE in the in-game calendar a save sits — e.g.
 * "Preseason", "Week 7", "Postseason", "End of Season Recap". Shown on the
 * dashboard so you can tell at a glance what point each dynasty's save is paused
 * at. (Distinct from SyncPhase.label, which is terse and diagnostic.)
 */
export function formatSaveWeek(input: SyncPhaseInput & { currentWeek: number }): string {
  const phase = deriveSyncPhase(input);
  if (phase.kind === 'preseason') return 'Preseason';
  if (phase.kind === 'regular')
    return input.currentWeek > 0 ? `Week ${input.currentWeek}` : 'Regular Season';
  if (phase.kind === 'offseason') return phase.label; // "End of Season Recap", "Players Leaving", "Offseason · stage N"
  // Bowls / playoff / national championship. CurrentWeek keeps counting here
  // (17-20, verified on a real NC-week save), and without it every postseason
  // sync reads identically — a user advancing through bowl weeks saw the label
  // sit still and reported the sync itself as stuck.
  return input.currentWeek > 0 ? `Postseason · Week ${input.currentWeek}` : 'Postseason';
}

/**
 * The schedule is user-editable in the preseason (verified: game count 934→944
 * once the season starts), so it's only authoritative once we're out of preseason.
 */
export function isScheduleFinal(p: SyncPhase): boolean {
  return p.kind !== 'preseason';
}

/**
 * The short window where a just-finished season is captured for the last time —
 * End of Season Recap (stage 1) + Players Leaving (stage 2). Rosters are still
 * intact here; the game hasn't churned TeamIDs or thinned awards yet.
 */
export function isSeasonFinalizing(p: SyncPhase): boolean {
  return p.kind === 'offseason' && p.offseasonStage >= 1 && p.offseasonStage <= 2;
}

/**
 * Is the bowl slate actually SET, i.e. does a listed bowl matchup mean anything?
 *
 * The save carries bowl games from the start of the season with participants
 * already filled in — verified on a real mid-season save: an Auburn dynasty
 * sitting at 4-4 in `RegularSeason` already listed "Week 18 · Reliaquest Bowl ·
 * USC @ Auburn (Unplayed)". Those pairings are the game's placeholder and get
 * rewritten once bowls are genuinely assigned, so showing them is worse than
 * showing nothing: it tells a user their bowl before it exists, and tells them
 * the wrong one.
 *
 * Real bowl assignment happens the week AFTER conference championship week.
 * Conveniently that is exactly where the save's own week type flips: conference
 * championship week is still `RegularSeason`, and the postseason is
 * `NationalChampionship` (see the phase map in this file's header). So "not
 * PreSeason and not RegularSeason" IS "bowl week has started".
 *
 * `null` = a season archived before phase tracking existed. Callers pair this
 * with "…or the game has been played", so a legacy completed season still shows
 * the bowl it actually played — the gate can only ever hide an UNPLAYED one.
 */
export function isBowlSlateSet(weekType: string | null | undefined): boolean {
  if (!weekType) return false;
  const kind = deriveSyncPhase({ currentWeekType: weekType, currentOffseasonStage: 0 }).kind;
  return kind === 'postseason' || kind === 'offseason';
}

/**
 * The concluded season must be treated as immutable from OffSeason stage 3 on —
 * players scatter to the pool (TeamIDs change) and awards get thinned. A sync
 * here must NOT overwrite the finished season's snapshots.
 */
export function isSeasonLocked(p: SyncPhase): boolean {
  return p.kind === 'offseason' && p.offseasonStage >= 3;
}
