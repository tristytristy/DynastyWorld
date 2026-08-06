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
const NAV_BTN =
  'flex h-7 w-7 items-center justify-center border border-slate-200/80 text-base leading-none text-slate-500 transition hover:border-[var(--team-primary)] hover:text-slate-900 disabled:opacity-30 disabled:hover:border-slate-200/80 disabled:hover:text-slate-500 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white';

export function GameDetailModal() {
  const { state, closeGameModal, goToGame } = useGameModal();

  /*
    WHERE THIS GAME SITS IN THE LIST YOU CAME FROM. -1 when the caller passed no
    siblings, which is most of them — and then there is nothing to step through
    and no controls to draw.
  */
  const siblings = state?.siblings ?? [];
  const at = state ? siblings.indexOf(state.gameId) : -1;
  const prevGameId = at > 0 ? siblings[at - 1] : null;
  const nextGameId = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null;

  useScrollLock(state !== null);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeGameModal();
        return;
      }
      /*
        ARROWS STEP THROUGH THE SCHEDULE (user direction).

        BARE arrows only. Shift+Arrow is the app's own reserved shortcut for
        stepping between teams (see lib/shortcutPrefs.RESERVED_COMBOS), and a
        modal quietly eating it would break that everywhere a game happens to be
        open. Ctrl and Alt are left alone for the same reason.

        And not while typing: the box score has no text fields today, but a
        modal that swallows arrow keys is the kind of thing that only bites once
        someone adds one.
      */
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && prevGameId !== null) {
        e.preventDefault();
        goToGame(prevGameId);
      }
      if (e.key === 'ArrowRight' && nextGameId !== null) {
        e.preventDefault();
        goToGame(nextGameId);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [state, closeGameModal, goToGame, prevGameId, nextGameId]);

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
          <div className="flex items-center gap-2">
            {/* Only where there IS a sequence. A pair of permanently dead
                arrows on a game opened from a player's profile would be worse
                than no arrows at all. */}
            {siblings.length > 1 && (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => prevGameId !== null && goToGame(prevGameId)}
                  disabled={prevGameId === null}
                  title="Previous game (←)"
                  aria-label="Previous game"
                  className={NAV_BTN}
                >
                  ‹
                </button>
                <span className="tnum px-1 text-xs text-slate-400 dark:text-slate-500">
                  {at + 1} / {siblings.length}
                </span>
                <button
                  type="button"
                  onClick={() => nextGameId !== null && goToGame(nextGameId)}
                  disabled={nextGameId === null}
                  title="Next game (→)"
                  aria-label="Next game"
                  className={NAV_BTN}
                >
                  ›
                </button>
              </span>
            )}
            <ModalCloseButton label="game box score" onClick={closeGameModal} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <GameDetailContent dynastyId={state.dynastyId} gameId={state.gameId} seasonId={state.seasonId} />
        </div>
      </div>
    </ModalOverlay>,
    document.body,
  );
}
