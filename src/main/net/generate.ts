import { buildWeekContext, type NetWeekContext } from './context';
import { FIXED_CAST, fanFor, userAccountFor, type CastMember } from './cast';
import { offlineWeek, offlineReplies, offlineMediaComments, type DraftPost } from './offline';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import {
  clearMediaComments,
  clearWeek,
  ensureAccounts,
  getAccounts,
  getMediaComments,
  getRecentPosts,
  getThread,
  insertPosts,
  lastInsertId,
  weekHasPosts,
} from '../../database/dynastyNet';
import { listMediaItems } from '../../database/media';
import { withBatchedPersist } from '../../database/init';
import { getRoster } from '../../database/getRoster';
import { getSchedule } from '../../database/getSchedule';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getAllLeaguePlayers } from '../../database/getLeagueRoster';
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
    userAccountFor(),
  ];
  const accounts = ensureAccounts(dynastyId, wanted);
  return new Map(accounts.map((a) => [a.handle, a]));
}

/**
 * The Net's memory, formatted for a prompt. Everything the cast has said
 * recently (and everything the user said) — so feuds continue, old takes get
 * quoted back, and bad predictions get receipts.
 */
function memoryDigest(dynastyId: string): string {
  const recent = getRecentPosts(dynastyId, 40);
  if (!recent.length) return '';
  const lines = recent.map((r) => `${r.handle}${r.isUser ? ' [the human fan]' : ''} (wk ${r.week}): ${r.body}`);
  return `\n\nTHE NET'S RECENT HISTORY (memory — stay consistent with it, continue feuds, call back to old takes, hold accounts accountable for bad predictions):\n${lines.join('\n')}`;
}

function userHandleOf(dynastyId: string, accountId: number): string {
  return getAccounts(dynastyId).find((a) => a.id === accountId)?.handle ?? '@fan';
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

/**
 * Handle lookup that survives model drift: exact, then case-insensitive,
 * then with the @ stripped. A generated voice we can't place is better
 * attributed to a real cast member than silently dropped.
 */
export function resolveHandle(byHandle: Map<string, NetAccount>, handle: string): NetAccount | undefined {
  const direct = byHandle.get(handle);
  if (direct) return direct;
  const wanted = handle.replace(/^@/, '').toLowerCase();
  for (const [key, account] of byHandle) {
    if (key.replace(/^@/, '').toLowerCase() === wanted) return account;
  }
  return undefined;
}

function draftsToRows(
  seasonId: number,
  week: number,
  drafts: DraftPost[],
  byHandle: Map<string, NetAccount>,
  dynastyId: string,
): number {
  let added = 0;
  for (const d of drafts) {
    const account = resolveHandle(byHandle, d.handle);
    if (!account) continue;
    insertPosts(dynastyId, [
      { seasonId, accountId: account.id, kind: 'post', body: d.body, likes: d.likes, week },
    ]);
    const parentId = lastInsertId();
    added += 1;
    // parentId of 0 means the connection was flushed underneath us (see
    // dynastyNet.ts) — drop the replies rather than crash the whole week.
    if (parentId === 0) continue;
    for (const r of d.replies) {
      const replier = resolveHandle(byHandle, r.handle);
      if (!replier) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: replier.id, kind: 'reply', parentId, body: r.body, likes: r.likes, week },
      ]);
      added += 1;
    }
  }
  return added;
}


/**
 * One line the model can't miss when a dynasty runs in neutral observer mode
 * — appended to every prompt that carries the week context, because the ctx
 * JSON alone ("userTeam": "") is too easy to gloss over.
 */
function neutralNote(ctx: NetWeekContext): string {
  return ctx.neutral
    ? '\n\nNOTE: This dynasty is run by a NEUTRAL COMMISSIONER \u2014 no team is "the user\'s team". Cover the whole nation impartially, like a national desk; never invent a home team or address the user as a fan of one.'
    : '';
}

