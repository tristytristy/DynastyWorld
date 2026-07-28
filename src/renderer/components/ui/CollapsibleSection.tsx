import { GRADIENT_HEADER } from '../../lib/gradients';
import { useState, type ReactNode } from 'react';

/**
 * A titled, collapsible content group (visual overhaul shape language). A
 * chevron discloses/hides the body; the title stays visible when collapsed.
 * Keyboard-accessible (it's a <button> header with aria-expanded). Uncontrolled
 * by default via `defaultOpen`, or fully controlled via `open` + `onToggle` so a
 * parent can preserve section state across filter changes.
 *
 * Safe in any container: the header band is inset within the content box rather
 * than bled to the panel edges, so it doesn't depend on the parent's padding
 * and can't collide with content above it.
 */
export function CollapsibleSection({
  title,
  eyebrow = false,
  defaultOpen = true,
  open,
  onToggle,
  right,
  children,
  className = '',
}: {
  title: ReactNode;
  /** Render the title as a small uppercase eyebrow rather than a heading. */
  eyebrow?: boolean;
  defaultOpen?: boolean;
  /** Controlled open state — pair with onToggle. When omitted, the component manages its own. */
  open?: boolean;
  onToggle?: (next: boolean) => void;
  /** Optional right-aligned content in the header row (e.g. a count or note). */
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const isOpen = open ?? selfOpen;
  const toggle = () => {
    const next = !isOpen;
    if (onToggle) onToggle(next);
    else setSelfOpen(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        // The header row gets its own fall-off so it reads as a distinct band
        // above the content, without needing a hard rule under it.
        //
        // The band is INSET, not bled to the panel edges. An earlier version
        // used negative margins to span the full card width, which silently
        // assumed this section was the first child of a `p-5` card — and inside
        // the Team Performance grid, where sections sit below a title and
        // subtitle, the -mt yanked each band up into that text.
        className={`group mb-3 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${GRADIENT_HEADER}`}
      >
        <span className="flex items-center gap-2">
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-base ease-standard group-hover:text-[var(--team-primary)] dark:text-slate-500 ${isOpen ? 'rotate-90' : ''}`}
            aria-hidden
          >
            <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {eyebrow ? (
            <span className="type-eyebrow text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">{title}</span>
          ) : (
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          )}
        </span>
        {right}
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}
