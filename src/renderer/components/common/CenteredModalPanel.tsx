import { useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Standard centered modal shell (Phase 1 modal standardization, 2026-07-21).
 *
 * A drop-in replacement for AnchoredMenuPanel — same props — but instead of
 * floating beside the trigger button it opens CENTERED over a dimmed, blurred
 * backdrop, matching the Player Profile / editor modals so every popup in the
 * app shares one presentation (overlay darkness, backdrop blur, centering,
 * mount animation, Escape-to-close, click-outside-to-close, scroll lock).
 *
 * `anchorRef` is accepted only for drop-in compatibility with the old
 * AnchoredMenuPanel call sites and is intentionally unused — a centered modal
 * doesn't position relative to its trigger.
 */
export function CenteredModalPanel({
  open,
  onClose,
  widthRem,
  isDark,
  children,
}: {
  /** Unused — kept so this is a drop-in swap for AnchoredMenuPanel. */
  anchorRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Max panel width in rem. */
  widthRem: number;
  isDark: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8 ${isDark ? 'dark' : ''}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="content-enter w-full"
        style={{ maxWidth: `${widthRem}rem`, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
