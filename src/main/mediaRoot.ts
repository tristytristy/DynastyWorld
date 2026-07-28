import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { MediaLibraryMoveResult, MediaLibraryStatus } from '../shared/types';

/**
 * Resolves where a user's OWN uploaded media (Media Hub photos/videos) lives on
 * disk. Distinct from assetRoot.ts, which locates the shipped image-data
 * library (portraits/logos/trophies) — that's app content, this is the user's
 * irreplaceable screenshots.
 *
 * Default is `userData/media`, which works with zero setup but is buried in
 * AppData where nobody browses. Users reasonably want their shots somewhere
 * they can actually get at (Pictures, a NAS, a synced Dropbox/OneDrive folder),
 * so the root is user-settable and stored in `media-config.json` next to the
 * asset config.
 *
 * The layout inside the root is unchanged either way — one folder per dynasty
 * id, files named `<timestamp>-<rand>-<original name>` — so a library can be
 * moved between roots (or hand-copied to another machine) intact.
 */

function configPath(): string {
  return path.join(app.getPath('userData'), 'media-config.json');
}

function readConfig(): { mediaPath?: string } {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')) as { mediaPath?: string };
  } catch {
    return {};
  }
}

function writeConfig(mediaPath: string | null): void {
  const cfg = readConfig();
  if (mediaPath) cfg.mediaPath = mediaPath;
  else delete cfg.mediaPath;
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  cachedRoot = undefined;
}

// Resolved on nearly every media list/upload/delete call, so cache it; the
// setters below invalidate.
let cachedRoot: string | undefined;

export function defaultMediaRoot(): string {
  return path.join(app.getPath('userData'), 'media');
}

/** The active media library root — the user's folder if set, else the AppData default. */
export function getMediaRoot(): string {
  if (cachedRoot === undefined) {
    cachedRoot = readConfig().mediaPath || defaultMediaRoot();
  }
  return cachedRoot;
}

export function getMediaLibraryStatus(): MediaLibraryStatus {
  const root = getMediaRoot();
  const fallback = defaultMediaRoot();
  return {
    path: root,
    isDefault: root === fallback,
    exists: fs.existsSync(root),
    defaultPath: fallback,
  };
}

/** True if `child` is the same as, or nested inside, `parent`. */
function isSameOrInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Everything the app owns under a root: one folder per dynasty, files directly
 * inside it. Deliberately shallow — anything else the user keeps in that folder
 * is none of our business and is never moved or deleted.
 */
function ownedFiles(root: string): { dynastyDir: string; fileName: string }[] {
  if (!fs.existsSync(root)) return [];
  const out: { dynastyDir: string; fileName: string }[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(root, entry.name), { withFileTypes: true })) {
      if (file.isFile()) out.push({ dynastyDir: entry.name, fileName: file.name });
    }
  }
  return out;
}

/**
 * Points the library at `newRoot`, carrying the existing files across.
 *
 * Copy-everything-then-commit, deliberately: the config only flips after every
 * file has landed, and a failure part-way cleans up what it copied and leaves
 * the old folder as the live one. A half-moved library that the app has already
 * started writing into would be genuinely hard to unpick, so the move is
 * all-or-nothing.
 *
 * A destination file that already exists is treated as already-moved and
 * skipped, not overwritten — names carry a timestamp + random suffix, so a
 * collision means it's the same file (e.g. re-selecting a folder used before).
 */
export function moveMediaLibrary(newRoot: string): MediaLibraryMoveResult {
  const oldRoot = getMediaRoot();

  if (path.resolve(newRoot) === path.resolve(oldRoot)) {
    return { status: getMediaLibraryStatus(), movedFiles: 0 };
  }
  // Nesting either way would mean walking a tree while writing into it.
  if (isSameOrInside(newRoot, oldRoot) || isSameOrInside(oldRoot, newRoot)) {
    return {
      status: getMediaLibraryStatus(),
      movedFiles: 0,
      error: 'Pick a folder that isn’t inside your current media folder (or vice versa).',
    };
  }

  const files = ownedFiles(oldRoot);
  const copied: string[] = [];
  try {
    fs.mkdirSync(newRoot, { recursive: true });
    for (const { dynastyDir, fileName } of files) {
      const destDir = path.join(newRoot, dynastyDir);
      const dest = path.join(destDir, fileName);
      if (fs.existsSync(dest)) continue;
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(path.join(oldRoot, dynastyDir, fileName), dest);
      copied.push(dest);
    }
  } catch (err) {
    // Roll back only what this call created; anything already in the target
    // folder beforehand is left exactly as it was.
    for (const p of copied) {
      try {
        fs.unlinkSync(p);
      } catch {
        // Best effort — a leftover copy costs disk space, nothing more.
      }
    }
    return {
      status: getMediaLibraryStatus(),
      movedFiles: 0,
      error: `Couldn’t copy your media there: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Commit: the new folder is now the live one. Landing back on the built-in
  // default clears the setting entirely rather than pinning the same path.
  writeConfig(path.resolve(newRoot) === path.resolve(defaultMediaRoot()) ? null : newRoot);

  // Clean up the originals. Past the commit point a failure here is cosmetic
  // (duplicate files left behind), never data loss, so it must not fail the move.
  for (const { dynastyDir, fileName } of files) {
    try {
      fs.unlinkSync(path.join(oldRoot, dynastyDir, fileName));
    } catch {
      // ignore
    }
  }
  for (const entry of new Set(files.map((f) => f.dynastyDir))) {
    try {
      fs.rmdirSync(path.join(oldRoot, entry));
    } catch {
      // Non-empty (user's own files in there) — leave it alone.
    }
  }

  return { status: getMediaLibraryStatus(), movedFiles: copied.length };
}

/** Moves the library back to the built-in AppData folder. */
export function resetMediaLibrary(): MediaLibraryMoveResult {
  return moveMediaLibrary(defaultMediaRoot());
}
