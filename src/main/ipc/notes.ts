import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import {
  createPlayerNote,
  deletePlayerNote,
  listNoteTitleSuggestions,
  listPlayerNotes,
  updatePlayerNote,
} from '../../database/playerNotes';
import type { PlayerNote } from '../../shared/types';

export function registerNotesHandlers(): void {
  ipcMain.handle(IPC.notes.list, async (_event, dynastyId: string, playerId: number): Promise<PlayerNote[]> => {
    return listPlayerNotes(dynastyId, playerId);
  });

  ipcMain.handle(
    IPC.notes.create,
    async (_event, dynastyId: string, playerId: number, title: string, body: string): Promise<PlayerNote> => {
      return createPlayerNote(dynastyId, playerId, title, body);
    },
  );

  ipcMain.handle(
    IPC.notes.update,
    async (_event, id: number, title: string, body: string): Promise<PlayerNote | null> => {
      return updatePlayerNote(id, title, body);
    },
  );

  ipcMain.handle(IPC.notes.remove, async (_event, id: number): Promise<void> => {
    deletePlayerNote(id);
  });

  ipcMain.handle(IPC.notes.titleSuggestions, async (_event, dynastyId: string): Promise<string[]> => {
    return listNoteTitleSuggestions(dynastyId);
  });
}
