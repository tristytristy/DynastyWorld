import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import {
  listProgramOverrides,
  setProgramArt,
  setProgramIdentity,
  type ProgramArtSlot,
} from '../../database/programOverrides';
import type { ProgramOverride, ProgramOverrideIdentity } from '../../shared/types';

const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

/**
 * What a good upload looks like, per slot — measured off the shipped art rather
 * than chosen, so the guidance the UI shows is the real requirement. The logo
 * and helmet are drawn large (1024) because they appear at showcase size on
 * mastheads and matchup graphics; the jersey and polo are 512 because they
 * overlay a 512x512 portrait one-to-one and any other size would misregister.
 */
export const PROGRAM_ART_SPEC: Record<ProgramArtSlot, { width: number; height: number }> = {
  logo: { width: 1024, height: 1024 },
  helmet: { width: 1024, height: 1024 },
  jersey: { width: 512, height: 512 },
  polo: { width: 512, height: 512 },
};

function artDir(dynastyId: string): string {
  return path.join(app.getPath('userData'), 'program-art', dynastyId);
}

/** One file per (team slot, art slot). Deterministic, so replacing an upload replaces the file rather than accumulating. */
function artStem(teamIndex: number, slot: ProgramArtSlot): string {
  return `${teamIndex}-${slot}`;
}

async function findByStem(dynastyId: string, stem: string): Promise<string | null> {
  try {
    const files = await fs.readdir(artDir(dynastyId));
    const match = files.find((f) => f.startsWith(`${stem}.`));
    return match ? path.join(artDir(dynastyId), match) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves every stored basename to an absolute path.
 *
 * Kept out of the DAL for the same reason the card and media layers keep it out:
 * the database has no business knowing where userData is, and a file deleted
 * underneath a row should come back as "no upload" rather than as a path that
 * fails to load in an <img>.
 */
async function withPaths(dynastyId: string, rows: ProgramOverride[]): Promise<ProgramOverride[]> {
  let present: Set<string>;
  try {
    present = new Set(await fs.readdir(artDir(dynastyId)));
  } catch {
    present = new Set();
  }
  const resolve = (entry: { file: string; path: string | null } | null) =>
    entry && present.has(entry.file) ? { file: entry.file, path: path.join(artDir(dynastyId), entry.file) } : entry;
  return rows.map((row) => ({
    ...row,
    art: {
      logo: resolve(row.art.logo),
      helmet: resolve(row.art.helmet),
      jersey: resolve(row.art.jersey),
      polo: resolve(row.art.polo),
    },
  }));
}

async function withPath(dynastyId: string, row: ProgramOverride | null): Promise<ProgramOverride | null> {
  if (!row) return null;
  return (await withPaths(dynastyId, [row]))[0];
}

/**
 * A program's own identity and artwork.
 *
 * The files are copied into the app's own userData, never referenced where the
 * user picked them, so moving or deleting the original doesn't break a logo —
 * the same rule the media library and card photos follow.
 */
export function registerProgramHandlers(): void {
  ipcMain.handle(IPC.program.list, async (_event, dynastyId: string): Promise<ProgramOverride[]> => {
    return withPaths(dynastyId, listProgramOverrides(dynastyId));
  });

  ipcMain.handle(
    IPC.program.setIdentity,
    async (
      _event,
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      identity: ProgramOverrideIdentity,
    ): Promise<ProgramOverride | null> => {
      return withPath(dynastyId, setProgramIdentity(dynastyId, teamIndex, teamNameKey, identity));
    },
  );

  ipcMain.handle(
    IPC.program.pickArt,
    async (
      _event,
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      slot: ProgramArtSlot,
    ): Promise<ProgramOverride | null> => {
      const spec = PROGRAM_ART_SPEC[slot];
      const result = await dialog.showOpenDialog({
        title: `Choose a ${slot} image (${spec.width}x${spec.height}, transparent background)`,
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;

      const source = result.filePaths[0];
      const ext = path.extname(source).slice(1).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) return null;

      const dir = artDir(dynastyId);
      await fs.mkdir(dir, { recursive: true });
      // Replace whatever was in this slot, whatever extension it had.
      const prior = await findByStem(dynastyId, artStem(teamIndex, slot));
      if (prior) await fs.unlink(prior).catch(() => {});

      const dest = path.join(dir, `${artStem(teamIndex, slot)}.${ext}`);
      await fs.copyFile(source, dest);
      return withPath(dynastyId, setProgramArt(dynastyId, teamIndex, teamNameKey, slot, path.basename(dest)));
    },
  );

  ipcMain.handle(
    IPC.program.clearArt,
    async (
      _event,
      dynastyId: string,
      teamIndex: number,
      teamNameKey: string,
      slot: ProgramArtSlot,
    ): Promise<ProgramOverride | null> => {
      const existing = await findByStem(dynastyId, artStem(teamIndex, slot));
      if (existing) await fs.unlink(existing).catch(() => {});
      return withPath(dynastyId, setProgramArt(dynastyId, teamIndex, teamNameKey, slot, null));
    },
  );
}
