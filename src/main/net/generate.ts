import { buildWeekContext, type NetWeekContext } from './context';
import { FIXED_CAST, fanFor, userAccountFor, type CastMember } from './cast';
import { offlineWeek, offlineReplies, offlineMediaComments, type DraftPost } from './offline';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import {
  clearWeek,
  ensureAccounts,
  getMediaComments,
  insertPosts,
  lastInsertId,
  weekHasPosts,
} from '../../database/dynastyNet';
import { listMediaItems } from '../../database/media';
import { getRoster } from '../../database/getRoster';
import { getSchedule } from '../../database/getSchedule';
import type { NetAccount, NetGenerateResult, NetPost } from '../../shared/netTypes';

/**
 * Generation orchestrator: builds the week's context from the archive, asks
 * the live engine (Claude) to write the content, falls back to the offline
 * template engine on any failure, and lands everything in net_posts.
 */

function castPrompt(cast: CastMember[]): string {
  return cast
    .filter((c) => c.kind !== 'user')
    .map((c) => `${c.handle} ("${c.displayName}"): ${c.persona}`)
    .join('\n');
}

function ensureCastFor(dynastyId: string, ctx: NetWeekContext): Map<string, NetAccount> {
  const wanted: CastMember[] = [
    ...FIXED_CAST,
    ...ctx.teamsInTheNews.map((t) => fanFor(t)),
    userAccountFor(ctx.userTeam),
  ];
  const accounts = ensureAccounts(dynastyId, wanted);
  return new Map(accounts.map((a) => [a.handle, a]));
}

interface ModelPost {
  handle: string;
  body: string;
  likes?: number;
  replies?: { handle: string; body: string; likes?: number }[];
}

interface ModelWeek {
  posts: ModelPost[];
  article?: { headline: string; body: string };
  podcast?: { title: string; body: string };
}

const WEEK_SYSTEM = `You write a fictional college-football internet for a video-game dynasty. You are given this week's REAL results from the save file and a recurring cast of fake accounts. Everything factual (scores, records, ranks, player stats, team names) must come from the data — never invent results. The personalities, feuds and jokes are yours.

Return ONLY JSON (no fences) shaped as:
{"posts":[{"handle","body","likes":int,"replies":[{"handle","body","likes":int}]}],
 "article":{"headline","body"},
 "podcast":{"title","body"}}

- 8-12 posts reacting to the week: trash talk, poll debates, stat takes, fan meltdowns, running feuds between the cast. 0-2 replies each. Use only cast handles.
- "article" is the front page of The Crystal Football, the nation's paper of record: pick the week's biggest story, write 2 vivid newspaper paragraphs.
- "podcast" is the episode summary of 4th & Forever (two hosts who disagree): teams rising/falling, hot seats, one overreaction-of-the-week, 1 paragraph.`;

function draftsToRows(
  seasonId: number,
  week: number,
  drafts: DraftPost[],
  byHandle: Map<string, NetAccount>,
  dynastyId: string,
): number {
  let added = 0;
  for (const d of drafts) {
    const account = byHandle.get(d.handle);
    if (!account) continue;
    insertPosts(dynastyId, [
      { seasonId, accountId: account.id, kind: 'post', body: d.body, likes: d.likes, week },
    ]);
    const parentId = lastInsertId();
    added += 1;
    for (const r of d.replies) {
      const replier = byHandle.get(r.handle);
      if (!replier) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: replier.id, kind: 'reply', parentId, body: r.body, likes: r.likes, week },
      ]);
      added += 1;
    }
  }
  return added;
}

export async function generateWeek(
  dynastyId: string,
  seasonId: number,
  regenerate: boolean,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (weekHasPosts(dynastyId, seasonId, ctx.week) && !regenerate) {
    return { ok: true, engine: 'offline', message: 'This week already has chatter.', postsAdded: 0 };
  }
  const byHandle = ensureCastFor(dynastyId, ctx);
  if (regenerate) clearWeek(dynastyId, seasonId, ctx.week);

  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  let drafts: DraftPost[];
  let article: { headline: string; body: string } | null;
  let podcast: { title: string; body: string } | null;

  if (hasLiveEngine()) {
    try {
      const out = await generateJson<ModelWeek>(
        WEEK_SYSTEM,
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nTHIS WEEK'S DATA:\n${JSON.stringify(ctx, null, 1)}`,
        6000,
      );
      drafts = (out.posts ?? []).map((p) => ({
        handle: p.handle,
        body: p.body,
        likes: p.likes ?? 0,
        replies: (p.replies ?? []).map((r) => ({ handle: r.handle, body: r.body, likes: r.likes ?? 0 })),
      }));
      article = out.article ?? null;
      podcast = out.podcast ?? null;
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      const offline = offlineWeek(ctx);
      drafts = offline.posts;
      article = offline.article;
      podcast = offline.podcast;
    }
  } else {
    const offline = offlineWeek(ctx);
    drafts = offline.posts;
    article = offline.article;
    podcast = offline.podcast;
  }

  let added = draftsToRows(seasonId, ctx.week, drafts, byHandle, dynastyId);
  const paper = byHandle.get('@TheCrystalFB');
  if (article && paper) {
    insertPosts(dynastyId, [
      { seasonId, accountId: paper.id, kind: 'article', title: article.headline, body: article.body, week: ctx.week },
    ]);
    added += 1;
  }
  const pod = byHandle.get('@4thAndForever');
  if (podcast && pod) {
    insertPosts(dynastyId, [
      { seasonId, accountId: pod.id, kind: 'podcast', title: podcast.title, body: podcast.body, week: ctx.week },
    ]);
    added += 1;
  }
  return { ok: true, engine, message, postsAdded: added };
}

