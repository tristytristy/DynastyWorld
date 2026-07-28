import { app } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Carries a user's data across the CFB Dynasty Hub → DynastyOS rename.
 *
 * Electron derives the userData folder from the app's name, so renaming the app
 * silently repoints it at a brand-new empty directory. Every dynasty, photo,
 * card image, backup and setting would still be sitting safely on disk under
 * the old name while the app insists the user has never imported anything —
 * the single worst failure this rebrand could produce, and one that looks
 * exactly like catastrophic data loss to the person it happens to.
 *
 * So before anything touches userData, an old folder is moved to the new one.
 *
 * Deliberate choices:
 *   - **Rename, not copy.** A copy would double a library that can run to
 *     gigabytes, and leave two diverging archives where the user can't tell
 *     which is live. Rename is atomic on the same volume; if it fails (which it
 *     can, across drives or with a file locked), it falls back to a recursive
 *     copy and leaves the original alone as a safety net.
 *   - **Only when the destination is absent or empty.** If DynastyOS data
 *     already exists, that's the real archive and the old folder is history —
 *     never overwrite it.
 *   - **Never destructive on failure.** Any error leaves the old folder intact
 *     and simply lets the app start fresh, which is recoverable. The user's
 *     data is never the thing that gets sacrificed to a failed migration.
 */

/** Folder names Electron would have used, oldest first. Derived from the app name at the time. */
const LEGACY_APP_DIR_NAMES = ['cfb-dynasty-hub'];

/** Files that mean a userData folder holds real work rather than Chromium scaffolding. */
const MEANINGFUL_ENTRIES = ['dynasty-archive.sqlite', 'media', 'card-photos', 'backups'];

function holdsRealData(dir: string): boolean {
  try {
    return MEANINGFUL_ENTRIES.some((name) => fs.existsSync(path.join(dir, name)));
  } catch {
    return false;
  }
}

function copyRecursive(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyRecursive(src, dest);
    else if (entry.isFile()) fs.copyFileSync(src, dest);
  }
}

export interface MigrationOutcome {
  migrated: boolean;
  from?: string;
  to?: string;
  method?: 'rename' | 'copy';
  error?: string;
}

/**
 * Must run BEFORE `requestSingleInstanceLock()` and before any code reads
 * userData — the lock itself is taken against that folder.
 */
export function migrateLegacyUserData(): MigrationOutcome {
  let target: string;
  try {
    target = app.getPath('userData');
  } catch {
    return { migrated: false };
  }

  // Already have real data here? Then this install is the live one; leave it be.
  if (holdsRealData(target)) return { migrated: false };

  const parent = path.dirname(target);
  for (const legacyName of LEGACY_APP_DIR_NAMES) {
    const source = path.join(parent, legacyName);
    if (path.resolve(source) === path.resolve(target)) continue;
    if (!holdsRealData(source)) continue;

    try {
      // The destination may exist as an empty Chromium-created shell; a rename
      // onto it would fail, so clear it first (nothing of value is in it — we
      // just proved it holds no real data).
      if (fs.existsSync(target)) {
        try {
          fs.rmSync(target, { recursive: true, force: true });
        } catch {
          // Locked by something — the copy fallback below still works.
        }
      }
      fs.renameSync(source, target);
      return { migrated: true, from: source, to: target, method: 'rename' };
    } catch {
      // Cross-volume, or a locked handle. Copy instead and KEEP the original:
      // a duplicate costs disk space, a failed move costs someone their dynasty.
      try {
        copyRecursive(source, target);
        return { migrated: true, from: source, to: target, method: 'copy' };
      } catch (err) {
        return { migrated: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }

  return { migrated: false };
}
