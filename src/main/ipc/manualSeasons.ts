import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import {
  getManualSeasonGap,
  listManualSeasons,
  markHistoryPromptSeen,
  saveManualSeasons,
} from '../../database/manualSeasons';
import type { ManualSeason, ManualSeasonGap } from '../../shared/types';

/**
 * User-typed historical seasons (schema v19).
 *
 * `save` takes the WHOLE set for a dynasty rather than one row at a time — the
 * editor is a grid, the user changes several years and commits once, and a row
 * they cleared has to disappear. See database/manualSeasons.ts.
 */
export function registerManualSeasonHandlers(): void {
  ipcMain.handle(IPC.manualSeasons.list, async (_event, dynastyId: string): Promise<ManualSeason[]> => {
    return listManualSeasons(dynastyId);
  });

  ipcMain.handle(
    IPC.manualSeasons.save,
    async (_event, dynastyId: string, seasons: ManualSeason[]): Promise<ManualSeason[]> => {
      return saveManualSeasons(dynastyId, seasons);
    },
  );

  ipcMain.handle(IPC.manualSeasons.gap, async (_event, dynastyId: string): Promise<ManualSeasonGap | null> => {
    return getManualSeasonGap(dynastyId) ?? null;
  });

  ipcMain.handle(IPC.manualSeasons.markPromptSeen, async (_event, dynastyId: string): Promise<void> => {
    markHistoryPromptSeen(dynastyId);
  });
}
