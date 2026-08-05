import { ipcMain, shell } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { UpdateState } from '../../shared/updateTypes';
import { checkForUpdates, downloadUpdate, getUpdateState, installUpdate } from './updateService';
import { getUpdatePreferences, setUpdatePreferences, type UpdatePreferences } from './updatePrefs';

/**
 * The updater's whole renderer-facing surface: four calls in, one state event
 * out. No `autoUpdater` object, no URLs, no file paths — the renderer can ask
 * for exactly these four things and read the state that comes back.
 */
export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC.update.check, async (): Promise<UpdateState> => checkForUpdates());
  ipcMain.handle(IPC.update.download, async (): Promise<UpdateState> => downloadUpdate());
  ipcMain.handle(IPC.update.install, async (): Promise<UpdateState> => installUpdate());
  ipcMain.handle(IPC.update.getState, (): UpdateState => getUpdateState());

  ipcMain.handle(IPC.update.getPrefs, (): UpdatePreferences => getUpdatePreferences());
  ipcMain.handle(IPC.update.setPrefs, (_event, next: Partial<UpdatePreferences>): UpdatePreferences => {
    // Only the keys we know about cross this boundary — a renderer cannot write
    // arbitrary JSON into a main-process settings file.
    return setUpdatePreferences({ checkOnStartup: next?.checkOnStartup !== false });
  });

  /*
    The one door to the outside world, and it stays narrow: https, GitHub hosts
    only. Nothing in the update flow opens a browser by itself — this fires only
    when someone clicks a link in the release notes, or the fallback link after
    an automatic update has failed.
  */
  ipcMain.handle(IPC.update.openLink, async (_event, url: string): Promise<void> => {
    if (typeof url !== 'string') return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    const allowedHost = /(^|\.)github\.com$|(^|\.)githubusercontent\.com$/i.test(parsed.hostname);
    if (parsed.protocol === 'https:' && allowedHost) await shell.openExternal(url);
  });
}
