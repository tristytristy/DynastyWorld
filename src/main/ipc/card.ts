import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import {
  createPlayerCard,
  deletePlayerCard,
  listCardedPlayerIds,
  listFavoriteCards,
  listPlayerCards,
  setDefaultPlayerCard,
  setPlayerCardFavorite,
  updatePlayerCard,
} from '../../database/playerCards';
import type { PlayerCardInput, PlayerCardRecord } from '../../shared/types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

/** Per-dynasty folder for custom card photos. */
function cardPhotoDir(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'card-photos', dynastyId);
}

/**
 * The file a card's photo is stored under. Card-scoped, because a player can
 * have several cards and each frames its own image — the older per-player
 * "<playerId>.<ext>" naming could only ever hold one.
 */
function cardPhotoStem(playerId: number, cardId: number): string {
  return `${playerId}-${cardId}`;
}

/** The stored photo whose name matches `stem` (any supported extension), or null. */
async function findPhotoByStem(dynastyId: string, stem: string): Promise<string | null> {
  const dir = cardPhotoDir(dynastyId);
  try {
    const files = await fs.readdir(dir);
    const match = files.find((f) => f.startsWith(`${stem}.`));
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

/** The legacy per-player photo (pre-v12, one image per player). */
async function findPhoto(dynastyId: string, playerId: number): Promise<string | null> {
  return findPhotoByStem(dynastyId, String(playerId));
}

/** Copies a source image into the given slot, replacing anything already there. Returns the stored path, or null on an unsupported type. */
async function storePhoto(dynastyId: string, stem: string, source: string): Promise<string | null> {
  const ext = path.extname(source).slice(1).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return null;

  const dir = cardPhotoDir(dynastyId);
  await fs.mkdir(dir, { recursive: true });
  // Replace any prior photo (possibly a different extension) in this slot.
  const prior = await findPhotoByStem(dynastyId, stem);
  if (prior) await fs.unlink(prior).catch(() => {});

  const dest = path.join(dir, `${stem}.${ext}`);
  await fs.copyFile(source, dest);
  return dest;
}

async function pickImage(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose a photo for the card',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/**
 * Resolves each card's stored BASENAME to an absolute path for the renderer.
 * Kept out of the DAL on purpose: the database has no business knowing where
 * userData is, and a card whose file has been deleted underneath it should come
 * back as "no photo" rather than as a path that 404s in an <img>.
 */
async function withPhotoPaths(
  dynastyId: string,
  cards: PlayerCardRecord[],
): Promise<PlayerCardRecord[]> {
  const dir = cardPhotoDir(dynastyId);
  let present: Set<string>;
  try {
    present = new Set(await fs.readdir(dir));
  } catch {
    present = new Set();
  }
  return cards.map((card) => ({
    ...card,
    photoPath:
      card.photoFile && present.has(card.photoFile) ? path.join(dir, card.photoFile) : null,
  }));
}

async function withPhotoPath(
  dynastyId: string,
  card: PlayerCardRecord | null,
): Promise<PlayerCardRecord | null> {
  if (!card) return null;
  return (await withPhotoPaths(dynastyId, [card]))[0];
}

/**
 * Custom player-card photos and the saved cards themselves.
 *
 * A user can drop their own image (e.g. a game screenshot) onto a trading card,
 * frame it, and keep it. The file is copied into the app's own userData, never
 * referenced from its original location, so moving or deleting the original
 * doesn't break the card. The renderer displays it via a file:/// URL (same as
 * the media gallery).
 *
 * The card ROW (schema v12) holds everything else — the frozen player/stat data,
 * the framing, the star, and which card is the player's default. The row stores
 * the photo's basename only; resolving that to a path is this module's job,
 * since userData lives here.
 */
export function registerCardHandlers(): void {
  // --- Photo files, keyed by player (pre-v12; a card made before the migration
  // adopts the file it already had, so these stay live) ---
  ipcMain.handle(
    IPC.card.pickPhoto,
    async (_event, dynastyId: string, playerId: number): Promise<string | null> => {
      const source = await pickImage();
      return source ? storePhoto(dynastyId, String(playerId), source) : null;
    },
  );

  ipcMain.handle(
    IPC.card.getPhoto,
    async (_event, dynastyId: string, playerId: number): Promise<string | null> => {
      return findPhoto(dynastyId, playerId);
    },
  );

  ipcMain.handle(
    IPC.card.removePhoto,
    async (_event, dynastyId: string, playerId: number): Promise<void> => {
      const existing = await findPhoto(dynastyId, playerId);
      if (existing) await fs.unlink(existing).catch(() => {});
    },
  );

  // --- Photo files, keyed by card. All three return the stored BASENAME, which
  // is what the card row keeps. ---
  ipcMain.handle(
    IPC.card.pickPhotoForCard,
    async (_event, dynastyId: string, playerId: number, cardId: number): Promise<string | null> => {
      const source = await pickImage();
      if (!source) return null;
      const stored = await storePhoto(dynastyId, cardPhotoStem(playerId, cardId), source);
      return stored ? path.basename(stored) : null;
    },
  );

  ipcMain.handle(
    IPC.card.setCardPhotoFromPath,
    async (
      _event,
      dynastyId: string,
      playerId: number,
      cardId: number,
      sourcePath: string,
    ): Promise<string | null> => {
      const stored = await storePhoto(dynastyId, cardPhotoStem(playerId, cardId), sourcePath);
      return stored ? path.basename(stored) : null;
    },
  );

  ipcMain.handle(
    IPC.card.removeCardPhoto,
    async (_event, dynastyId: string, photoFile: string): Promise<void> => {
      // Only ever a basename from a card row — resolve it inside the dynasty's
      // own folder so a doctored value can't reach out of it.
      const target = path.join(cardPhotoDir(dynastyId), path.basename(photoFile));
      await fs.unlink(target).catch(() => {});
    },
  );

  // --- Saved cards ---
  ipcMain.handle(
    IPC.card.list,
    async (_event, dynastyId: string, playerId: number): Promise<PlayerCardRecord[]> => {
      return withPhotoPaths(dynastyId, listPlayerCards(dynastyId, playerId));
    },
  );

  ipcMain.handle(
    IPC.card.listFavorites,
    async (_event, dynastyId: string): Promise<PlayerCardRecord[]> => {
      return withPhotoPaths(dynastyId, listFavoriteCards(dynastyId));
    },
  );

  ipcMain.handle(
    IPC.card.listCardedPlayerIds,
    async (_event, dynastyId: string): Promise<number[]> => {
      return listCardedPlayerIds(dynastyId);
    },
  );

  ipcMain.handle(
    IPC.card.create,
    async (
      _event,
      dynastyId: string,
      playerId: number,
      input: PlayerCardInput,
    ): Promise<PlayerCardRecord> => {
      const card = createPlayerCard(dynastyId, playerId, input);
      return (await withPhotoPath(dynastyId, card)) as PlayerCardRecord;
    },
  );

  ipcMain.handle(
    IPC.card.update,
    async (
      _event,
      dynastyId: string,
      id: number,
      input: PlayerCardInput,
    ): Promise<PlayerCardRecord | null> => {
      return withPhotoPath(dynastyId, updatePlayerCard(id, input));
    },
  );

  ipcMain.handle(
    IPC.card.setFavorite,
    async (
      _event,
      dynastyId: string,
      id: number,
      favorite: boolean,
    ): Promise<PlayerCardRecord | null> => {
      return withPhotoPath(dynastyId, setPlayerCardFavorite(id, favorite));
    },
  );

  ipcMain.handle(
    IPC.card.setDefault,
    async (
      _event,
      dynastyId: string,
      playerId: number,
      id: number,
    ): Promise<PlayerCardRecord[]> => {
      return withPhotoPaths(dynastyId, setDefaultPlayerCard(dynastyId, playerId, id));
    },
  );

  // Deleting the row and deleting its file are one action from the user's side,
  // so they're one call — a card removed from the book must not leave its
  // screenshot behind in userData forever.
  ipcMain.handle(
    IPC.card.remove,
    async (_event, dynastyId: string, id: number): Promise<PlayerCardRecord[]> => {
      const { photoFile, remaining } = deletePlayerCard(id);
      if (photoFile) {
        await fs
          .unlink(path.join(cardPhotoDir(dynastyId), path.basename(photoFile)))
          .catch(() => {});
      }
      return withPhotoPaths(dynastyId, remaining);
    },
  );
}
