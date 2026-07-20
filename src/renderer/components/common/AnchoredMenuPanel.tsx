import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared floating panel for the utility menus (Preferences / Help / Stadium
 * Database) now that their trigger buttons live at the bottom of the left
 * sidebar (2026-07-19). It portals to <body> and positions itself with
 * `fixed`, opening UPWARD from the anchor button — the sidebar has
 * `backdrop-blur` (a containing block that would trap a fixed child) and
 * `overflow-y-auto` (which would clip an absolute child), so neither absolute
 * nor a plain fixed child of the button would escape it; a body portal does.
 *
 * The panel owns outside-click + Escape close, excluding both itself and the
 * anchor button (so the button's own toggle handler isn't fought by an
 * outside-close firing on the same click).
 */
export function AnchoredMenuPanel({
  anchorRef,
  open,
  onClose,
  widthRem,
  isDark,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Panel width in rem — used to clamp the left edge inside the viewport. */
  widthRem: number;
  isDark: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const widthPx = widthRem * 16;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - widthPx - 12));
      // Anchor the panel's bottom just above the button, so it grows upward.
      const bottom = window.innerHeight - rect.top + 8;
      setPos({ left, bottom });
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchorRef, widthRem]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: pos.left,
        bottom: pos.bottom,
        width: `${widthRem}rem`,
        maxWidth: 'calc(100vw - 1.5rem)',
        maxHeight: 'calc(100vh - 1.5rem)',
        overflowY: 'auto',
        zIndex: 80,
      }}
      className={isDark ? 'dark' : ''}
    >
      {children}
    </div>,
    document.body,
  );
}
