import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import type {
  CoachEditData,
  CoachEditFields,
  PlayerEditData,
  PlayerEditFields,
  PortraitFilters,
  PortraitSearchResponse,
  RecruitEditData,
  RecruitEditFields,
  RecruitInfluenceEdit,
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
import { saveRecruitInfluence } from '../recruitingWrite';

export function registerEditorHandlers(): void {
  ipcMain.handle(IPC.editor.backupSaveFile, async (_event, dynastyId: string): Promise<SaveFileBackupResult> => {
    return backupSaveFile(dynastyId);
  });

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
