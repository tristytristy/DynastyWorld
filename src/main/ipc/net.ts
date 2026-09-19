import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipcChannels';
import { adjustPostLikes, getEditions, getFeedView, getHistorianArticles, getMediaComments, getRepliesToUser, getThreads, setUserIdentity } from '../../database/dynastyNet';
import { askHistorian } from '../net/historian';
import { autoCaption, generateMediaComments, generateWeek, replyInThread, replyToUserPost } from '../net/generate';
import { getPublicSettings, setApiKey } from '../net/settings';
import { getDynastyById, setDynastyBoardFlair, setDynastyInboxSeen, setDynastyNeutralMode } from '../../database/helpers';
import { TOP10_TOPICS, generateThrowback, generateTop10 } from '../net/shows';
import { createBoardThread, generateBoardWeek, replyToBoardThread } from '../net/board';
import { generateSelectionReaction } from '../net/selection';
import type { NetCaptionResult, NetClipInfo, NetFeedView, NetGenerateResult, NetInboxView, NetPost, NetSettings } from '../../shared/netTypes';

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
      clip?: NetClipInfo,
    ): Promise<NetGenerateResult> => {
      try {
        return await generateMediaComments(dynastyId, seasonId, mediaId, mode, frames, clip);
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

  ipcMain.handle(IPC.net.askHistorian, async (_e, dynastyId: string, question: string): Promise<NetGenerateResult> => {
    try {
      return await askHistorian(dynastyId, question);
    } catch (err) {
      console.error('[net] askHistorian failed:', err);
      return {
        ok: false,
        engine: 'offline',
        message: `The Historian hit a snag: ${err instanceof Error ? err.message : String(err)}`,
        postsAdded: 0,
      };
    }
  });

  ipcMain.handle(IPC.net.getHistorianArticles, (_e, dynastyId: string): NetPost[] => {
    return getHistorianArticles(dynastyId);
  });

  ipcMain.handle(IPC.net.getNeutralMode, (_e, dynastyId: string): boolean => {
    return getDynastyById(dynastyId)?.neutralMode ?? false;
  });

  ipcMain.handle(IPC.net.setNeutralMode, (_e, dynastyId: string, neutral: boolean): boolean => {
    setDynastyNeutralMode(dynastyId, neutral);
    return getDynastyById(dynastyId)?.neutralMode ?? false;
  });

  ipcMain.handle(
    IPC.net.generateSelection,
    async (_e, dynastyId: string, seasonId: number): Promise<NetGenerateResult> => {
      try {
        return await generateSelectionReaction(dynastyId, seasonId);
      } catch (err) {
        console.error('[net] generateSelection failed:', err);
        return {
          ok: false,
          engine: 'offline',
          message: `The reveal special failed: ${err instanceof Error ? err.message : String(err)}`,
          postsAdded: 0,
        };
      }
    },
  );

  ipcMain.handle(IPC.net.getBoardFlair, (_e, dynastyId: string): string => {
    return getDynastyById(dynastyId)?.boardFlair ?? '';
  });

  ipcMain.handle(IPC.net.setBoardFlair, (_e, dynastyId: string, flair: string): string => {
    setDynastyBoardFlair(dynastyId, flair);
    return getDynastyById(dynastyId)?.boardFlair ?? '';
  });

  ipcMain.handle(IPC.net.votePost, (_e, dynastyId: string, postId: number, delta: number): number => {
    return adjustPostLikes(dynastyId, postId, delta);
  });

  ipcMain.handle(IPC.net.getInbox, (_e, dynastyId: string): NetInboxView => {
    return { items: getRepliesToUser(dynastyId), lastSeenId: getDynastyById(dynastyId)?.netInboxSeenId ?? 0 };
  });

  ipcMain.handle(IPC.net.markInboxSeen, (_e, dynastyId: string, seenId: number): void => {
    setDynastyInboxSeen(dynastyId, seenId);
  });

  ipcMain.handle(
    IPC.net.autoCaption,
    async (_e, dynastyId: string, seasonId: number, mediaId: number, frames: string[] = []): Promise<NetCaptionResult> => {
      try {
        return await autoCaption(dynastyId, seasonId, mediaId, frames);
      } catch (err) {
        console.error('[net] autoCaption failed:', err);
        return { ok: false, message: `Auto-caption failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    },
  );

  ipcMain.handle(IPC.net.getSettings, (): NetSettings => getPublicSettings());

  ipcMain.handle(IPC.net.setApiKey, (_e, apiKey: string): NetSettings => {
    setApiKey(apiKey);
    return getPublicSettings();
  });
}
