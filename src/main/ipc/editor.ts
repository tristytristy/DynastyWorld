import { app, dialog, ipcMain } from 'electron';
import path from 'path';
import { IPC } from '../../shared/ipcChannels';
import { createDynastyBackup, estimateDynastyBackup, suggestedBackupFileName } from '../dynastyBackup';
import { inspectBackup, restoreDynastyBackup } from '../dynastyRestore';
import { getScandalsData, saveScandals } from '../scandalsWrite';
import type {
  BackupInspection,
  ScandalsEdit,
  DynastyBackupContents,
  DynastyBackupEstimate,
  DynastyBackupResult,
  DynastyRestoreResult,
  CoachEditData,
  CoachEditFields,
  PlayerEditData,
  PlayerEditFields,
  PortraitFilters,
  PortraitSearchResponse,
  RecruitEditData,
  RecruitEditFields,
  RecruitInfluenceEdit,
  ForceCommitResult,
  SaveEditResult,
  SaveFileBackupResult,
  TeamBudgetData,
  TeamBudgetEdit,
} from '../../shared/types';
import {
  backupSaveFile,
  getCoachEditData,
  getPlayerEditData,
  getRecruitEditData,
  getTeamBudgetData,
  saveCoachEdits,
  savePlayerEdits,
  saveRecruitEdits,
  saveTeamBudget,
  searchPortraits,
} from '../editorWrite';
import { forceCommitRecruit, saveRecruitInfluence } from '../recruitingWrite';

export function registerEditorHandlers(): void {
  ipcMain.handle(IPC.editor.backupSaveFile, async (_event, dynastyId: string): Promise<SaveFileBackupResult> => {
    return backupSaveFile(dynastyId);
  });

  ipcMain.handle(
    IPC.editor.estimateDynastyBackup,
    async (_event, dynastyId: string): Promise<DynastyBackupEstimate | null> => {
      return estimateDynastyBackup(dynastyId);
    },
  );

  ipcMain.handle(
    IPC.editor.createDynastyBackup,
    async (event, dynastyId: string, contents: DynastyBackupContents): Promise<DynastyBackupResult> => {
      const estimate = await estimateDynastyBackup(dynastyId);
      if (!estimate) return { success: false, message: 'That dynasty no longer exists.' };

      const result = await dialog.showSaveDialog({
        title: 'Save dynasty backup',
        defaultPath: path.join(app.getPath('documents'), suggestedBackupFileName(estimate.teamName)),
        filters: [{ name: 'Dynasty backup (zip)', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, message: '' }; // Cancelled — the caller stays silent.
      }

      return createDynastyBackup(dynastyId, contents, result.filePath, (progress) => {
        event.sender.send(IPC.editor.backupProgress, progress);
      });
    },
  );

  // Split from the restore itself so the user sees what a file contains — and
  // whether it would replace a dynasty already here — BEFORE committing.
  ipcMain.handle(
    IPC.editor.chooseBackupToRestore,
    async (): Promise<(BackupInspection & { filePath: string }) | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Choose a dynasty backup',
        properties: ['openFile'],
        filters: [{ name: 'Dynasty backup (zip)', extensions: ['zip'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const filePath = result.filePaths[0];
      return { ...(await inspectBackup(filePath)), filePath };
    },
  );

  ipcMain.handle(
    IPC.editor.restoreDynastyBackup,
    async (_event, filePath: string): Promise<DynastyRestoreResult> => {
      return restoreDynastyBackup(filePath);
    },
  );

  // Scandals — the user coach's cheat panel. Every field here was proven to
  // round-trip on a disposable save before being exposed; see scandalsWrite.ts.
  ipcMain.handle(IPC.editor.getScandals, async (_event, dynastyId: string) => getScandalsData(dynastyId));

  ipcMain.handle(
    IPC.editor.saveScandals,
    async (_event, dynastyId: string, edit: ScandalsEdit): Promise<SaveEditResult> => {
      return saveScandals(dynastyId, edit);
    },
  );

  ipcMain.handle(
    IPC.editor.getPlayer,
    async (_event, dynastyId: string, playerId: number): Promise<PlayerEditData | null> => {
      return getPlayerEditData(dynastyId, playerId);
    },
  );

  ipcMain.handle(
    IPC.editor.savePlayer,
    async (_event, dynastyId: string, playerId: number, fields: PlayerEditFields): Promise<SaveEditResult> => {
      return savePlayerEdits(dynastyId, playerId, fields);
    },
  );

  ipcMain.handle(
    IPC.editor.getCoach,
    async (_event, dynastyId: string, teamIndex: number, position: string): Promise<CoachEditData | null> => {
      return getCoachEditData(dynastyId, teamIndex, position);
    },
  );

  ipcMain.handle(
    IPC.editor.saveCoach,
    async (
      _event,
      dynastyId: string,
      teamIndex: number,
      position: string,
      fields: CoachEditFields,
    ): Promise<SaveEditResult> => {
      return saveCoachEdits(dynastyId, teamIndex, position, fields);
    },
  );

  ipcMain.handle(
    IPC.editor.getRecruit,
    async (_event, dynastyId: string, playerId: number): Promise<RecruitEditData | null> => {
      return getRecruitEditData(dynastyId, playerId);
    },
  );

  ipcMain.handle(
    IPC.editor.saveRecruit,
    async (_event, dynastyId: string, playerId: number, fields: RecruitEditFields): Promise<SaveEditResult> => {
      return saveRecruitEdits(dynastyId, playerId, fields);
    },
  );

  ipcMain.handle(
    IPC.editor.saveRecruitInfluence,
    async (_event, dynastyId: string, playerId: number, edit: RecruitInfluenceEdit): Promise<SaveEditResult> => {
      return saveRecruitInfluence(dynastyId, playerId, edit);
    },
  );


  ipcMain.handle(
    IPC.editor.getTeamBudget,
    async (_event, dynastyId: string, teamIndex: number): Promise<TeamBudgetData | null> => {
      return getTeamBudgetData(dynastyId, teamIndex);
    },
  );

  ipcMain.handle(
    IPC.editor.saveTeamBudget,
    async (_event, dynastyId: string, teamIndex: number, edit: TeamBudgetEdit): Promise<SaveEditResult> => {
      return saveTeamBudget(dynastyId, teamIndex, edit);
    },
  );

  ipcMain.handle(
    IPC.editor.forceCommitRecruit,
    async (_event, dynastyId: string, playerId: number): Promise<ForceCommitResult> => {
      return forceCommitRecruit(dynastyId, playerId);
    },
  );

  ipcMain.handle(
    IPC.editor.searchPortraits,
    async (
      _event,
      kind: 'player' | 'coach',
      query: string,
      filters: PortraitFilters,
      page: number,
    ): Promise<PortraitSearchResponse> => {
      return searchPortraits(kind, query, filters, page);
    },
  );
}
