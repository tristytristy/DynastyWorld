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

const SURFACE_CLASSES: Record<SurfaceLevel, string> = {
  primary: 'border-[color:var(--surface-primary-border)] bg-[color:var(--surface-primary)]',
  raised: 'border-[color:var(--surface-raised-border)] bg-[color:var(--surface-raised)]',
  overlay: 'border-[color:var(--surface-overlay-border)] bg-[color:var(--surface-overlay)]',
};

/**
 * Flat, border-defined panels with the signature single cut corner (see
 * `.corner-cut` in globals.css) — no box-shadow: clip-path would clip it, and
 * the hard-edge aesthetic is deliberately flat.
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
  return (
    <section
      className={`corner-cut relative border p-5 backdrop-blur-sm ${SURFACE_CLASSES[surface]} ${className}`}
    >
      {/* The gradient rides on its own layer rather than replacing the surface
          colour: SURFACE_CLASSES still defines what this panel IS, and this only
          adds the fall-off. Layering also means a caller passing their own `bg-`
          in className keeps winning, which several pages rely on. */}
      <span aria-hidden className={`pointer-events-none absolute inset-0 ${GRADIENT_SURFACE}`} />
      <div className="relative">{children}</div>
    </section>
  );
}
