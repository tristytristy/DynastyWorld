import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { getEditions, getFeedView, getMediaComments, getThreads, setUserIdentity } from '../../database/dynastyNet';
import { generateMediaComments, generateWeek, replyInThread, replyToUserPost } from '../net/generate';
import { getPublicSettings, setApiKey } from '../net/settings';
import { TOP10_TOPICS, generateThrowback, generateTop10 } from '../net/shows';
import { createBoardThread, generateBoardWeek, replyToBoardThread } from '../net/board';
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
    async (
      _e,
      dynastyId: string,
      seasonId: number,
      mediaId: number,
      mode: 'more' | 'fresh' = 'more',
      frames: string[] = [],
    ): Promise<NetGenerateResult> => {
      try {
        return await generateMediaComments(dynastyId, seasonId, mediaId, mode, frames);
      } catch (err) {
        // Surface instead of vanish: an uncaught throw here left the renderer
        // spinning with no comments and no explanation.
        console.error('[net] generateMediaComments failed:', err);
        return {
          ok: false,
          engine: 'offline',
          message: `Comment generation failed: ${err instanceof Error ? err.message : String(err)}`,
          postsAdded: 0,
        };
      }
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

  ipcMain.handle(IPC.net.getThreads, (_e, dynastyId: string, seasonId: number): NetPost[] => {
    return getThreads(dynastyId, seasonId);
  });

  ipcMain.handle(
    IPC.net.generateBoardWeek,
    async (_e, dynastyId: string, seasonId: number, regenerate = false): Promise<NetGenerateResult> => {
      try {
        return await generateBoardWeek(dynastyId, seasonId, regenerate);
      } catch (err) {
        console.error('[net] generateBoardWeek failed:', err);
        return {
          ok: false,
          engine: 'offline',
          message: `Board generation failed: ${err instanceof Error ? err.message : String(err)}`,
          postsAdded: 0,
        };
      }
    },
  );

  ipcMain.handle(
    IPC.net.createThread,
    async (_e, dynastyId: string, seasonId: number, accountId: number, title: string, body: string): Promise<NetGenerateResult> => {
      return createBoardThread(dynastyId, seasonId, accountId, title, body);
    },
  );

  ipcMain.handle(
    IPC.net.replyToThread,
    async (_e, dynastyId: string, seasonId: number, accountId: number, threadId: number, body: string): Promise<NetGenerateResult> => {
      return replyToBoardThread(dynastyId, seasonId, accountId, threadId, body);
    },
  );

  ipcMain.handle(IPC.net.getTop10Topics, () => TOP10_TOPICS.map(({ key, label, group, angle }) => ({ key, label, group, angle })));

  ipcMain.handle(IPC.net.generateThrowback, async (_e, dynastyId: string): Promise<NetGenerateResult> => {
    return generateThrowback(dynastyId);
  });

  ipcMain.handle(
    IPC.net.generateTop10,
    async (_e, dynastyId: string, topicKey: string): Promise<NetGenerateResult> => {
      return generateTop10(dynastyId, topicKey);
    },
  );

  ipcMain.handle(IPC.net.getSettings, (): NetSettings => getPublicSettings());

  ipcMain.handle(IPC.net.setApiKey, (_e, apiKey: string): NetSettings => {
    setApiKey(apiKey);
    return getPublicSettings();
  });
}
