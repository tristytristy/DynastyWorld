import { useState } from 'react';
import { Markdown } from '../ui/Markdown';
import { useUpdater } from '../../data/useUpdater';
import { formatReleaseDate, formatSpeed, formatTransferred } from '../../lib/updateFormat';

const PRIMARY_BTN =
  'shrink-0 border border-[var(--team-primary)] bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:opacity-90 disabled:opacity-60';
const SECONDARY_BTN =
  'shrink-0 border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800';

/**
 * BACK UP BEFORE YOU UPDATE — offered, and one click.
 *
 * An update is the only routine action that can change the database out from
 * under someone: the new build may carry migrations, and they run on its first
 * launch, after the app that could have warned you is gone. The install path
 * already takes a checkpoint automatically (updateService.ts); this is the same
 * checkpoint offered up front, because a user who has just been told an update
 * is waiting should be able to take one deliberately and SEE that it worked.
 *
 * The wording is a recommendation rather than a warning. Updating is safe and
 * we want people to do it — a red caution here would cost more installs than it
 * would ever save archives, and the automatic checkpoint means declining this
 * is not the dangerous choice it would otherwise be.
 *
 * "Already up to date" is a success, not a no-op: backupDatabase fingerprints
 * the archive and writes nothing when it hasn't changed, which means a good
 * checkpoint already exists. Saying "nothing to do" would read as failure.
 */
function BackupBeforeUpdate() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'saved' | 'current' | 'failed' | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const res = await window.api.update.backupNow();
      setDone(!res.ok ? 'failed' : res.wrote ? 'saved' : 'current');
    } catch {
      setDone('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 pt-3 dark:border-white/10">
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Back up first.</span>{' '}
        Recommended before any update — it saves a full copy of every dynasty, and takes a moment.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={run} disabled={busy} className={SECONDARY_BTN}>
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
        {done === 'saved' && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Backup saved.</span>
        )}
        {done === 'current' && (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Your backup is already up to date.
          </span>
        )}
        {done === 'failed' && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Couldn&apos;t save a backup — you can still update.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The whole update experience, in one panel that reads the main process's
 * state and shows the one thing that matters right now.
 *
 * It is a single component rather than one per state on purpose: the states are
 * a sequence a user walks through in about a minute, and splitting them across
 * files would scatter that sequence for no benefit. Everything it draws comes
 * from the app's existing surfaces — same buttons, same eyebrow type, same
 * hairlines — so an update never looks like a different program talking.
 */
export function UpdatePanel({ onDismiss }: { onDismiss?: () => void } = {}) {
  const { state, check, download, install } = useUpdater();

  if (!state) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading update status…</p>;
  }

  // An unpackaged build has no installed app to replace. Say that once, plainly,
  // instead of letting a developer watch a check fail every launch.
  if (!state.supported) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-slate-600 dark:text-slate-300">Automatic updates are available in packaged builds.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Running v{state.currentVersion} from source.</p>
      </div>
    );
  }

  const progress = state.progress;
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
  const speed = progress ? formatSpeed(progress.bytesPerSecond) : null;
  const releaseDate = formatReleaseDate(state.releaseDate);

  return (
    <div className="space-y-4">
      {/* ---------- what version am I on, and when did we last look ---------- */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Updates</p>
        <p className="tnum text-xs text-slate-400 dark:text-slate-500">Installed v{state.currentVersion}</p>
      </div>

      {/* ---------- idle / not-available ---------- */}
      {(state.status === 'idle' || state.status === 'not-available') && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {state.status === 'not-available' ? 'DynastyOS is up to date.' : 'See if a newer version is available.'}
            </p>
            {state.lastCheckedAt && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Last checked {new Date(state.lastCheckedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <button type="button" onClick={check} className={SECONDARY_BTN}>
            Check for updates
          </button>
        </div>
      )}

      {/* ---------- checking ---------- */}
      {state.status === 'checking' && (
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--team-primary)] dark:border-slate-700"
          />
          <p className="text-sm text-slate-600 dark:text-slate-300">Checking for updates…</p>
        </div>
      )}

      {/* ---------- available: the only state with a download button ---------- */}
      {state.status === 'available' && (
        <div className="space-y-3">
          <div>
            <p className="font-display text-base font-semibold text-slate-950 dark:text-white">
              DynastyOS {state.availableVersion} is ready to download.
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              You have v{state.currentVersion}
              {releaseDate ? ` · released ${releaseDate}` : ''}
            </p>
          </div>
          {state.releaseNotes && <ReleaseNotes notes={state.releaseNotes} />}
          <BackupBeforeUpdate />
          <div className="flex items-center gap-2">
            <button type="button" onClick={download} className={PRIMARY_BTN}>
              Update DynastyOS
            </button>
            {onDismiss && (
              <button type="button" onClick={onDismiss} className={SECONDARY_BTN}>
                Later
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------- downloading ---------- */}
      {state.status === 'downloading' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-700 dark:text-slate-200">Downloading update…</p>
          <div
            className="h-1.5 w-full overflow-hidden bg-slate-200 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Update download progress"
          >
            {/* Width is the only thing that animates — a transition on a bar
                that updates several times a second is the difference between
                smooth and twitchy. */}
            <div
              className="h-full bg-[var(--team-primary)] transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="tnum">
              {progress ? formatTransferred(progress.transferred, progress.total) : 'Starting…'}
            </span>
            <span className="tnum">
              {percent}%{speed ? ` · ${speed}` : ''}
            </span>
          </div>
        </div>
      )}

      {/* ---------- downloaded: installation is still the user's call ---------- */}
      {state.status === 'downloaded' && (
        <div className="space-y-3">
          <div>
            <p className="font-display text-base font-semibold text-slate-950 dark:text-white">Ready to install</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              DynastyOS {state.availableVersion} will close, install, and reopen automatically.
            </p>
          </div>
          {/* A refused install (something was still writing) lands here with a
              reason, and the button stays live so it can simply be retried. */}
          {state.error && (
            <p className="border-l-2 border-amber-400 pl-3 text-sm text-amber-700 dark:text-amber-400">
              {state.error.message}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={install} className={PRIMARY_BTN}>
              Restart and Update
            </button>
            {onDismiss && (
              <button type="button" onClick={onDismiss} className={SECONDARY_BTN}>
                Later
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------- installing ---------- */}
      {state.status === 'installing' && (
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--team-primary)] dark:border-slate-700"
          />
          <p className="text-sm text-slate-600 dark:text-slate-300">Preparing DynastyOS update…</p>
        </div>
      )}

      {/* ---------- error ---------- */}
      {state.status === 'error' && state.error && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">{state.error.message}</p>
          <div className="flex items-center gap-2">
            {state.error.recoverable && (
              <button type="button" onClick={check} className={SECONDARY_BTN}>
                Try again
              </button>
            )}
            {onDismiss && (
              <button type="button" onClick={onDismiss} className={SECONDARY_BTN}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Release notes, kept visually secondary to the button they sit above and
 * capped in height so a chatty release can't push the action off screen.
 * `Markdown` parses to React elements rather than HTML, so notes fetched from
 * GitHub can never inject anything into a privileged renderer.
 */
function ReleaseNotes({ notes }: { notes: string }) {
  return (
    <div className="max-h-40 overflow-y-auto border-t border-slate-200/70 pt-3 text-sm leading-6 text-slate-600 dark:border-white/5 dark:text-slate-300">
      <Markdown source={notes} />
    </div>
  );
}
