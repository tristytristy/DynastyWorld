import { app, dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import type { SaveFileInfo } from '../../shared/types';

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

  ipcMain.handle(IPC.fs.getDefaultSavesDir, async () => {
    return path.join(app.getPath('documents'), 'EA SPORTS College Football 27', 'saves');
  });

  ipcMain.handle(IPC.fs.scanForSaves, async (_event, dirPath: string): Promise<SaveFileInfo[]> => {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const saves: SaveFileInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toUpperCase().endsWith('.DYNASTY')) {
        continue;
      }
      const filePath = path.join(dirPath, entry.name);
      try {
        const stats = await fs.stat(filePath);
        saves.push({
          path: filePath,
          name: entry.name,
          modifiedAt: stats.mtime.toISOString(),
        });
      } catch {
        // File was removed or became inaccessible between readdir and stat; skip it.
      }
    }
    return saves;
  });
}
