import { useEffect, useRef } from 'react';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { PlayerProfileContent } from './PlayerProfileContent';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * The single global player-profile modal, rendered once near the app root
 * (see app.tsx) and driven entirely by PlayerModalProvider's state — every
 * "click a player name" spot in the app opens the same instance rather than
 * each page owning its own modal. Layers over the current page (no route
 * change), traps focus and Tab-cycling while open, closes on Escape or the
 * close button, and returns focus to whichever element opened it.
 */
export function PlayerProfileModal() {
  const { state, closePlayerModal, goToPlayer } = usePlayerModal();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const isOpen = state !== null;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePlayerModal();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen, closePlayerModal]);

  if (!state) return null;

  const { dynastyId, playerId, seasonId, navigationIds, fallback } = state;
  const navIndex = navigationIds?.indexOf(playerId) ?? -1;
  const hasNavigation = navigationIds !== undefined && navIndex !== -1;
  const canGoPrevious = hasNavigation && navIndex > 0;
  const canGoNext = hasNavigation && navIndex < (navigationIds?.length ?? 0) - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePlayerModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Player profile"
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-[0_60px_160px_-40px_rgba(2,6,23,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            {hasNavigation && (
              <>
                <button
                  type="button"
                  onClick={() => canGoPrevious && navigationIds && goToPlayer(navigationIds[navIndex - 1])}
                  disabled={!canGoPrevious}
                  aria-label="Previous player"
                  className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => canGoNext && navigationIds && goToPlayer(navigationIds[navIndex + 1])}
                  disabled={!canGoNext}
                  aria-label="Next player"
                  className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Next →
                </button>
              </>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closePlayerModal}
            aria-label="Close player profile"
            className="border border-slate-300/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <PlayerProfileContent key={playerId} dynastyId={dynastyId} playerId={playerId} seasonId={seasonId} fallback={fallback} />
        </div>
      </div>
    </div>
  );
}
