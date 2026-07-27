import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

/** Per-dynasty folder for custom card photos (one image per player, named by playerId). */
function cardPhotoDir(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'card-photos', dynastyId);
}

/** The stored photo for a player (any supported extension), or null. */
async function findPhoto(dynastyId: string, playerId: number): Promise<string | null> {
  const dir = cardPhotoDir(dynastyId);
  try {
    const files = await fs.readdir(dir);
    const match = files.find((f) => f.startsWith(`${playerId}.`));
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

/** Copies a source image into this player's card slot, replacing any prior photo. Returns the stored path, or null on an unsupported type. */
async function storePhoto(dynastyId: string, playerId: number, source: string): Promise<string | null> {
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;

  const dir = cardPhotoDir(dynastyId);
  await fs.mkdir(dir, { recursive: true });
  // Replace any prior photo (possibly a different extension) for this player.
  const prior = await findPhoto(dynastyId, playerId);
  if (prior) await fs.unlink(prior).catch(() => {});

  const dest = path.join(dir, `${playerId}.${ext}`);
  await fs.copyFile(source, dest);
  return dest;
}

/**
 * Custom player-card photos — a user can drop their own image (e.g. a game
 * screenshot) onto a player's trading card, either by picking a file or by
 * reusing a photo already tagged to that player in the media gallery. The file
 * is copied into the app's own userData (one per player, keyed by playerId),
 * never referenced from its original location, so moving/deleting the original
 * doesn't break the card. The renderer displays it via a file:/// URL (same as
 * the media gallery) and stores the pan/zoom framing itself; this module just
 * owns the file.
 */
export function registerCardHandlers(): void {
  ipcMain.handle(
    IPC.card.pickPhoto,
    async (_event, dynastyId: string, playerId: number): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Choose a photo for the card',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return storePhoto(dynastyId, playerId, result.filePaths[0]);
    },
  );

  // Reuse an existing gallery photo (already tagged to this player) as the card
  // image — no native dialog, just copy the given library path into the slot.
  ipcMain.handle(
    IPC.card.setPhotoFromPath,
    async (_event, dynastyId: string, playerId: number, sourcePath: string): Promise<string | null> => {
      return storePhoto(dynastyId, playerId, sourcePath);
    },
  );

  ipcMain.handle(IPC.card.getPhoto, async (_event, dynastyId: string, playerId: number): Promise<string | null> => {
    return findPhoto(dynastyId, playerId);
  });

  ipcMain.handle(IPC.card.removePhoto, async (_event, dynastyId: string, playerId: number): Promise<void> => {
    const existing = await findPhoto(dynastyId, playerId);
    if (existing) await fs.unlink(existing).catch(() => {});
  });
}
