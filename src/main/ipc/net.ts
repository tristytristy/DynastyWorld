import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { getEditions, getFeedView, getMediaComments, setUserIdentity } from '../../database/dynastyNet';
import { generateMediaComments, generateWeek, replyInThread, replyToUserPost } from '../net/generate';
import { getPublicSettings, setApiKey } from '../net/settings';
import type { NetFeedView, NetGenerateResult, NetPost, NetSettings } from '../../shared/netTypes';

/** DynastyNet IPC — the fake internet's read + generate surface. */
export function registerNetHandlers(): void {
  ipcMain.handle(IPC.net.getFeed, (_e, dynastyId: string, seasonId: number): NetFeedView => {
    return getFeedView(dynastyId, seasonId);
  });

  ipcMain.handle(
    IPC.net.getEditions,
    (_e, dynastyId: string, seasonId: number, kind: 'article' | 'podcast'): NetPost[] => {
      return getEditions(dynastyId, seasonId, kind);
    },
  );

  ipcMain.handle(IPC.net.getMediaComments, (_e, dynastyId: string, mediaId: number): NetPost[] => {
    return getMediaComments(dynastyId, mediaId);
  });

  ipcMain.handle(
    IPC.net.generateWeek,
    async (_e, dynastyId: string, seasonId: number, regenerate: boolean): Promise<NetGenerateResult> => {
      return generateWeek(dynastyId, seasonId, regenerate);
    },
  );

  ipcMain.handle(
    IPC.net.postAsUser,
    async (_e, dynastyId: string, seasonId: number, accountId: number, body: string): Promise<NetGenerateResult> => {
      return replyToUserPost(dynastyId, seasonId, accountId, body);
    },
  );

  ipcMain.handle(
    IPC.net.generateMediaComments,
    async (_e, dynastyId: string, seasonId: number, mediaId: number): Promise<NetGenerateResult> => {
      return generateMediaComments(dynastyId, seasonId, mediaId);
    },
  );

  ipcMain.handle(
    IPC.net.setUserIdentity,
    (_e, dynastyId: string, handle: string, displayName: string) => setUserIdentity(dynastyId, handle, displayName),
  );

  ipcMain.handle(
    IPC.net.replyToPost,
    async (
      _e,
      dynastyId: string,
      seasonId: number,
      accountId: number,
      parentId: number,
      body: string,
    ): Promise<NetGenerateResult> => {
      return replyInThread(dynastyId, seasonId, accountId, parentId, body);
    },
  );

  ipcMain.handle(IPC.net.getSettings, (): NetSettings => getPublicSettings());

  ipcMain.handle(IPC.net.setApiKey, (_e, apiKey: string): NetSettings => {
    setApiKey(apiKey);
    return getPublicSettings();
  });
}
