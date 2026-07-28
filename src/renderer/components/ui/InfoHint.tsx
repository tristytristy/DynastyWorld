import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * A small circled "i" that reveals explanatory copy on hover or focus.
 *
 * The app had grown a paragraph under nearly every page title explaining what
 * the page was — useful the first time, clutter every time after, and it pushed
 * the actual content down the screen. This keeps the words available without
 * spending permanent screen space (and permanent reading effort) on them.
 *
 * Deliberately NOT hover-only:
 *   - It's a real <button>, so it's reachable and openable by keyboard. A
 *     hover-only tooltip hides the content from anyone not using a mouse, which
 *     would make the app worse for them while making it cleaner for everyone
 *     else — the explanation would be gone, not relocated.
 *   - Tapping toggles it, so it works on a touchscreen.
 *   - Escape closes it, and it closes on scroll (a panel anchored to a moved
 *     button is worse than no panel).
 *
 * Rendered through a portal so it can never be trapped by an ancestor's
 * `overflow: hidden` or clipped by the app shell's `clip-path` — the same
 * containing-block trap that has bitten the media lightbox and the player
 * comparison modal in this codebase before.
 */
export function InfoHint({
  children,
  label = 'More information',
  className = '',
}: {
  /** The explanatory copy. Keep it to a sentence or two — this is a hint, not a doc. */
  children: ReactNode;
  /** Accessible name for the trigger; override when several hints sit close together. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  function place() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
  }

  function show() {
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // `true` = capture, so a scroll inside any nested container closes it too,
    // not just a scroll on window.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={() => (open ? setOpen(false) : show())}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400/70 align-middle text-[10px] font-bold leading-none text-slate-500 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-slate-600 dark:text-slate-400 ${className}`}
      >
        i
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            id={panelId}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[999] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 corner-cut-sm border border-slate-200/90 bg-white/98 px-3.5 py-2.5 text-xs leading-5 text-slate-600 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-sm dark:border-white/15 dark:bg-slate-950/98 dark:text-slate-300"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
