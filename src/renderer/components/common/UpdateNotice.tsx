import { useEffect, useState } from 'react';
import { UpdatePanel } from './UpdatePanel';
import { useUpdater } from '../../data/useUpdater';
import { getUpdatePrefs, migrateLegacyUpdatePref } from '../../lib/updatePrefs';

/** Remembers which version the user chose "Later" on, so it doesn't nag again for the same one. */
const DISMISS_KEY = 'cfbhub.dismissedUpdateVersion';

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * The quiet "there's an update" notice.
 *
 * A CARD IN THE CORNER, not a modal. This is the first thing a user sees after
 * launching, and a dialog across the middle of the window makes an optional
 * update feel like a demand — you have to deal with it before you can look at
 * your dynasty. The card says the same thing, leaves the app usable behind it,
 * and goes away for that version once dismissed.
 *
 * It appears for exactly two states: an update is available, or one has finished
 * downloading and is waiting to install. Checking, errors and "you're up to
 * date" belong in About, where someone went looking for them.
 */
export function UpdateNotice() {
  const { state } = useUpdater();
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed());

  /*
    The main process already refuses to check when this is off, so the card
    would never have anything to show — but it is read here too, so a manual
    check from About doesn't also throw a card into the corner of someone who
    asked to be left alone.

    The migration runs first and once: anyone who had turned the old
    localStorage flag off keeps that choice instead of silently getting the
    launch check back.
  */
  const [optedIn, setOptedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void migrateLegacyUpdatePref()
      .then(getUpdatePrefs)
      .then((prefs) => {
        if (!cancelled) setOptedIn(prefs.checkOnStartup);
      })
      .catch(() => {
        /* leave the card hidden rather than guessing */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Dismissing "available" shouldn't also hide the far more useful "ready to
    // install" card for the same version — that one is one click from done.
    if (state?.status === 'downloaded' && state.availableVersion === dismissed) {
      setDismissed(null);
    }
  }, [state?.status, state?.availableVersion, dismissed]);

  if (!optedIn || !state || !state.supported) return null;
  if (state.status !== 'available' && state.status !== 'downloaded') return null;
  if (state.availableVersion && state.availableVersion === dismissed) return null;

  const dismiss = () => {
    const version = state.availableVersion ?? null;
    try {
      if (version) window.localStorage.setItem(DISMISS_KEY, version);
    } catch {
      /* non-fatal — it just means we ask again next launch */
    }
    setDismissed(version);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="corner-cut fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] border border-[var(--surface-raised-border)] bg-[var(--surface-raised)] p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]"
    >
      <UpdatePanel onDismiss={dismiss} />
    </div>
  );
}
