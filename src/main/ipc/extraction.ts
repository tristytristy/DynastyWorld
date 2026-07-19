import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type { ExtractionResult } from '../../shared/types';
import { extractAll } from '../../extractors/extract-all';

/**
 * Parses a save file and reports what was found, without writing to the
 * database — db:importDynasty (ipc/database.ts) does extraction + persist
 * together for the actual import flow. This handler exists for a
 * parse-only preview/validation use.
 */
export function registerExtractionHandlers(): void {
  ipcMain.handle(IPC.extraction.extractAll, async (event, savePath: string): Promise<ExtractionResult> => {
    try {
      const data = await extractAll(savePath, (step, status) => {
        event.sender.send(IPC.extraction.progress, { step, status });
      });
      return {
        success: true,
        message: `${data.userTeam.displayName} — season ${data.league.seasonYear}, ${data.teams.length} teams, ${data.schedule.length} games, ${data.recruits.length} recruits.`,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to read save file.',
      };
    }
  });
}
