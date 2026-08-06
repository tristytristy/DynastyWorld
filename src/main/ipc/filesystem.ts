import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import { peekSave } from '../../extractors/peek-save';
import type { SaveFileInfo, SavePeek } from '../../shared/types';

function savesConfigPath(): string {
  return path.join(app.getPath('userData'), 'saves-config.json');
}

/** The remembered saves folder, or the game's standard Documents location. */
export function getSavesDir(): string {
  try {
    const saved = (JSON.parse(fsSync.readFileSync(savesConfigPath(), 'utf8')) as { savesPath?: string }).savesPath;
    if (saved) return saved;
  } catch {
    // No config yet, or unreadable — fall through to the default.
  }
  return path.join(app.getPath('documents'), 'EA SPORTS College Football 27', 'saves');
}

export function registerFilesystemHandlers(): void {
  ipcMain.handle(IPC.fs.selectFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a DYNASTY save file',
      properties: ['openFile'],
      // Real save files (e.g. "DYNASTY-DYNASTYBOWL") carry no literal ".DYNASTY"
      // extension despite the name, so an extension-based filter never matches
      // them — confirmed directly against real saves folders. A single "All
      // Files" filter (not a second option alongside it) is deliberate: with
      // two filters present, Windows' native dialog remembers the last-picked
      // filter *by position* across app runs, so reordering two filters (tried
      // first) doesn't reliably change what shows by default — only removing
      // the second option does.
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  /**
   * Where the game keeps its saves. The standard Documents location is right
   * for nearly everyone, but a user who has moved it (or plays from another
   * drive) shouldn't have to re-find it every time — so a folder chosen once is
   * remembered.
   */
  ipcMain.handle(IPC.fs.getDefaultSavesDir, async () => getSavesDir());

  ipcMain.handle(IPC.fs.chooseSavesFolder, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Where are your College Football saves?',
      buttonLabel: 'Use this folder',
      defaultPath: getSavesDir(),
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const chosen = result.filePaths[0];
    try {
      fsSync.writeFileSync(savesConfigPath(), JSON.stringify({ savesPath: chosen }, null, 2));
    } catch (err) {
      console.error('[saves] could not remember that folder:', err);
    }
    return chosen;
  });

  /**
   * Finds the dynasty saves in a folder.
   *
   * Matches the `DYNASTY-` PREFIX, not a `.DYNASTY` extension — the previous
   * check looked for the latter and could never match anything, since real
   * saves carry no extension at all (a comment in this very file said as much;
   * nothing called the handler, so the contradiction went unnoticed). A real
   * folder looks like:
   *
   *   DYNASTY-EVANZSYNC                        <- the save
   *   DYNASTY-EVANZSYNC-AUTOSAVE               <- the game's autosave
   *   DYNASTY-EVANZSYNC.backup-1785126169311   <- a backup
   *   PROFILE-COLLEGE, ROSTER-Official, TEAMBUILDER-001
   *
   * The prefix drops the last line entirely; the three variants of one dynasty
   * are grouped under it so the picker shows ONE row per dynasty, with older
   * versions available but out of the way.
   */
  ipcMain.handle(IPC.fs.scanForSaves, async (_event, dirPath: string): Promise<SaveFileInfo[]> => {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const saves: SaveFileInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toUpperCase().startsWith('DYNASTY-')) continue;

      const filePath = path.join(dirPath, entry.name);
      try {
        const stats = await fs.stat(filePath);
        saves.push({
          path: filePath,
          name: entry.name,
          modifiedAt: stats.mtime.toISOString(),
          bytes: stats.size,
          ...classifySave(entry.name),
        });
      } catch {
        // File was removed or became inaccessible between readdir and stat; skip it.
      }
    }

    // Newest first within a dynasty, and dynasties by most recently played.
    return saves.sort((a, b) => a.slug.localeCompare(b.slug) || b.modifiedAt.localeCompare(a.modifiedAt));
  });

  ipcMain.handle(IPC.fs.peekSave, async (_event, filePath: string): Promise<SavePeek | null> => {
    return peekSave(filePath);
  });
}

/**
 * Splits `DYNASTY-EVANZSYNC-AUTOSAVE` into the dynasty it belongs to
 * (`EVANZSYNC`) and what kind of copy it is. Grouping on the slug is what lets
 * one dynasty occupy one row instead of three.
 */
function classifySave(fileName: string): { slug: string; kind: 'main' | 'autosave' | 'backup' } {
  let rest = fileName.slice('DYNASTY-'.length);
  let kind: 'main' | 'autosave' | 'backup' = 'main';

  // `.backup-<timestamp>` is appended after the name, so strip it first.
  const backupMatch = rest.match(/^(.*)\.backup-\d+$/i);
  if (backupMatch) {
    rest = backupMatch[1];
    kind = 'backup';
  } else if (/-AUTOSAVE$/i.test(rest)) {
    rest = rest.replace(/-AUTOSAVE$/i, '');
    kind = 'autosave';
  }

  return { slug: rest, kind };
}
