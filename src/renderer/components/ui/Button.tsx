import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Control system (visual overhaul §21). One button family for the whole app:
 *
 * - `primary`     — the page's main action (team-colored).
 * - `secondary`   — standard neutral action.
 * - `tertiary`    — low-emphasis / inline action, no border until hover.
 * - `destructive` — deletion and other irreversible actions only.
 *
 * Shape language (user direction 2026-07-19): hard rectangular edges. The
 * high-emphasis variants (primary/destructive) carry the signature single cut
 * corner (`.corner-cut-sm`), echoing the game's own menu items; secondary and
 * tertiary stay plain rectangles — cutting every control would cheapen the
 * effect. Labels render in the display face. `compact` drops height/padding
 * for dense contexts (table toolbars).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'corner-cut-sm bg-[var(--team-primary)] text-[var(--team-on-primary)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-primary)]',
  secondary:
    'border border-slate-300/80 bg-white/85 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
  tertiary:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
  destructive:
    'corner-cut-sm bg-red-600 text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600',
};

export function Button({
  variant = 'secondary',
  compact = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-display font-semibold transition duration-fast ease-standard disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      } ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
