import { useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../lib/useScrollLock';

/**
 * The one standard modal shell for the app (Phase 1 + Phase 8 standardization,
 * 2026-07-21). Opens CENTERED over a dimmed, blurred backdrop, with a mount
 * animation, Escape + click-outside close, and scroll lock — so every popup
 * shares one presentation.
 *
 * Two modes:
 * - Pass `title` (+ optional `eyebrow`) and this owns the full glass chrome:
 *   panel border, shadow, backdrop blur, radius, padding, the header, and the
 *   Close button. Callers pass only the body. This is the target for every menu.
 * - Omit `title` and it just centers `children` on the backdrop (the caller
 *   supplies its own panel). Kept so not-yet-migrated menus still center
 *   correctly. `isDark`/`anchorRef` are accepted only for that legacy path.
 */
export function CenteredModalPanel({
  open,
  onClose,
  widthRem,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Max panel width in rem. */
  widthRem: number;
  title?: string;
  eyebrow?: string;
  /** Legacy, ignored — kept so pre-migration call sites still type-check. */
  isDark?: boolean;
  /** Legacy, ignored — a centered modal doesn't anchor to its trigger. */
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panel = title ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ maxWidth: `${widthRem}rem` }}
      className="content-enter relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-[0_60px_160px_-40px_rgba(2,6,23,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 md:max-h-[calc(100vh-4rem)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
        <div className="min-w-0">
          {eyebrow && <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>}
          <h3 className="truncate text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="shrink-0 border border-slate-300/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
    </div>
  ) : (
    <div className="content-enter w-full" style={{ maxWidth: `${widthRem}rem`, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
      {children}
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {panel}
    </div>,
    document.body,
  );
}
