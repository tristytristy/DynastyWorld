import { GRADIENT_SURFACE } from '../../lib/gradients';
import type { ReactNode } from 'react';

/**
 * The shared surface used across every page. Levels (visual overhaul §7):
 *
 * - `primary`  — standard page card (default; the former hardcoded look).
 * - `raised`   — elevated emphasis (hero sections, popovers docked in-page).
 * - `overlay`  — modal-grade panel; pair with a backdrop, not page flow.
 *
 * Backgrounds/borders resolve through the theme-aware `--surface-*` variables
 * in globals.css, so light/dark/Team-Mode tuning happens in one place.
 * `className` is appended after the base classes so callers can extend or
 * override (e.g. `p-0 overflow-hidden` for a flush table) as before.
 */
export type SurfaceLevel = 'primary' | 'raised' | 'overlay';

/**
 * IN-PAGE SECTIONS CARRY NO BORDER (2026-07-29, user direction): a page of
 * framed rectangles read as boxy, so sections are now separated by a hairline
 * BETWEEN them rather than a box around each — see the `.surface-card` divider
 * rule in globals.css.
 *
 * `overlay` keeps its border. It's the modal-grade panel: it floats over a
 * scrim rather than sitting in page flow, and without an edge it bleeds into
 * whatever is behind it.
 *
 * A PAGE SECTION ALSO HAS NO SIDE PADDING (2026-07-29, same direction — "every
 * page should be aligned visually"). While sections were boxes, `p-5` was the
 * inset from the box's edge; with the box gone it just pushed a section's text
 * 20px right of every grid that ISN'T a section — the stat-tile rows, the game
 * pairs — so nothing on the page shared a left edge. Vertical padding stays: it
 * is the section's rhythm, not its frame. `raised`/`overlay` keep theirs, since
 * those still paint a panel and text shouldn't run to its edge.
 */
const SURFACE_CLASSES: Record<SurfaceLevel, string> = {
  primary: 'py-5 bg-[color:var(--surface-primary)]',
  raised: 'p-5 bg-[color:var(--surface-raised)]',
  overlay: 'border p-5 border-[color:var(--surface-overlay-border)] bg-[color:var(--surface-overlay)]',
};

/**
 * Utilities that style the RELATIONSHIP BETWEEN CHILDREN have to live on the
 * element that actually holds them.
 *
 * Children are wrapped in a `relative` div (see below), so a caller's
 * `space-y-*` or `divide-*` landed on the `<section>`, whose only children are
 * that wrapper and — on raised/overlay — the gradient span. Both utilities
 * style the gaps BETWEEN siblings, and with one real sibling there are none:
 * the classes parsed, applied, and did nothing at all. Found via the recruit
 * panel, whose sections were flush against each other because its `space-y-5`
 * had never once taken effect (user report 2026-08-07); the Weekly Honors card
 * had likewise been asking for row dividers it never got.
 *
 * So they are forwarded to the wrapper instead of silently swallowed. Padding,
 * background and border stay on the section, where they describe the panel
 * itself. Responsive and dark: prefixes are kept with their utility.
 */
const CHILD_SPACING_UTILITY = /^(?:[\w-]+:)*(?:space-[xy]-|divide-)/;

function splitChildSpacing(className: string): { panel: string; body: string } {
  const panel: string[] = [];
  const body: string[] = [];
  for (const token of className.split(/\s+/).filter(Boolean)) {
    (CHILD_SPACING_UTILITY.test(token) ? body : panel).push(token);
  }
  return { panel: panel.join(' '), body: body.join(' ') };
}

/**
 * Flat panels with the signature single cut corner (see `.corner-cut` in
 * globals.css) — no box-shadow: clip-path would clip it, and the hard-edge
 * aesthetic is deliberately flat.
 */
export function SurfaceCard({
  children,
  className = '',
  surface = 'primary',
}: {
  children: ReactNode;
  className?: string;
  surface?: SurfaceLevel;
}) {
  const { panel, body } = splitChildSpacing(className);
  return (
    <section
      // `surface-card` is the hook the between-sections divider selects on; it
      // carries no styling of its own.
      className={`surface-card corner-cut relative backdrop-blur-sm ${SURFACE_CLASSES[surface]} ${panel}`}
    >
      {/* The gradient rides on its own layer rather than replacing the surface
          colour: SURFACE_CLASSES still defines what this panel IS, and this only
          adds the fall-off. Layering also means a caller passing their own `bg-`
          in className keeps winning, which several pages rely on.

          NOT ON A PAGE SECTION any more. In light mode this wash is an OPAQUE
          white→slate-50 gradient, so it kept painting the panel even after the
          border and the surface fill were removed — it was the box. It stays on
          `raised`/`overlay`, which are meant to read as lifted paper. */}
      {surface !== 'primary' && (
        <span aria-hidden className={`pointer-events-none absolute inset-0 ${GRADIENT_SURFACE}`} />
      )}
      <div className={`relative ${body}`}>{children}</div>
    </section>
  );
}
