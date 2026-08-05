/**
 * The update system's shared vocabulary — one definition of the state, used by
 * the main-process service, the preload bridge and the renderer alike.
 *
 * THE STATE LIVES IN THE MAIN PROCESS. A download can outlive a renderer reload
 * (and in development it will, every time the bundle rebuilds), so the renderer
 * asks for the current state on mount rather than assuming it starts at idle.
 * Everything here is plain data so it survives the structured clone that
 * crossing the IPC boundary performs.
 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

export interface UpdateProgress {
  /** 0-100. */
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/**
 * An error the renderer can actually show someone. Raw `Error` objects don't
 * survive IPC intact (and carry stacks and local paths we have no business
 * putting on screen), so failures are normalised into this shape at the edge.
 *
 * `recoverable` answers one question for the UI: is "Try again" worth offering?
 * A dropped connection is; a build that isn't published yet isn't.
 */
export interface UpdateError {
  code?: string;
  message: string;
  recoverable: boolean;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  progress?: UpdateProgress;
  error?: UpdateError;
  /** ISO timestamp of the last completed check, so the UI can say when it last looked. */
  lastCheckedAt?: string;
  /**
   * False in an unpackaged build. The updater has no installed app to replace
   * there, so the UI says so plainly instead of showing a broken check.
   */
  supported: boolean;
}

/**
 * The updater's user-facing settings. Deliberately one flag: downloads are
 * ALWAYS user-initiated, so there is no "download automatically" to opt out of
 * — the only thing worth a choice is whether the app looks on its own.
 */
export interface UpdatePreferences {
  /** Check GitHub shortly after launch. Off means no request at all; the manual check in About still works. */
  checkOnStartup: boolean;
}
