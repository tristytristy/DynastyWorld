import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import {
  getCustomRival,
  listCustomRivals,
  removeCustomRival,
  saveCustomRival,
  setCustomRivalLogo,
} from '../../database/customRivals';
import type { CustomRival, CustomRivalInput } from '../../shared/types';

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

/**
 * MEASURED off the shipped rivalry art, not chosen: every file under
 * public/assets/rivalry/rivalrylogo is 1024x1024 WebP, and the mark is drawn at
 * showcase size on the Schedule page and in the Game Info header. Telling the
 * user a number the app doesn't actually use would be worse than telling them
 * nothing.
 */
export const RIVALRY_LOGO_SPEC = { width: 1024, height: 1024 };

function logoDir(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'rivalry-art', dynastyId);
}

/**
 * One file per matchup, named from the pair key.
 *
 * The pair key is derived from team names and can hold anything the display
 * name held, so it is reduced to characters that are safe in a filename on
 * every platform before it becomes one — the DATABASE keeps the real key, and
 * this is only how the bytes are stored.
 */
function logoStem(pairKey: string): string {
  return pairKey.replace(/[^a-z0-9]/gi, '_').slice(0, 80);
}

async function findByStem(dynastyId: string, stem: string): Promise<string | null> {
  try {
    const files = await fs.readdir(logoDir(dynastyId));
    const match = files.find((f) => f.startsWith(`${stem}.`));
    return match ? path.join(logoDir(dynastyId), match) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves stored basenames to absolute paths.
 *
 * Kept out of the DAL for the same reason the program-art, card and media
 * layers keep it out: the database has no business knowing where userData is,
 * and a file deleted underneath a row should come back as "no logo" — the
 * generic shield — rather than as a path that fails to load in an <img>.
 */
async function withPaths(dynastyId: string, rows: CustomRival[]): Promise<CustomRival[]> {
  let present: Set<string>;
  try {
    present = new Set(await fs.readdir(logoDir(dynastyId)));
  } catch {
    present = new Set();
  }
  return rows.map((row) => ({
    ...row,
    logo:
      row.logo && present.has(row.logo.file)
        ? { file: row.logo.file, path: path.join(logoDir(dynastyId), row.logo.file) }
        : row.logo,
  }));
}

async function withPath(dynastyId: string, row: CustomRival | null): Promise<CustomRival | null> {
  if (!row) return null;
  return (await withPaths(dynastyId, [row]))[0];
}

/**
 * The user's own rivalries.
 *
 * Logo files are copied into the app's own userData, never referenced where the
 * user picked them, so moving or deleting the original doesn't break a mark —
 * the same rule program art, the media library and card photos follow.
 *
 * NOTHING HERE OPENS THE SAVE FILE. Every handler is a database read or write
 * plus a file copy inside userData; see schema_v20_custom_rivals.sql.
 */
export function registerRivalHandlers(): void {
  ipcMain.handle(IPC.rivals.list, async (_event, dynastyId: string): Promise<CustomRival[]> => {
    return withPaths(dynastyId, listCustomRivals(dynastyId));
  });

  ipcMain.handle(
    IPC.rivals.save,
    async (_event, dynastyId: string, input: CustomRivalInput): Promise<CustomRival | null> => {
      const name = input.rivalryName.trim();
      // A rivalry with no name is indistinguishable from one of the save's own
      // unnamed rival slots, which is the one thing this feature exists to fix.
      if (!name) return null;
      // Declaring a team its own rival would produce a pair key of one team and
      // a logo that fires on every game they play.
      if (input.teamIndex === input.opponentTeamIndex) return null;
      return withPath(dynastyId, saveCustomRival(dynastyId, { ...input, rivalryName: name }));
    },
  );

  ipcMain.handle(
    IPC.rivals.pickLogo,
    async (_event, dynastyId: string, pairKey: string): Promise<CustomRival | null> => {
      const result = await dialog.showOpenDialog({
        title: `Choose a rivalry logo (${RIVALRY_LOGO_SPEC.width}x${RIVALRY_LOGO_SPEC.height}, transparent background)`,
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;

      const source = result.filePaths[0];
      const ext = path.extname(source).slice(1).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) return null;

      const dir = logoDir(dynastyId);
      await fs.mkdir(dir, { recursive: true });
      // Replace whatever was there, whatever extension it had.
      const prior = await findByStem(dynastyId, logoStem(pairKey));
      if (prior) await fs.unlink(prior).catch(() => {});

      const dest = path.join(dir, `${logoStem(pairKey)}.${ext}`);
      await fs.copyFile(source, dest);
      return withPath(dynastyId, setCustomRivalLogo(dynastyId, pairKey, path.basename(dest)));
    },
  );

  ipcMain.handle(
    IPC.rivals.clearLogo,
    async (_event, dynastyId: string, pairKey: string): Promise<CustomRival | null> => {
      const existing = await findByStem(dynastyId, logoStem(pairKey));
      if (existing) await fs.unlink(existing).catch(() => {});
      return withPath(dynastyId, setCustomRivalLogo(dynastyId, pairKey, null));
    },
  );

  ipcMain.handle(IPC.rivals.remove, async (_event, dynastyId: string, pairKey: string): Promise<boolean> => {
    // The file goes with the row. Read it BEFORE the delete, or there is nothing
    // left to tell us which file belonged to this rivalry and it leaks.
    const row = getCustomRival(dynastyId, pairKey);
    if (!row) return false;
    const existing = await findByStem(dynastyId, logoStem(pairKey));
    if (existing) await fs.unlink(existing).catch(() => {});
    removeCustomRival(dynastyId, pairKey);
    return true;
  });
}
