import type { ReactNode } from 'react';
import { GRADIENT_SURFACE } from '../../lib/gradients';

/**
 * The app's two-state switch — Season ⇄ Yearly, and anywhere else a pair of
 * views needs one. Full spec in UI/toggle.md. Three things it fixes on purpose:
 *
 *  • the ON state is an inset ring in the CONTEXT accent, not a filled track —
 *    a fill competes with the artwork riding on it, and the accent changes per
 *    team, so a ring survives every colour a fill wouldn't.
 *  • laid out INLINE. A switch centred on a point with a −50% translate can't be
 *    dropped into a header row without fighting it.
 *  • sized to sit level with the labels either side rather than tower over them.
 *
 * `knob` replaces the sliding dot — pass a team logo and the switch reads as
 * belonging to that team. Falls back to a plain dot when nothing is supplied.
 */
export function ToggleSwitch<T extends string>({
  value,
  onChange,
  left,
  right,
  knob,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  left: { value: T; label: string };
  right: { value: T; label: string };
  /** Rides inside the track in place of the dot — typically a gold team logo. */
  knob?: ReactNode;
  ariaLabel?: string;
}) {
  const isRight = value === right.value;

  const labelClass = (active: boolean) =>
    [
      'text-sm font-semibold transition-colors duration-150',
      active
        ? 'text-slate-900 dark:text-white'
        : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
    ].join(' ');

  return (
    <div className="inline-flex items-center gap-2.5">
      <button type="button" onClick={() => onChange(left.value)} className={labelClass(!isRight)}>
        {left.label}
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={ariaLabel ?? `Switch to ${isRight ? left.label : right.label}`}
        onClick={() => onChange(isRight ? left.value : right.value)}
        className={[
          'relative h-6 w-[3.25rem] shrink-0 rounded-full border transition-colors duration-150 ease-out',
          'border-slate-200/80 dark:border-white/10',
          GRADIENT_SURFACE,
          isRight ? 'shadow-[inset_0_0_0_1px_var(--team-primary)]' : '',
        ].join(' ')}
      >
        {/*
          Geometry, explicit because getting it wrong is invisible until you look:
          track 52 × 24, knob 35 — deliberately much TALLER than the track so it
          overhangs top and bottom, which is the look. Starting at −1 and ending
          at 52 − 35 + 1 = 18 keeps that overhang symmetric left and right too,
          so travel is 19px (−1 → 18) — the track widened from 44 alongside the
          knob's 26 → 35 so the slide stayed as legible as it was before.

          The −2px on the vertical centre is deliberate and NOT a centring bug:
          the knob carries a team logo, and a mascot mark's ink sits low inside
          its own square, so true geometric centring reads as sitting low. (It
          was −5px; nudged back down 3px on review — the lift was overdone.)
        */}
        <span
          className={[
            'absolute left-[-1px] top-[calc(50%-2px)] flex h-[35px] w-[35px] -translate-y-1/2 items-center justify-center rounded-full',
            'transition-transform duration-150 ease-out',
            knob ? '' : 'bg-slate-500 shadow-[0_2px_4px_rgba(0,0,0,0.3)] dark:bg-slate-300',
            isRight ? 'translate-x-[19px]' : 'translate-x-0',
          ].join(' ')}
        >
          {knob}
        </span>
      </button>

      <button type="button" onClick={() => onChange(right.value)} className={labelClass(isRight)}>
        {right.label}
      </button>
    </div>
  );
}
