import { useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../lib/useScrollLock';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

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
      className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden modal-panel corner-cut md:max-h-[calc(100vh-4rem)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
        <div className="min-w-0">
          {eyebrow && <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>}
          <h3 className="truncate text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
        </div>
        <ModalCloseButton label={title} onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
    </div>
  ) : (
    <div className="content-enter w-full" style={{ maxWidth: `${widthRem}rem`, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
      {children}
    </div>
  );

  return createPortal(
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {panel}
    </ModalOverlay>,
    document.body,
  );
}
