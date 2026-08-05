import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { rankMovement } from '../../lib/ncaaHubFormat';
import type { NcaaHubTop25Entry } from '../../../shared/types';

/**
 * The dashboard's panel shell — a header hairline, a title, an optional action
 * on the right, and a body.
 *
 * NOT a card. Sections in this app are separated rather than boxed (see
 * SurfaceCard's own note), and side accents are out entirely (user direction
 * 2026-08-03), so a panel is defined by its header rule and the grid gap around
 * it. That is also what lets three columns of different content line up: every
 * panel's first text baseline sits at the same height.
 */
export function DashboardPanel({
  title,
  action,
  controls,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  /** Right-hand affordance in the header — a "View all" link, a count. */
  action?: ReactNode;
  /** A row under the header, for a panel's own tabs. */
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col ${className}`}>
      <header className="flex min-h-[28px] items-center justify-between gap-3 border-b border-[var(--surface-raised-border)] pb-2">
        <h3 className="type-eyebrow truncate text-slate-950 dark:text-white">{title}</h3>
        {action}
      </header>
      {controls && <div className="mt-2.5 flex min-w-0 items-center">{controls}</div>}
      <div className={`mt-2.5 min-h-0 min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** The compact "see the whole thing" link every panel carries to its full page. */
export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-[var(--team-accent-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:text-slate-500 dark:hover:text-[var(--team-accent-text)]"
    >
      {children}
    </Link>
  );
}

/** Reserved-height placeholder so a panel's arrival doesn't shove the grid around. */
export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-8 animate-pulse bg-slate-200/60 dark:bg-white/[0.04]" />
      ))}
    </div>
  );
}

/**
 * What a panel says when the save genuinely has nothing to put there. Always a
 * reason, never a shrug: "no CFP poll yet" and "this season was never synced"
 * are different states and the user can act on the difference.
 */
export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 py-6 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">{children}</p>
  );
}

/**
 * Up/down since last week IN THIS ROW'S OWN POLL (the entry carries its own
 * movement — see NcaaHubTop25Entry). Renders nothing at all when there is no
 * prior poll to compare against, so an empty cell never reads as "held".
 */
export function MovementChip({ entry, showFlat = true }: { entry: NcaaHubTop25Entry; showFlat?: boolean }) {
  const movement = rankMovement(entry);
  if (!movement) return null;
  // In a preseason poll every team's "last week" equals its current rank simply
  // because there was no last week, and a column of "unchanged" marks would
  // claim a prior poll that never existed. The caller decides (see
  // PollRankingsPanel): flat marks only appear once SOMETHING in the poll has
  // moved, which is the proof that a previous week is real.
  if (movement.direction === 'flat' && !showFlat) return null;

  const tone =
    movement.direction === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : movement.direction === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <span className={`tnum inline-flex items-center gap-0.5 text-[10px] font-semibold ${tone}`} title={movement.label}>
      <span aria-hidden="true">
        {movement.direction === 'up' ? '▲' : movement.direction === 'down' ? '▼' : '—'}
      </span>
      {movement.spots > 0 && <span>{movement.spots}</span>}
      <span className="sr-only">{movement.label}</span>
    </span>
  );
}

/**
 * A dashboard list row that is also a button. Rows are activated by the whole
 * surface rather than by a link inside them — at this density a 3-word target
 * inside a 32px row is a miss waiting to happen — so the row itself carries the
 * accessible name and the keyboard behaviour a `<button>` brings for free.
 */
export function RowButton({
  onClick,
  label,
  children,
  highlight = false,
  className = '',
}: {
  onClick: (() => void) | null;
  label: string;
  children: ReactNode;
  /** The user's own team — a wash, not a colour-only signal (the row also carries its name). */
  highlight?: boolean;
  className?: string;
}) {
  const base = `flex w-full min-w-0 items-center gap-2 px-1.5 py-1.5 text-left ${
    highlight ? 'bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]' : ''
  } ${className}`;

  if (!onClick) {
    return <div className={base}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${base} transition-colors hover:bg-slate-100/80 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:hover:bg-white/[0.06]`}
    >
      {children}
    </button>
  );
}