export async function generateWeek(
  dynastyId: string,
  seasonId: number,
  regenerate: boolean,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (weekHasPosts(dynastyId, seasonId, ctx.week) && !regenerate) {
    // Name the week: the Net runs on the latest week with REVEALED results, so
    // right after advancing (bowl entry especially) this fires for the same
    // week as before and needs to say why nothing new appeared.
    return {
      ok: true,
      engine: 'offline',
      message: `Week ${ctx.week} already has chatter — the next round drops once more games are in the books (play or advance, then sync).`,
      postsAdded: 0,
    };
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
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nTHIS WEEK'S DATA:\n${JSON.stringify(ctx, null, 1)}${memoryDigest(dynastyId)}${neutralNote(ctx)}`,
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

  // One batch for the whole landing: a reply's parent_id comes from
  // lastInsertId(), which only survives until the next flush (see
  // dynastyNet.ts) — and one flush instead of ~30 is the same perf rule
  // persistExtraction follows.
  const added = withBatchedPersist(() => {
    let n = draftsToRows(seasonId, ctx.week, drafts, byHandle, dynastyId);
    const paper = byHandle.get('@TheCrystalFB');
    if (article && paper) {
      insertPosts(dynastyId, [
        { seasonId, accountId: paper.id, kind: 'article', title: article.headline, body: article.body, week: ctx.week },
      ]);
      n += 1;
    }
    const pod = byHandle.get('@4thAndForever');
    if (podcast && pod) {
      insertPosts(dynastyId, [
        { seasonId, accountId: pod.id, kind: 'podcast', title: podcast.title, body: podcast.body, week: ctx.week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}

const REPLY_SYSTEM = `You write replies on a fictional college-football social network for a video-game dynasty. The post below is from {HANDLE} — to everyone on the Net this is just another ordinary fan account. Never treat them as a coach, insider, or anyone special; they get the same energy any random fan gets: argue, agree, dunk, pile on, reminisce. Stay factual to the data. Return ONLY JSON: [{"handle","body","likes":int}] with 2-4 replies. Use only cast handles.`;

export async function replyToUserPost(
  dynastyId: string,
  seasonId: number,
  userAccountId: number,
  body: string,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  const byHandle = ensureCastFor(dynastyId, ctx);

  const parentId = withBatchedPersist(() => {
    insertPosts(dynastyId, [
      { seasonId, accountId: userAccountId, kind: 'post', body, week: ctx.week },
    ]);
    return lastInsertId();
  });

  let replies: { handle: string; body: string; likes: number }[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      replies = await generateJson<{ handle: string; body: string; likes?: number }[]>(
        REPLY_SYSTEM.replace('{HANDLE}', userHandleOf(dynastyId, userAccountId)),
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}${memoryDigest(dynastyId)}${neutralNote(ctx)}\n\nUSER POST:\n${body}`,
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

  const added = withBatchedPersist(() => {
    let n = 1;
    for (const r of replies) {
      const account = byHandle.get(r.handle);
      if (!account) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: account.id, kind: 'reply', parentId, body: r.body, likes: r.likes, week: ctx.week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}

const COMMENTS_SYSTEM = `You write the comment section under a highlight upload on a fictional video site for a college-football video-game dynasty. Bots argue about GOATs, stats, worst moments, favorite plays, clutch moments — grounded in the clip's real game and players. If still frames from the clip are attached, you have WATCHED it: react to what actually happens on screen (the play, the formations, the broadcast score bug — read it for score/time/quarter if visible). Return ONLY JSON: [{"handle","body","likes":int,"replies":[{"handle","body","likes":int}]}] with 3-5 top-level comments, 0-2 replies each. Use only cast handles.`;

export type MediaCommentMode = 'more' | 'fresh';

export async function generateMediaComments(
  dynastyId: string,
  seasonId: number,
  mediaId: number,
  mode: MediaCommentMode = 'more',
  frames: string[] = [],
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (mode === 'fresh') clearMediaComments(dynastyId, mediaId);
  const existing = getMediaComments(dynastyId, mediaId);
  const byHandle = ensureCastFor(dynastyId, ctx);

  const items = listMediaItems(dynastyId, seasonId) ?? [];
  const item = items.find((m) => m.id === mediaId);
  const roster = getRoster(dynastyId, seasonId) ?? [];
  const leaguePlayers = getAllLeaguePlayers(dynastyId, seasonId) ?? [];
  const players = (item?.playerIds ?? [])
    .map((pid) => roster.find((p) => p.id === pid) ?? leaguePlayers.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => `${p.firstName} ${p.lastName} (${p.position}${'teamDisplayName' in p ? `, ${(p as { teamDisplayName: string }).teamDisplayName}` : ''})`);
  const schedule = getSchedule(dynastyId, seasonId);
  const game = item?.gameId != null ? schedule?.games.find((g) => g.gameId === item.gameId) ?? null : null;
  // National games (taggable since the pickers opened up to the whole slate)
  // aren't on the user's schedule — resolve them from the league scores.
  const leagueGame =
    !game && item?.gameId != null
      ? getLeagueScores(dynastyId, seasonId)?.games.find((g) => g.gameId === item.gameId) ?? null
      : null;
  const gameLabel = game
    ? `${ctx.userTeam} ${game.teamScore ?? ''}-${game.opponentScore ?? ''} ${game.isHome ? 'vs' : 'at'} ${game.opponent}, week ${game.week}`
    : leagueGame
      ? `${leagueGame.awayTeamName} ${leagueGame.awayScore ?? ''}-${leagueGame.homeScore ?? ''} at ${leagueGame.homeTeamName}, week ${leagueGame.week}`
      : null;

  let drafts: DraftPost[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      const alreadySaid = existing.length
        ? `\n\nCOMMENTS ALREADY POSTED (write NEW comments — react to them or take new angles, never repeat):\n${existing
            .flatMap((c) => [`${c.handle}: ${c.body}`, ...c.replies.map((r) => `${r.handle}: ${r.body}`)])
            .join('\n')}`
        : '';
      const playLines = (item?.plays ?? [])
        .map(
          (p) =>
            `Q${p.quarter} ${Math.floor(p.clockSeconds / 60)}:${String(p.clockSeconds % 60).padStart(2, '0')} — ${p.teamName ?? 'score'} ${p.playType} (+${p.points + p.conversionPoints}), score after: ${p.awayScore}-${p.homeScore}`,
        )
        .join('\n');
      const raw = await generateJson<ModelPost[]>(
        COMMENTS_SYSTEM,
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nCLIP: ${item?.description || 'untitled highlight'}\nGAME: ${gameLabel ?? 'unknown'}\nTAGGED PLAYERS: ${players.join(', ') || 'none'}${playLines ? `\nPLAYS SHOWN IN THIS CLIP (uploader-confirmed — react to THESE moments specifically):\n${playLines}` : ''}\n\nSEASON CONTEXT:\n${JSON.stringify(ctx, null, 1)}${alreadySaid}${neutralNote(ctx)}`,
        2500,
        frames,
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

  const added = withBatchedPersist(() => {
    let n = 0;
    for (const d of drafts) {
      const account = resolveHandle(byHandle, d.handle);
      if (!account) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: account.id, kind: 'comment', mediaId, body: d.body, likes: d.likes, week: ctx.week },
      ]);
      const parentId = lastInsertId();
      n += 1;
      if (parentId === 0) continue;
      for (const r of d.replies) {
        const replier = resolveHandle(byHandle, r.handle);
        if (!replier) continue;
        insertPosts(dynastyId, [
          { seasonId, accountId: replier.id, kind: 'comment', mediaId, parentId, body: r.body, likes: r.likes, week: ctx.week },
        ]);
        n += 1;
      }
    }
    return n;
  });
  if (added === 0 && !message) {
    message = 'The engine came back with nothing usable — hit the button again.';
  }
  return { ok: true, engine, message, postsAdded: added };
}

export type { NetPost };

const THREAD_SYSTEM = `You write the next replies in an ongoing thread on a fictional college-football social network for a video-game dynasty. The newest reply is from {HANDLE} — an ordinary fan account (the human player); never treat them as a coach or insider. Cast members already in the thread stay consistent with what they said; others may jump in. Argue, agree, dunk, escalate — stay factual to the data. Return ONLY JSON: [{"handle","body","likes":int}] with 1-3 replies continuing the thread. Use only cast handles.`;

export async function replyInThread(
  dynastyId: string,
  seasonId: number,
  userAccountId: number,
  parentId: number,
  body: string,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  const byHandle = ensureCastFor(dynastyId, ctx);
  const thread = getThread(dynastyId, parentId);
  if (!thread) return { ok: false, engine: 'offline', message: 'That post no longer exists.', postsAdded: 0 };

  withBatchedPersist(() => {
    insertPosts(dynastyId, [
      { seasonId, accountId: userAccountId, kind: 'reply', parentId, body, week: ctx.week },
    ]);
  });

  const transcript = [
    `${thread.handle}: ${thread.body}`,
    ...thread.replies.map((r) => `${r.handle}: ${r.body}`),
    `${userHandleOf(dynastyId, userAccountId)}: ${body}`,
  ].join('\n');

  let replies: { handle: string; body: string; likes: number }[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      replies = await generateJson<{ handle: string; body: string; likes?: number }[]>(
        THREAD_SYSTEM.replace('{HANDLE}', userHandleOf(dynastyId, userAccountId)),
        `CAST:\n${castPrompt([...FIXED_CAST, ...ctx.teamsInTheNews.map(fanFor)])}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}${memoryDigest(dynastyId)}${neutralNote(ctx)}\n\nTHREAD (oldest first):\n${transcript}`,
        1200,
      ).then((rs) => rs.map((r) => ({ handle: r.handle, body: r.body, likes: r.likes ?? 0 })));
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      replies = offlineReplies(body, ctx).slice(0, 2);
    }
  } else {
    replies = offlineReplies(body, ctx).slice(0, 2);
  }

  const added = withBatchedPersist(() => {
    let n = 1;
    for (const r of replies) {
      const account = byHandle.get(r.handle);
      if (!account) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: account.id, kind: 'reply', parentId, body: r.body, likes: r.likes, week: ctx.week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}
