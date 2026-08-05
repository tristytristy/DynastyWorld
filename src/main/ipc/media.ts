import { app, dialog, ipcMain, shell } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import { getMediaLibraryStatus, getMediaRoot, moveMediaLibrary, resetMediaLibrary } from '../mediaRoot';
import { getBackupsFolderInfo, getDatabaseFileBytes, pruneOldBackups } from '../../database/init';
import { clearDeletedDynastyCache, getDeletedDynastyCacheBytes } from '../../database/helpers';
import { getSaveBackupsFolderInfo, pruneAllSaveBackups } from '../editorWrite';
import type {
  MediaFraming,
  MediaItemPatch,
  MediaItemWithPath,
  MediaLibraryMoveResult,
  MediaLibraryStatus,
  StorageFolderUsage,
  StorageUsage,
} from '../../shared/types';
import {
  addMediaItem,
  deleteMediaItem,
  listMediaForGame,
  listMediaForPlayer,
  listMediaItems,
  reorderMedia,
  setMediaFraming,
  setMediaLook,
  updateMediaItem,
} from '../../database/media';
import type { MediaItemResolved } from '../../shared/types';
import type { MediaLook } from '../../shared/mediaLook';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v'];

function mediaTypeForFile(filePath: string): 'image' | 'video' | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return null;
}

/**
 * All of a dynasty's media files live here; the DB stores only file names, so
 * the library root can move (see mediaRoot.ts) without rewriting a single row.
 */
export function mediaDirFor(dynastyId: string): string {
  return path.join(getMediaRoot(), dynastyId);
}

/**
 * Turns "screenshot of the natty.png" into a collision-proof library name.
 * Keeping the original (sanitized) name in the file keeps the library folder
 * human-readable if the user ever browses it directly.
 */
