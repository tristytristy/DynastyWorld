import { useEffect, useState } from 'react';

/**
 * SYNCING BEST PRACTICES — shown at startup until dismissed for good.
 *
 * This replaced a badge on the dashboard card that named the deadline ("sync
 * before next season"). The badge was accurate and taught the wrong lesson: a
 * deadline reads as "one sync per season is enough", and a coach who syncs only
 * at the end still loses every week of poll movement and every weekly stat line
 * along the way. Those are moments, not records — nothing recovers them.
 *
 * LEADS WITH "you never need to exit your dynasty", which is the thing most
 * people get wrong and the one that costs them the most: someone who believes
 * syncing means quitting the game will do it rarely, and every habit below
 * depends on it being cheap. The dedicated save file is the same idea one step
 * on — a stable filename is what keeps it a one-click Sync instead of an
 * Import every time.
 *
 * Kept deliberately short. This is a startup interruption, and a wall of text
 * at launch gets dismissed unread, which would leave the reader worse off than
 * a badge would have. Rules first, mechanism in one line at the end.
 */
const STORAGE_KEY = 'dynastyos.syncGuide.hidden';

export function hasDismissedSyncGuide(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // A blocked localStorage shouldn't make this modal unskippable — treat it
    // as dismissed rather than showing it on every single launch forever.
    return true;
  }
}

function rememberDismissal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Nothing to do — it simply won't persist for this session.
  }
}

/**
 * Owns the startup showing, so App doesn't have to carry state for it.
 *
 * The dismissal is read ONCE on mount rather than watched: a user who ticks the
 * box is closing the dialog in the same gesture, and re-reading would only
 * matter if something else could set the flag, which nothing does.
 */
export function SyncGuideHost() {
  const [open, setOpen] = useState(() => !hasDismissedSyncGuide());
  return <SyncGuideModal open={open} onClose={() => setOpen(false)} />;
}

export function SyncGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const close = () => {
    if (dontShowAgain) rememberDismissal();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-guide-title"
        className="corner-cut w-full max-w-xl border border-slate-300 bg-white p-7 dark:border-white/15 dark:bg-slate-900"
      >
        <p className="type-eyebrow text-slate-500 dark:text-slate-400">Best practices</p>
        <h2
          id="sync-guide-title"
          className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white"
        >
          You never need to exit your dynasty
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Advance the week, save in-game, then hit <strong className="font-semibold text-slate-900 dark:text-white">Sync</strong>.
          Leave the game running — no quitting, no re-importing.
        </p>

        <ol className="mt-5 space-y-3.5">
          {[
            {
              head: 'Keep one save file for syncing',
              body: (
                <>
                  Call it something like <span className="font-medium text-slate-900 dark:text-white">DYNASTYMASTER</span>{' '}
                  and overwrite it every time. Same filename means Sync just works — a new name
                  means importing again.
                </>
              ),
            },
            {
              head: 'Sync every week you play',
              body: <>Polls and weekly stats only exist in the save for the current week. A week you skip can&apos;t be filled in later.</>,
            },
            {
              head: 'Always sync at the End of Season Recap',
              body: <>This is what makes a season permanent: final record, bowl, trophies, awards and box scores.</>,
            },
          ].map((item, index) => (
            <li key={item.head} className="flex gap-3">
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300 text-xs font-semibold text-slate-700 dark:border-white/20 dark:text-slate-200">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">{item.head}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-600 dark:border-white/10 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Why it matters:</span> your
          save holds one season&apos;s games at a time. Once you advance to the next year, last
          season&apos;s games and stats are overwritten — only the record, ranking and titles can
          be recovered.
        </p>

        <div className="mt-7 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="h-4 w-4 accent-slate-900 dark:accent-white"
            />
            Don&apos;t show this on startup
          </label>
          <button
            type="button"
            onClick={close}
            autoFocus
            className="corner-cut-sm border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:border-white dark:bg-white dark:text-slate-900"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
