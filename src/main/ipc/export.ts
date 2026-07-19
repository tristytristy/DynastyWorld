import { dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import { IPC } from '../../shared/ipcChannels';
import type { ExportResult } from '../../shared/types';
import { getDynastyById } from '../../database/helpers';
import { getHistory } from '../../database/getHistory';
import { buildHistoryExportHtml } from '../htmlExport';

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
}
