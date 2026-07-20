import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGameModal } from '../../data/GameModalProvider';
import { GameDetailContent } from '../../pages/GameDetail';

/**
 * Global game box-score modal. Renders the full GameDetailContent inside a
 * portaled overlay so a game opens over Schedule (or a media tag) and closes
 * back to it — the two-level IA rule: menus stop at the sub-tab, everything
 * finer is a modal. Portaled to body because surrounding cards use
 * backdrop-blur (a containing block that would trap a fixed child).
 */
export function GameDetailModal() {
  const { state, closeGameModal } = useGameModal();

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeGameModal();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [state, closeGameModal]);

  if (!state) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-start md:p-8"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeGameModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Game box score"
        className="corner-cut relative w-full max-w-5xl border border-white/70 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game box score</p>
          <button
            type="button"
            onClick={closeGameModal}
            aria-label="Close game box score"
            className="border border-slate-300/80 bg-white/85 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="p-5 md:p-6">
          <GameDetailContent dynastyId={state.dynastyId} gameId={state.gameId} seasonId={state.seasonId} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
