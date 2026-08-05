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
import { buildRosterXml } from '../rosterXmlExport';
import { buildRosterCsv } from '../rosterCsvExport';
import { getRoster } from '../../database/getRoster';
import { getLeagueTeamRoster } from '../../database/getLeagueRoster';
import { getPlayerRatingsBatch } from '../editorWrite';

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
  /**
   * A team's roster as a file — CSV or XML, whichever the save dialog is left on.
   *
   * Profiles come from the archive (always present, any season); ratings come
   * from the live save, because they are not archived. The two are merged per
   * player, and when the save can't supply them the file still exports with a
   * note explaining it rather than a roster of zeros.
   *
   * CSV leads the filter list because that is the one both Google Sheets and
   * OpenOffice Calc open directly; the nested XML opens in neither, and stays
   * for the tooling that wants the structure. The format is read back off the
   * chosen filename rather than tracked separately — the dialog rewrites the
   * extension when the filter changes, so the path is already the answer.
   *
   * Ratings are read in ONE pass over the Player table. Reusing the editor's
   * single-player lookup would have rescanned it once per player — eighty-five
   * scans for an eighty-five-man roster.
   */
  ipcMain.handle(
    IPC.export.rosterToFile,
    async (_event, dynastyId: string, teamIndex: number | null, seasonId?: number): Promise<ExportResult> => {
      const dynasty = getDynastyById(dynastyId);
      if (!dynasty) return { success: false, message: 'Dynasty not found.' };

      // Fetched once and reused — the browsed-team lookup walks a leaguewide
      // snapshot, so calling it twice to get the name as well is real work.
      const browsed = teamIndex === null ? null : getLeagueTeamRoster(dynastyId, teamIndex, seasonId);
      const players = teamIndex === null ? getRoster(dynastyId, seasonId) : (browsed?.players ?? null);
      if (!players || players.length === 0) {
        return { success: false, message: 'No roster is available for this team and season.' };
      }

      const season = seasonId !== undefined ? getSeasonById(seasonId) : null;
      const teamName = teamIndex === null ? (dynasty.teamName ?? 'Roster') : (browsed?.displayName ?? 'Roster');

      let ratingsByPlayer: Awaited<ReturnType<typeof getPlayerRatingsBatch>> = new Map();
      let ratingsNote: string | null = null;
      try {
        ratingsByPlayer = await getPlayerRatingsBatch(dynastyId, players.map((p) => p.id));
        const missing = players.length - ratingsByPlayer.size;
        if (ratingsByPlayer.size === 0) {
          ratingsNote =
            'Ratings omitted: none of these players are in the current save file. Individual ratings are not archived, so they are only available for the season the save is on.';
        } else if (missing > 0) {
          ratingsNote = `Ratings omitted for ${missing} of ${players.length} players — they are no longer in the current save file.`;
        }
      } catch {
        ratingsNote =
          'Ratings omitted: the save file for this dynasty could not be read. Profiles below are from the archive and are unaffected.';
      }

      const result = await dialog.showSaveDialog({
        title: 'Export Roster',
        defaultPath: `${sanitizeFilename(teamName)} Roster${season ? ` ${season.seasonYear}` : ''}.csv`,
        filters: [
          { name: 'CSV — opens in Google Sheets, Excel, Calc', extensions: ['csv'] },
          { name: 'XML File', extensions: ['xml'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export canceled.' };
      }

      const options = {
        teamName,
        seasonYear: season?.seasonYear ?? 0,
        ratingsByPlayer,
        ratingsNote,
      };
      const asXml = path.extname(result.filePath).toLowerCase() === '.xml';
      const contents = asXml ? buildRosterXml(players, options) : buildRosterCsv(players, options);

      await fs.writeFile(result.filePath, contents, 'utf-8');
      const withRatings = ratingsByPlayer.size;
      return {
        success: true,
        message: `Exported ${players.length} players${withRatings > 0 ? ` (${withRatings} with full ratings)` : ' — profiles only'}.`,
        filePath: result.filePath,
      };
    },
  );

  /**
   * The media viewer's plate — the photo with its caption underneath — saved as
   * one PNG.
   *
   * Captured off the screen rather than composed in the main process, and that
   * is the point: the plate a user is looking at is already the layout they
   * want, framing and typography included, so re-drawing it server-side would
   * be a second implementation of the same design to keep in step. The renderer
   * hides the hover chrome before it calls.
   *
   * The original file is untouched; this is a copy to share, not an edit.
   */
  ipcMain.handle(
    IPC.export.mediaPlateToPng,
    async (
      event,
      fileName: string,
      rect: { x: number; y: number; width: number; height: number },
    ): Promise<ExportResult> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, message: 'Could not find the window to capture.' };

      const image = await captureRegion(win, rect);

      const result = await dialog.showSaveDialog({
        title: 'Export Photo',
        defaultPath: `${sanitizeFilename(fileName)}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Export canceled.' };
      }

      await fs.writeFile(result.filePath, image.toPNG());
      return { success: true, message: 'Photo exported.', filePath: result.filePath };
    },
  );

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
