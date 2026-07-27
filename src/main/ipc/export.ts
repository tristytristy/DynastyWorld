import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
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

      // Round to whole device-independent pixels — capturePage rejects fractions.
      const clip = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      const image = await win.webContents.capturePage(clip);

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
}