const REPLY_SYSTEM = `You write replies on a fictional college-football social network for a video-game dynasty. The user (the human coach of {TEAM}) just posted. The cast replies in character — argue, agree, pile on, reminisce; stay factual to the data. Return ONLY JSON: [{"handle","body","likes":int}] with 2-4 replies. Use only cast handles.`;

export async function replyToUserPost(
  dynastyId: string,
  seasonId: number,
  userAccountId: number,
  body: string,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  const byHandle = ensureCastFor(dynastyId, ctx);

  insertPosts(dynastyId, [
    { seasonId, accountId: userAccountId, kind: 'post', body, week: ctx.week },
  ]);
  const parentId = lastInsertId();

  let replies: { handle: string; body: string; likes: number }[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      replies = await generateJson<{ handle: string; body: string; likes?: number }[]>(
        REPLY_SYSTEM.replace('{TEAM}', ctx.userTeam),
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}\n\nUSER POST:\n${body}`,
        1500,
      ).then((rs) => rs.map((r) => ({ handle: r.handle, body: r.body, likes: r.likes ?? 0 })));
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      replies = offlineReplies(body, ctx);
    }
  } else {
    replies = offlineReplies(body, ctx);
  }

  let added = 1;
  for (const r of replies) {
    const account = byHandle.get(r.handle);
    if (!account) continue;
    insertPosts(dynastyId, [
      { seasonId, accountId: account.id, kind: 'reply', parentId, body: r.body, likes: r.likes, week: ctx.week },
    ]);
    added += 1;
  }
  return { ok: true, engine, message, postsAdded: added };
}

const COMMENTS_SYSTEM = `You write the comment section under a highlight upload on a fictional video site for a college-football video-game dynasty. Bots argue about GOATs, stats, worst moments, favorite plays, clutch moments — grounded in the clip's real game and players. Return ONLY JSON: [{"handle","body","likes":int,"replies":[{"handle","body","likes":int}]}] with 3-5 top-level comments, 0-2 replies each. Use only cast handles.`;

export async function generateMediaComments(
  dynastyId: string,
  seasonId: number,
  mediaId: number,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (getMediaComments(dynastyId, mediaId).length > 0) {
    return { ok: true, engine: 'offline', message: 'Comments already loaded.', postsAdded: 0 };
  }
  const byHandle = ensureCastFor(dynastyId, ctx);

  const items = listMediaItems(dynastyId, seasonId) ?? [];
  const item = items.find((m) => m.id === mediaId);
  const roster = getRoster(dynastyId, seasonId) ?? [];
  const players = (item?.playerIds ?? [])
    .map((pid) => roster.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${p.firstName} ${p.lastName} (${p.position})`);
  const schedule = getSchedule(dynastyId, seasonId);
  const game = item?.gameId != null ? schedule?.games.find((g) => g.gameId === item.gameId) ?? null : null;
  const gameLabel = game
    ? `${ctx.userTeam} ${game.teamScore ?? ''}-${game.opponentScore ?? ''} ${game.isHome ? 'vs' : 'at'} ${game.opponent}, week ${game.week}`
    : null;

  let drafts: DraftPost[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      const raw = await generateJson<ModelPost[]>(
        COMMENTS_SYSTEM,
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nCLIP: ${item?.description || 'untitled highlight'}\nGAME: ${gameLabel ?? 'unknown'}\nTAGGED PLAYERS: ${players.join(', ') || 'none'}\n\nSEASON CONTEXT:\n${JSON.stringify(ctx, null, 1)}`,
        2500,
      );
      drafts = raw.map((p) => ({
        handle: p.handle,
        body: p.body,
        likes: p.likes ?? 0,
        replies: (p.replies ?? []).map((r) => ({ handle: r.handle, body: r.body, likes: r.likes ?? 0 })),
      }));
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      drafts = offlineMediaComments(item?.description ?? '', gameLabel, players, ctx);
    }
  } else {
    drafts = offlineMediaComments(item?.description ?? '', gameLabel, players, ctx);
  }

  let added = 0;
  for (const d of drafts) {
    const account = byHandle.get(d.handle);
    if (!account) continue;
    insertPosts(dynastyId, [
      { seasonId, accountId: account.id, kind: 'comment', mediaId, body: d.body, likes: d.likes, week: ctx.week },
    ]);
    const parentId = lastInsertId();
    added += 1;
    for (const r of d.replies) {
      const replier = byHandle.get(r.handle);
      if (!replier) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: replier.id, kind: 'comment', mediaId, parentId, body: r.body, likes: r.likes, week: ctx.week },
      ]);
      added += 1;
    }
  }
  return { ok: true, engine, message, postsAdded: added };
}

export type { NetPost };
