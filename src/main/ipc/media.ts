import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import type { MediaItemPatch, MediaItemWithPath } from '../../shared/types';
import {
  addMediaItem,
  deleteMediaItem,
  listMediaForGame,
  listMediaForPlayer,
  listMediaItems,
  reorderMedia,
  updateMediaItem,
} from '../../database/media';
import type { MediaItemResolved } from '../../shared/types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v'];

function mediaTypeForFile(filePath: string): 'image' | 'video' | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return null;
}

/** All of a dynasty's media files live here; the DB stores only file names. */
export function mediaDirFor(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'media', dynastyId);
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
}
