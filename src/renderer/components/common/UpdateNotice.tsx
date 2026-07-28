import { useEffect, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { Markdown } from '../ui/Markdown';
import { getCheckUpdatesOnStartup } from '../../lib/updatePrefs';
import type { UpdateCheckResult } from '../../../shared/types';

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
 * Quiet, once-per-launch update check. On mount it asks the main process (which
 * polls the GitHub Releases API); if a newer version exists AND the user hasn't
 * already dismissed that exact version, a modal offers the download. Any failure
 * (offline, rate-limited) is swallowed — this never interrupts a normal launch.
 * The manual "Check for updates" button in the About panel is the always-on path.
 */
export function UpdateNotice() {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getCheckUpdatesOnStartup()) return; // user turned off the launch check (About panel still checks manually)
    let cancelled = false;
    window.api.update
      .check()
      .then((r) => {
        if (cancelled || !r.updateAvailable || !r.latest) return;
        if (r.latest === readDismissed()) return;
        setResult(r);
        setOpen(true);
      })
      .catch(() => {
        /* stay silent on any check failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!result) return null;

  const dismiss = () => {
    try {
      if (result.latest) window.localStorage.setItem(DISMISS_KEY, result.latest);
    } catch {
      /* non-fatal */
    }
    setOpen(false);
  };

  const download = () => {
    if (result.url) window.api.update.openDownload(result.url);
    dismiss();
  };

  return (
    <CenteredModalPanel open={open} onClose={dismiss} widthRem={26} eyebrow="Update available" title={`Version ${result.latest} is out`}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          You&apos;re on v{result.current}. A newer version is available — download it and run the installer to update.
        </p>
        {result.notes ? (
          // Rendered as Markdown rather than raw text — GitHub release bodies are
          // written in it, and the hashes and asterisks read as noise otherwise.
          // The cap is a sanity bound on remote input, not a display choice; it's
          // generous enough that real notes are never cut.
          <div className="max-h-56 overflow-y-auto border border-slate-200/70 bg-slate-50/70 p-3 text-xs leading-5 text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-slate-400">
            <Markdown source={result.notes.slice(0, 20000)} />
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Later
          </button>
          <button
            type="button"
            onClick={download}
            className="border border-[var(--team-primary)] bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:opacity-90"
          >
            Download
          </button>
        </div>
      </div>
    </CenteredModalPanel>
  );
}
