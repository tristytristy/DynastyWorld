import { dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import { ASSET_ADDONS } from '../../shared/assetPacks';
import { getAssetsRoot, getAssetStatus, isAssetRoot, setAssetsPath } from '../assetRoot';
import type { AssetAddonStatus, AssetChooseResult, AssetStatus } from '../../shared/types';

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

  /*
    WHICH ARTWORK ADD-ONS THE IMAGE FOLDER IS MISSING.

    NOTHING WHEN THERE IS NO IMAGE FOLDER AT ALL, deliberately. Someone in that
    state is looking at AssetGate, being asked for the ~928 MB library — telling
    them they are also missing a 190 KB add-on is answering a question they have
    not reached yet, and the library they are about to install may well contain
    it. An empty list is the honest answer: we cannot know what is missing from a
    folder that does not exist.

    Probing is a handful of existsSync calls against a folder the app has already
    resolved, and the renderer asks once per launch. It is not cached: the whole
    point is to notice the moment the user comes back from running an installer,
    and a cache would keep the notice up until the next restart.
  */
  ipcMain.handle(IPC.assets.getAddons, (): AssetAddonStatus[] => {
    const root = getAssetsRoot();
    if (!root) return [];
    return ASSET_ADDONS.map((pack) => ({
      id: pack.id,
      label: pack.label,
      blurb: pack.blurb,
      sizeLabel: pack.sizeLabel,
      downloadUrl: pack.downloadUrl,
      installed: pack.probeFiles.every((rel) => fs.existsSync(path.join(root, ...rel.split('/')))),
    }));
  });
}
