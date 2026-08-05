/**
 * A count of the long jobs currently running in the main process.
 *
 * The updater needs one question answered before it closes the app to install:
 * *is anything still in flight?* The database can answer for its own writes
 * (`isDatabaseWriteInProgress`), but an import spends most of its time reading a
 * 10 MB save file, a backup spends it zipping, and an export spends it writing
 * HTML — none of which the database knows about, and all of which would be
 * abandoned half-done by a restart.
 *
 * Deliberately a counter and a label rather than a full job system: the only
 * consumer needs "how many, and what should I call the one I'm waiting on".
 */

export type TaskKind = 'import' | 'sync' | 'backup' | 'restore' | 'export' | 'media';

/** How each kind reads in a sentence the user sees ("DynastyOS is still importing a dynasty."). */
const TASK_LABELS: Record<TaskKind, string> = {
  import: 'importing a dynasty',
  sync: 'syncing a dynasty',
  backup: 'creating a backup',
  restore: 'restoring a backup',
  export: 'writing an export',
  media: 'importing media',
};

const active = new Map<number, TaskKind>();
let nextToken = 1;

/** Marks a long job as started. Always pair with `endTask` in a `finally`. */
export function beginTask(kind: TaskKind): number {
  const token = nextToken++;
  active.set(token, kind);
  return token;
}

export function endTask(token: number): void {
  active.delete(token);
}

/**
 * Runs a long job with the registry updated around it, including when it
 * throws — a failed import still has to release the lock, or the app can never
 * be updated again without a restart.
 */
export async function withTask<T>(kind: TaskKind, fn: () => Promise<T>): Promise<T> {
  const token = beginTask(kind);
  try {
    return await fn();
  } finally {
    endTask(token);
  }
}

export function hasActiveTasks(): boolean {
  return active.size > 0;
}

/** A human-readable description of what's running, for the "can't update yet" message. */
export function describeActiveTasks(): string | null {
  const kinds = [...new Set(active.values())];
  if (kinds.length === 0) return null;
  const labels = kinds.map((kind) => TASK_LABELS[kind]);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
