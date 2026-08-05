import { dialog, ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { getAssetStatus, isAssetRoot, setAssetsPath } from '../assetRoot';
import type { AssetChooseResult, AssetStatus } from '../../shared/types';

/**
 * IPC for locating the external image-data folder. The heavy assets ship as a
 * separate installer the user places wherever they like, so the app needs to
 * (a) report whether it found them and (b) let the user browse to the folder
 * if it can't be auto-detected (see assetRoot.ts). The chosen path is saved so
 * it's remembered next launch.
 */
export function registerAssetHandlers(): void {
  ipcMain.handle(IPC.assets.getStatus, (): AssetStatus => getAssetStatus());

  ipcMain.handle(IPC.assets.chooseFolder, async (): Promise<AssetChooseResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Select your DynastyOS image-data folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ...getAssetStatus(), picked: false };
    }
    const chosen = result.filePaths[0];
    if (!isAssetRoot(chosen)) {
      // Not the image-data folder (no recognizable contents) — don't save it.
      return { ...getAssetStatus(), picked: true, invalid: true };
    }
    setAssetsPath(chosen);
    return { ...getAssetStatus(), picked: true };
  });
}
