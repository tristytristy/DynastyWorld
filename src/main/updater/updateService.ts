import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../../shared/ipcChannels';
import type { UpdateError, UpdateState, UpdateStatus } from '../../shared/updateTypes';
import { backupDatabase, flushPendingWrites, isDatabaseWriteInProgress } from '../../database/init';
import { describeActiveTasks, hasActiveTasks } from './taskRegistry';
import { getUpdatePreferences } from './updatePrefs';

/**
 * THE UPDATER, and the one place that owns its state.
 *
 * electron-updater does the transport (it reads the same `publish` block
 * electron-builder wrote into the package, fetches `latest.yml`, downloads the
 * installer, verifies its hash and runs it). Everything above that — what state
 * we are in, whether an action is allowed right now, and whether it is safe to
 * close the app — lives here.
 *
 * WHY STATE LIVES IN MAIN: a download takes a minute and a renderer can reload
 * inside that minute (a dev rebuild, a crash, F5). If the renderer owned the
 * state, the progress bar would come back at 0% while the download continued
 * invisibly. The renderer asks for the current state when it mounts and then
 * listens for pushes; it never holds the truth.
 */

const CHECK_COOLDOWN_MS = 60_000;
/** Log progress at most this often — the event fires many times a second. */
const PROGRESS_LOG_INTERVAL_MS = 2000;

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  // An unpackaged build has no installed application to replace, and pointing
  // the updater at a dev tree produces confusing "app-update.yml not found"
  // errors. The UI says so plainly instead.
  supported: app.isPackaged,
};

let lastCheckStartedAt = 0;
let lastProgressLogAt = 0;
let wired = false;

function log(message: string, ...rest: unknown[]): void {
  // Deliberately plain console logging, matching the rest of the main process.
  // Nothing here prints a token, a path inside the user's profile, or anything
  // out of a dynasty — only versions, states and byte counts.
  console.log(`[updater] ${message}`, ...rest);
}

/** Pushes the current state to every open window. Renderers re-render from this, never from their own guesses. */
function publish(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.update.state, state);
  }
}

function setState(next: Partial<UpdateState>): void {
  state = { ...state, ...next };
  publish();
}

function setStatus(status: UpdateStatus, extra: Partial<UpdateState> = {}): void {
  setState({ status, ...extra });
}

/**
 * Turns anything thrown into something safe to show.
 *
 * electron-updater's errors carry stacks, local file paths and occasionally the
 * whole HTTP response; none of that belongs on screen. The mapping is by
 * substring because the library doesn't expose stable codes for these cases.
 */
function toUpdateError(err: unknown): UpdateError {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');

  if (/net::|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(raw)) {
    return {
      code: 'network',
      message: "DynastyOS couldn't reach GitHub. Check your internet connection and try again.",
      recoverable: true,
    };
  }
  if (/404|Cannot find .*latest\.yml|No published versions/i.test(raw)) {
    return {
      code: 'no-feed',
      message: 'No update information has been published yet. Try again once a release is available.',
      recoverable: false,
    };
  }
  if (/rate limit/i.test(raw)) {
    return {
      code: 'rate-limited',
      message: 'GitHub is temporarily rate-limiting update checks. Try again in a few minutes.',
      recoverable: true,
    };
  }
  if (/sha512|checksum|integrity/i.test(raw)) {
    return {
      code: 'corrupt',
      message: 'The downloaded update failed its integrity check and was discarded. Try downloading again.',
      recoverable: true,
    };
  }
  if (/ENOSPC|not enough space/i.test(raw)) {
    return {
      code: 'disk-space',
      message: "There isn't enough free disk space to download the update.",
      recoverable: true,
    };
  }
  if (/EPERM|EACCES|access is denied/i.test(raw)) {
    return {
      code: 'permission',
      message: "Windows blocked the update file. Check your antivirus or run DynastyOS again, then retry.",
      recoverable: true,
    };
  }
  return {
    code: 'unknown',
    message: 'The update could not be completed. Please try again.',
    recoverable: true,
  };
}

