import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../../lib/useScrollLock';
import { useGameModal } from '../../data/GameModalProvider';
import { GameDetailContent } from '../../pages/GameDetail';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

/**
 * Global game box-score modal. Renders the full GameDetailContent inside a
 * portaled overlay so a game opens over Schedule (or a media tag) and closes
 * back to it — the two-level IA rule: menus stop at the sub-tab, everything
 * finer is a modal. Portaled to body because surrounding cards use
 * backdrop-blur (a containing block that would trap a fixed child).
 */
export function GameDetailModal() {
  const { state, closeGameModal } = useGameModal();

  useScrollLock(state !== null);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeGameModal();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [state, closeGameModal]);

  if (!state) return null;

  return createPortal(
    /*
      The panel caps its own height and scrolls INSIDE itself — it used to be
      the scrim that scrolled, with the header pinned by `sticky top-0`. That
      let the box score's helmet artwork ride up past the header and out the top
      of the panel, because a sticky header sticks to the SCROLLPORT (the scrim)
      rather than to the panel it belongs to, and the panel had no
      `overflow-hidden` to clip what escaped it.

      This is the same shell every other overlay uses, and what
      UI/ModalAction.md specifies: cap the height, scroll the body, so the page
      behind never scrolls and nothing can render above the header.
    */
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeGameModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game box score"
        className="corner-cut relative flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden modal-panel md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game box score</p>
          <ModalCloseButton label="game box score" onClick={closeGameModal} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <GameDetailContent dynastyId={state.dynastyId} gameId={state.gameId} seasonId={state.seasonId} />
        </div>
      </div>
    </ModalOverlay>,
    document.body,
  );
}
