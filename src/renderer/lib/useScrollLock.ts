import { useEffect } from 'react';

/**
 * Reference-counted body scroll lock, shared by every modal.
 *
 * The old per-modal pattern — `prev = body.overflow; body.overflow = 'hidden';
 * …restore prev` — breaks when modals STACK (e.g. open a Team modal from a
 * player modal, or a player modal from the Team modal): the upper modal saves
 * the lower one's already-'hidden' value and, on close, restores 'hidden' with
 * no modal open, leaving the page permanently unscrollable until an app restart.
 * A shared counter fixes it: the body is locked while ANY modal is open and only
 * unlocked when the last one closes.
 */
let lockCount = 0;

export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.style.overflow = '';
    };
  }, [active]);
}
