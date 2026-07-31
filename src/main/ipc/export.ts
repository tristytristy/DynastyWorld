import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import type { ExportResult } from '../../shared/types';
import { getDynastyById, getSeasonById } from '../../database/helpers';
import { getHistory } from '../../database/getHistory';
import { getSeasonOverview } from '../../database/getSeasonOverview';
import { getAwards } from '../../database/getAwards';
import { getSchedule } from '../../database/getSchedule';
import { buildHistoryExportHtml } from '../htmlExport';
import { buildYearbookHtml } from '../yearbookExport';

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').trim() || 'Dynasty';
}

/**
 * Captures a region of the window — and forces a fresh frame first, which is
 * NOT optional.
 *
 * `capturePage` reads whatever the compositor last handed the browser process,
 * and that surface is not guaranteed to be current: a window Chromium considers
 * occluded (or simply not in the foreground) stops submitting frames while the
 * page happily keeps running rAF and mutating the DOM. Measured directly —
 * three captures, one checkbox flipped between each, the page's own text
 * confirming the change every time, and all three PNGs came out BYTE-IDENTICAL
 * to the first. For the bulk card export that would mean twenty cards exported
 * as twenty copies of card one, silently and with every call reporting success.
 *
 * `invalidate()` marks the whole view dirty and schedules a real repaint; the
 * two frame-length waits either side give the compositor time to produce and
 * submit it. The cost is a few milliseconds per card.
 */
async function captureRegion(
  win: BrowserWindow,
  rect: { x: number; y: number; width: number; height: number },
) {
  win.webContents.invalidate();
  await new Promise((resolve) => setTimeout(resolve, 40));
  // Round to whole device-independent pixels — capturePage rejects fractions.
  const image = await win.webContents.capturePage({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });
  return image;
}

export function registerExportHandlers(): void {
  ipcMain.handle(IPC.export.historyToHtml, async (_event, dynastyId: string): Promise<ExportResult> => {
    const dynasty = getDynastyById(dynastyId);
    const history = getHistory(dynastyId);
    if (!dynasty || !history) {
      return { success: false, message: 'No program history is available for this dynasty yet.' };
    }

    const html = buildHistoryExportHtml(history, {
      primaryColor: dynasty.teamColorPrimary,
      secondaryColor: dynasty.teamColorSecondary,
    });

    const result = await dialog.showSaveDialog({
      title: 'Export Program History',
      defaultPath: `${sanitizeFilename(history.teamName)} Program History.html`,
      filters: [{ name: 'HTML File', extensions: ['html'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Export canceled.' };
    }

    await fs.writeFile(result.filePath, html, 'utf-8');
    return { success: true, message: 'Program history exported.', filePath: result.filePath };
  });

  ipcMain.handle(
    IPC.export.seasonYearbookToHtml,
    async (_event, dynastyId: string, seasonId: number): Promise<ExportResult> => {
      const dynasty = getDynastyById(dynastyId);
      const overview = getSeasonOverview(dynastyId, seasonId);
      if (!dynasty || !overview) {
        return { success: false, message: 'No data available for this season yet.' };
      }
      const season = getSeasonById(seasonId);
      if (season && !season.hasFullData) {
        return { success: false, message: 'This is a history-only season — sync it live to export a full yearbook.' };
      }

      const historySeason =
        getHistory(dynastyId)?.seasons.find((s) => s.seasonYear === overview.seasonYear) ?? null;
      const awards = getAwards(dynastyId, seasonId) ?? null;
      const schedule = getSchedule(dynastyId, seasonId) ?? null;

      const html = buildYearbookHtml(overview, historySeason, awards, schedule, {
        primaryColor: dynasty.teamColorPrimary,
        secondaryColor: dynasty.teamColorSecondary,
      });

      const result = await dialog.showSaveDialog({
        title: 'Export Season Yearbook',
        defaultPath: `${sanitizeFilename(overview.teamName)} ${overview.seasonYear} Season in Review.html`,
        filters: [{ name: 'HTML File', extensions: ['html'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export canceled.' };
      }

      await fs.writeFile(result.filePath, html, 'utf-8');
      return { success: true, message: `${overview.seasonYear} season yearbook exported.`, filePath: result.filePath };
    },
  );

  ipcMain.handle(
    IPC.export.playerCardToPng,
    async (
      event,
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ): Promise<ExportResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, message: 'Could not find the window to capture.' };

      const image = await captureRegion(win, rect);

      const result = await dialog.showSaveDialog({
        title: 'Save Player Card',
        defaultPath: `${sanitizeFilename(fileName)} Card.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export canceled.' };
      }

      await fs.writeFile(result.filePath, image.toPNG());
      return { success: true, message: 'Card saved.', filePath: result.filePath };
    },
  );

  // Bulk card export: the folder is chosen ONCE and then written to without
  // further prompting. Twenty cards through the save dialog above would be
  // twenty dialogs, which is not an export so much as a punishment.
  ipcMain.handle(IPC.export.pickCardFolder, async (): Promise<string | null> => {
    // Same family as the SCREENSHOT_* hooks in main.ts: a native folder dialog
    // can't be driven from a verification run, and the export LOOP behind it —
    // swap the preview to card N, wait for its art, capture, write — is the part
    // most worth testing. Never set in a packaged run.
    if (process.env.SCREENSHOT_EXPORT_DIR) return process.env.SCREENSHOT_EXPORT_DIR;

    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for the cards',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  ipcMain.handle(
    IPC.export.playerCardToFolder,
    async (
      event,
      folderPath: string,
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ): Promise<ExportResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, message: 'Could not find the window to capture.' };

      const image = await captureRegion(win, rect);

      // Never overwrite: two cards of the same player in the same season would
      // otherwise silently collapse into one file.
      const base = sanitizeFilename(fileName);
      let filePath = path.join(folderPath, `${base}.png`);
      for (let n = 2; ; n++) {
        try {
          await fs.access(filePath);
        } catch {
          break;
        }
        filePath = path.join(folderPath, `${base} (${n}).png`);
      }

      await fs.writeFile(filePath, image.toPNG());
      return { success: true, message: 'Card saved.', filePath };
    },
  );
}
