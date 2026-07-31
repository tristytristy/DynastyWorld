/**
 * How a selected cell looks — defined once so the treatment can't drift between
 * the sidebar, lists and tables.
 *
 * CURRENTLY UNREFERENCED (2026-07-29): the sidebar was its last consumer and now
 * uses the glider (components/ui/GliderNav.tsx). Kept rather than deleted
 * because it states the app's non-navigation selection contract — the 1px border
 * in both themes that app.tsx's frame comment cites, and the light/dark split
 * the glider's own CSS reasoning is built on. Delete it if a row-selection
 * surface never needs it again.
 *
 * Light and dark work differently on purpose:
 *
 * - **Light:** a team-coloured edge plus a faint team wash. A 10% tint over
 *   white still leaves plenty of contrast for the text sitting on it.
 * - **Dark:** the same 10% wash over near-black produced a muddy grey that ate
 *   the content — the row was "highlighted" and *less* readable than its
 *   neighbours. So dark keeps the cell off-black and marks selection with a
 *   gold edge instead. Nothing is laid over the content; the border does
 *   all the work, and gold reads clearly against black without competing with
 *   the team colours the rest of the page is themed in.
 *
 * The border is 1px in BOTH themes (see SELECTION_BASE) so selecting a row
 * never changes its size — an unselected row carries the same 1px, transparent.
 */

/** Must be on the element in both states, so selection only changes colour, never layout. */
export const SELECTION_BASE = 'border transition-all duration-base ease-standard';

/** The selected state. */
export const SELECTION_ACTIVE = [
  // Light: team edge + faint team wash.
  'border-[color:color-mix(in_srgb,var(--team-primary)_45%,transparent)]',
  'bg-[color-mix(in_srgb,var(--team-primary)_10%,transparent)]',
  'text-slate-950',
  // Dark: off-black cell, gold edge, no wash over the content.
  'dark:border-gold-300 dark:bg-slate-950 dark:text-white',
].join(' ');

/** The unselected state — transparent border keeps the box the same size. */
export const SELECTION_IDLE = [
  'border-transparent text-slate-700',
  'hover:border-slate-200 hover:bg-black/[0.03] hover:text-slate-950',
  'dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white',
].join(' ');
