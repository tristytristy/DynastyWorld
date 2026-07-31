import { createPortal } from 'react-dom';
import type { ReactNode, HTMLAttributes } from 'react';
import { useModalLayer } from '../../lib/modalLayer';

/**
 * The full-screen backdrop every modal sits on, and the single place stacking
 * order is decided.
 *
 * Each modal used to hardcode its own `z-[100]` or `z-[110]`. That holds until
 * two are open at once and share a value — then paint order falls back to DOM
 * order, which is decided by where each provider happens to sit in app.tsx.
 * That is exactly how opening a player from the game box score put the player
 * card BEHIND the game modal: both z-100, and the player provider mounts first.
 *
 * This component is only ever MOUNTED while its modal is open, so "mounted"
 * and "opened" are the same event — which is what lets `useModalLayer` hand out
 * depth in the order things were actually opened. Whatever you opened last is
 * on top, no matter how the tree is arranged.
 *
 * It also PORTALS to <body>, and that half is not optional — z-index alone
 * could not have fixed the reported bug. `#root` carries `isolation: isolate`
 * (globals.css), so it is its own stacking context: a modal rendered inside the
 * tree competes only with its siblings there, while one portalled to <body>
 * sits outside #root entirely and paints above the whole subtree no matter what
 * z-index the inner one claims. The player modal wasn't portalled and the game
 * modal was, so the player card lost even at z-120 against z-110 — confirmed by
 * hit-testing the centre pixel, which still reported the game modal on top.
 * Portalling every overlay here puts them all in the same context, which is
 * what makes the depth ordering mean anything.
 *
 * Pass the same classes as before, minus the z-index.
 */
export function ModalOverlay({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  const zIndex = useModalLayer(true);
  return createPortal(
    <div className={className} style={{ zIndex }} {...rest}>
      {children}
    </div>,
    document.body,
  );
}