function libraryFileName(originalPath: string): string {
  const base = path
    .basename(originalPath)
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .slice(-80);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}`;
}

/** Recursive size of a folder — used only by the storage panel, never per request. */
async function folderUsage(dir: string): Promise<StorageFolderUsage> {
  let fileCount = 0;
  let totalBytes = 0;
  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return; // Folder doesn't exist (or an unplugged drive) — report what we have.
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        try {
          totalBytes += (await fs.stat(full)).size;
          fileCount++;
        } catch {
          // Vanished mid-scan — skip it.
        }
      }
    }
  }
  await walk(dir);
  return { path: dir, fileCount, totalBytes };
}

function withPath<T extends Omit<MediaItemWithPath, 'absolutePath'>>(
  dynastyId: string,
  item: T,
): T & { absolutePath: string } {
  return { ...item, absolutePath: path.join(mediaDirFor(dynastyId), item.fileName) };
}

export function registerMediaHandlers(): void {
  ipcMain.handle(IPC.media.pickFiles, async (): Promise<string[] | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Add photos or videos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images & Videos', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
        { name: 'Images', extensions: IMAGE_EXTENSIONS },
        { name: 'Videos', extensions: VIDEO_EXTENSIONS },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths;
  });

  // Copy-in is separate from the dialog on purpose: the renderer (and the
  // SCREENSHOT_EVAL verification harness) can pass paths directly.
  ipcMain.handle(
    IPC.media.addFiles,
    async (_event, dynastyId: string, seasonId: number, filePaths: string[]): Promise<MediaItemWithPath[]> => {
      const dir = mediaDirFor(dynastyId);
      await fs.mkdir(dir, { recursive: true });

      const added: MediaItemWithPath[] = [];
      for (const sourcePath of filePaths) {
        const mediaType = mediaTypeForFile(sourcePath);
        if (!mediaType) continue; // Unsupported extension — skip silently rather than fail the batch.
        const fileName = libraryFileName(sourcePath);
        await fs.copyFile(sourcePath, path.join(dir, fileName));
        const item = addMediaItem(dynastyId, seasonId, fileName, mediaType);
        if (item) {
          added.push(withPath(dynastyId, item));
        } else {
          // DB rejected the row (bad season) — don't leave an orphan file behind.
          await fs.unlink(path.join(dir, fileName)).catch(() => {});
        }
      }
      return added;
    },
  );

  ipcMain.handle(
    IPC.media.list,
    async (_event, dynastyId: string, seasonId?: number): Promise<MediaItemWithPath[] | undefined> => {
      const items = listMediaItems(dynastyId, seasonId);
      return items?.map((item) => withPath(dynastyId, item));
    },
  );

  ipcMain.handle(
    IPC.media.listForPlayer,
    async (_event, dynastyId: string, playerId: number): Promise<MediaItemResolved[]> => {
      return listMediaForPlayer(dynastyId, playerId).map((item) => withPath(dynastyId, item));
    },
  );

  ipcMain.handle(
    IPC.media.listForGame,
    async (_event, dynastyId: string, seasonId: number | undefined, gameId: number): Promise<MediaItemResolved[]> => {
      return listMediaForGame(dynastyId, seasonId, gameId).map((item) => withPath(dynastyId, item));
    },
  );

  ipcMain.handle(IPC.media.update, async (_event, id: number, patch: MediaItemPatch): Promise<void> => {
    updateMediaItem(id, patch);
  });

  ipcMain.handle(
    IPC.media.setFraming,
    async (_event, id: number, framing: MediaFraming | null): Promise<void> => {
      setMediaFraming(id, framing);
    },
  );

  ipcMain.handle(IPC.media.setLook, async (_event, id: number, look: MediaLook | null): Promise<void> => {
    setMediaLook(id, look);
  });

  ipcMain.handle(
    IPC.media.reorder,
    async (_event, dynastyId: string, seasonId: number, orderedIds: number[]): Promise<void> => {
      reorderMedia(dynastyId, seasonId, orderedIds);
    },
  );

  ipcMain.handle(IPC.media.remove, async (_event, id: number): Promise<void> => {
    const removed = deleteMediaItem(id);
    if (removed) {
      await fs.unlink(path.join(mediaDirFor(removed.dynastyId), removed.fileName)).catch(() => {});
    }
  });

  // ---- Storage transparency -------------------------------------------------

  ipcMain.handle(IPC.media.getStorageUsage, async (): Promise<StorageUsage> => {
    const dbPath = path.join(app.getPath('userData'), 'dynasty-archive.sqlite');
    const dbBytes = getDatabaseFileBytes();
    return {
      database: { path: dbPath, fileCount: dbBytes ? 1 : 0, totalBytes: dbBytes },
      media: await folderUsage(getMediaRoot()),
      cardPhotos: await folderUsage(path.join(app.getPath('userData'), 'card-photos')),
      databaseBackups: getBackupsFolderInfo(),
      saveBackups: getSaveBackupsFolderInfo(),
      deletedDynastyCacheBytes: getDeletedDynastyCacheBytes(),
    };
  });

  ipcMain.handle(IPC.media.clearDeletedDynastyCache, async (): Promise<{ freedBytes: number }> => {
    return { freedBytes: clearDeletedDynastyCache() };
  });

  ipcMain.handle(IPC.media.cleanUpBackups, async (): Promise<{ removed: number; freedBytes: number }> => {
    const before = getBackupsFolderInfo().totalBytes + getSaveBackupsFolderInfo().totalBytes;
    // Keep 1 of each: the user asked to reclaim space, so leave the single most
    // recent recovery point rather than none at all.
    const removed = pruneOldBackups(1) + pruneAllSaveBackups(1);
    const after = getBackupsFolderInfo().totalBytes + getSaveBackupsFolderInfo().totalBytes;
    return { removed, freedBytes: Math.max(0, before - after) };
  });

  // ---- Library location -----------------------------------------------------

  ipcMain.handle(IPC.media.getLibraryStatus, async (): Promise<MediaLibraryStatus> => getMediaLibraryStatus());

  ipcMain.handle(
    IPC.media.chooseLibraryFolder,
    async (): Promise<MediaLibraryMoveResult & { picked: boolean }> => {
      const result = await dialog.showOpenDialog({
        title: 'Choose where your photos and videos are stored',
        buttonLabel: 'Use this folder',
        defaultPath: getMediaRoot(),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { picked: false, status: getMediaLibraryStatus(), movedFiles: 0 };
      }
      return { picked: true, ...moveMediaLibrary(result.filePaths[0]) };
    },
  );

  ipcMain.handle(IPC.media.resetLibraryFolder, async (): Promise<MediaLibraryMoveResult> => resetMediaLibrary());

  // Opens the library in Explorer/Finder — the whole point of letting people
  // choose a real folder is being able to get at the files.
  ipcMain.handle(IPC.media.openLibraryFolder, async (): Promise<void> => {
    const root = getMediaRoot();
    await fs.mkdir(root, { recursive: true }).catch(() => {});
    await shell.openPath(root);
  });
}