/** Release notes arrive as a string or as a list of per-version blocks; both are flattened to plain markdown text. */
function normalizeNotes(notes: unknown): string | null {
  if (typeof notes === 'string') return notes.trim() || null;
  if (Array.isArray(notes)) {
    const joined = notes
      .map((entry) =>
        entry && typeof entry === 'object' && 'note' in entry ? String((entry as { note?: string }).note ?? '') : '',
      )
      .filter(Boolean)
      .join('\n\n')
      .trim();
    return joined || null;
  }
  return null;
}

function wireAutoUpdater(): void {
  if (wired) return;
  wired = true;

  // The app asks for both explicitly: nothing downloads without a click, and
  // nothing installs behind the user's back on quit.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    log('check started', { current: state.currentVersion });
    setStatus('checking', { error: undefined });
  });

  autoUpdater.on('update-available', (info) => {
    log('update available', { version: info.version });
    setStatus('available', {
      availableVersion: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: normalizeNotes(info.releaseNotes),
      lastCheckedAt: new Date().toISOString(),
      error: undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    log('no update available', { current: state.currentVersion });
    setStatus('not-available', {
      availableVersion: undefined,
      lastCheckedAt: new Date().toISOString(),
      error: undefined,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const now = Date.now();
    if (now - lastProgressLogAt > PROGRESS_LOG_INTERVAL_MS) {
      lastProgressLogAt = now;
      log('download progress', { percent: Math.round(progress.percent) });
    }
    setStatus('downloading', {
      progress: {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('download complete', { version: info.version });
    setStatus('downloaded', {
      availableVersion: info.version,
      releaseNotes: normalizeNotes(info.releaseNotes) ?? state.releaseNotes ?? null,
      progress: undefined,
    });
  });

  autoUpdater.on('error', (err) => {
    const safe = toUpdateError(err);
    log('error', { code: safe.code });
    setStatus('error', { error: safe, progress: undefined });
  });
}

export function getUpdateState(): UpdateState {
  return state;
}

/**
 * Checks GitHub for a newer release.
 *
 * `silent` is the automatic post-launch check: it does the same work but leaves
 * the state alone when there is nothing to report, so a quiet launch doesn't
 * flash "up to date" at someone who never asked.
 */
export async function checkForUpdates(options: { silent?: boolean } = {}): Promise<UpdateState> {
  if (!state.supported) {
    log('check skipped — unpackaged build');
    return state;
  }
  // Already busy with something that supersedes a check.
  if (state.status === 'checking' || state.status === 'downloading' || state.status === 'installing') {
    return state;
  }
  // A cooldown, so a double-click or a re-mounting panel can't hammer GitHub.
  const now = Date.now();
  if (now - lastCheckStartedAt < CHECK_COOLDOWN_MS && state.status !== 'error') {
    return state;
  }
  lastCheckStartedAt = now;

  wireAutoUpdater();
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const safe = toUpdateError(err);
    log('check failed', { code: safe.code });
    // A silent background check that fails should not paint an error over a
    // window the user is working in; it just leaves the state as it was.
    if (!options.silent) setStatus('error', { error: safe });
  }
  return state;
}

/** Starts the download. Only legal from `available` (or after a failed attempt). */
export async function downloadUpdate(): Promise<UpdateState> {
  if (!state.supported) return state;
  if (state.status === 'downloading' || state.status === 'downloaded' || state.status === 'installing') {
    return state;
  }
  if (state.status !== 'available' && state.status !== 'error') return state;

  wireAutoUpdater();
  log('download started', { version: state.availableVersion });
  setStatus('downloading', {
    progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
    error: undefined,
  });
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const safe = toUpdateError(err);
    log('download failed', { code: safe.code });
    setStatus('error', { error: safe, progress: undefined });
  }
  return state;
}

/**
 * THE PRE-INSTALL SHUTDOWN. Everything that could still be mid-write gets its
 * chance to finish before the installer is allowed anywhere near the app.
 *
 * It refuses rather than waits: a backup of a large dynasty can run for a
 * minute, and silently hanging the update on it is worse than saying "not
 * yet". The user keeps a working app and a clear reason either way.
 */
function prepareForInstall(): { ok: true } | { ok: false; error: UpdateError } {
  const busy = describeActiveTasks();
  if (hasActiveTasks() && busy) {
    return {
      ok: false,
      error: {
        code: 'busy',
        message: `DynastyOS is still ${busy}. Let it finish, then install the update.`,
        recoverable: true,
      },
    };
  }

  if (isDatabaseWriteInProgress()) {
    return {
      ok: false,
      error: {
        code: 'db-busy',
        message: 'DynastyOS is still saving your archive. Wait a moment and try again.',
        recoverable: true,
      },
    };
  }

  try {
    // Anything a batch left unflushed goes to disk now. Normally a no-op —
    // `withBatchedPersist` flushes in its own `finally` — but this is the last
    // moment it can ever happen, so it is worth the microsecond.
    flushPendingWrites();
  } catch (err) {
    log('safe shutdown failed', { message: err instanceof Error ? err.message : 'unknown' });
    return {
      ok: false,
      error: {
        code: 'save-failed',
        message:
          'DynastyOS could not finish saving the active dynasty. The update was not installed. Please try again.',
        recoverable: true,
      },
    };
  }

  return { ok: true };
}

/**
 * Installs the downloaded update and relaunches.
 *
 * `quitAndInstall(false, true)`: the first argument leaves the NSIS installer
 * visible rather than fully silent (an unsigned installer that flashes past can
 * look like nothing happened, and a silent failure has nowhere to report), and
 * the second relaunches DynastyOS afterwards. The installer's own
 * `runAfterFinish` is off for the same reason — one relaunch, owned here.
 */
export function installUpdate(): UpdateState {
  if (!state.supported) return state;
  if (state.status !== 'downloaded') return state;

  log('installation requested', { version: state.availableVersion });
  setStatus('installing');

  const ready = prepareForInstall();
  if (!ready.ok) {
    log('safe shutdown refused', { code: ready.error.code });
    // Back to `downloaded`: the update is still on disk and still installable
    // the moment whatever is running finishes.
    setStatus('downloaded', { error: ready.error });
    return state;
  }
  log('safe shutdown ok — quitting to install');

  // Deferred a tick so this IPC call returns and the renderer can paint its
  // "installing" state before the window starts tearing down.
  setTimeout(() => {
    void (async () => {
      /*
        A FULL-ARCHIVE CHECKPOINT, TAKEN AT THE LAST MOMENT IT IS STILL THIS
        VERSION'S ARCHIVE.

        An update is the one routine action that can change the database out
        from under someone: the new build may carry migrations, and those run on
        its first launch, after this process is gone. If anything about that goes
        wrong the user has already replaced the only app that could have told
        them. So the safety net is taken HERE — after the shutdown check passed,
        before the installer runs.

        Cheap and self-limiting: backupDatabase() fingerprints the archive and
        returns null without writing when nothing has changed since the last
        checkpoint, so updating twice in a row doesn't stack copies, and old
        ones are pruned elsewhere.

        Failure never blocks the update. A user who chose to update should get
        the update; losing the checkpoint is worth a log line, not a refusal.
      */
      try {
        const checkpoint = await backupDatabase();
        log(checkpoint ? 'pre-update checkpoint written' : 'pre-update checkpoint skipped (archive unchanged)');
      } catch (err) {
        log('pre-update checkpoint failed — continuing with the update', {
          message: err instanceof Error ? err.message : String(err),
        });
      }

      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        const safe = toUpdateError(err);
        log('install failed', { code: safe.code });
        setStatus('error', { error: safe });
      }
    })();
  }, 400);

  return state;
}

/**
 * The quiet check a few seconds after launch. Packaged builds only, once per
 * session, and it never downloads on its own — finding an update just moves the
 * state to `available` so the UI can mention it.
 */
export function scheduleStartupCheck(delayMs = 6000): void {
  if (!app.isPackaged) return;
  /*
    THE PREFERENCE IS ENFORCED HERE, not in the UI. "Check for updates on
    startup", turned off, has to mean no network request — not a request whose
    result is quietly hidden. The manual check in About stays available either
    way, because asking is different from being asked.
  */
  if (!getUpdatePreferences().checkOnStartup) {
    log('startup check skipped — turned off in Preferences');
    return;
  }
  setTimeout(() => {
    void checkForUpdates({ silent: true });
  }, delayMs);
}
