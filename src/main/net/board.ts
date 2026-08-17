import { buildWeekContext } from './context';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import {
  ensureAccounts,
  getAccounts,
  getRecentPosts,
  getThread,
  getThreads,
  insertPosts,
  lastInsertId,
} from '../../database/dynastyNet';
import { withBatchedPersist } from '../../database/init';
import type { CastMember } from './cast';
import type { NetAccount, NetGenerateResult } from '../../shared/netTypes';

/**
 * TheSideline.net — the Net's message board. A different internet culture
 * from the Feed: no character limit, no likes, decade-old usernames who type
 * in paragraphs, quote each other, and hold grudges older than the roster.
 * Threads react to the week; the user starts threads and replies like any
 * other poster, and the regulars pile in.
 */

export const BOARD_CAST: CastMember[] = [
  {
    handle: 'OldGold_Stan',
    displayName: 'OldGold_Stan',
    kind: 'bot',
    persona: 'Board elder, joined day one. Types multi-paragraph essays with a formal sign-off. Remembers every season and corrects everyone, gently.',
  },
  {
    handle: 'xX_BlitzKing_Xx',
    displayName: 'xX_BlitzKing_Xx',
    kind: 'bot',
    persona: 'Perpetual doomer. Every win is fool’s gold, every loss is the end of the program. CAPS when spiraling.',
  },
  {
    handle: 'StatGuy_Larry',
    displayName: 'StatGuy_Larry',
    kind: 'bot',
    persona: 'Posts tables of numbers nobody asked for and stands by them. Signature: "The numbers don’t lie. People do."',
  },
  {
    handle: 'FireEveryone_Frank',
    displayName: 'FireEveryone_Frank',
    kind: 'bot',
    persona: 'Wants the coach fired after wins AND losses. Has drafted the same "it’s time for a change" post since forever.',
  },
  {
    handle: 'ConcessionsConnie',
    displayName: 'ConcessionsConnie',
    kind: 'bot',
    persona: 'Season-ticket holder since before the board existed. Derails arguments with tailgate menus and parking-lot gossip, then drops one devastatingly correct football take.',
  },
  {
    handle: 'Lurker_Since_09',
    displayName: 'Lurker_Since_09',
    kind: 'bot',
    persona: 'Almost never posts. When they do, it’s one short line the whole board quotes for weeks.',
  },
];

function boardCastPrompt(): string {
  return BOARD_CAST.map((c) => `${c.handle}: ${c.persona}`).join('\n');
}

function ensureBoardAccounts(dynastyId: string): Map<string, NetAccount> {
  const accounts = ensureAccounts(dynastyId, BOARD_CAST);
  return new Map(accounts.map((a) => [a.handle, a]));
}

function boardMemory(dynastyId: string): string {
  const recent = getRecentPosts(dynastyId, 30, ['thread', 'reply']);
  if (!recent.length) return '';
  const lines = recent.map((r) => `${r.handle}${r.isUser ? ' [the human poster]' : ''}: ${r.body}`);
  return `\n\nRECENT BOARD HISTORY (stay consistent, keep the grudges and running bits going):\n${lines.join('\n')}`;
}

interface ModelThread {
  title: string;
  author: string;
  body: string;
  replies?: { author: string; body: string }[];
}

const BOARD_WEEK_SYSTEM = `You write TheSideline.net — an old-school college-football message board in a video-game dynasty universe. Culture: no character limits, no likes, decade-old usernames, people quote each other with >, essays get posted at 1am, threads derail and come back. Everything factual must come from the week's data — never invent results.

Return ONLY JSON: [{"title","author","body","replies":[{"author","body"}]}] — 2 to 4 threads reacting to the week (a game thread post-mortem, a hot-take thread, a "remember when" thread, a poll-griping thread — pick what fits the week). Titles in authentic board style ("OFFICIAL: ...", "Unpopular opinion:", "Am I crazy or..."). 3-6 replies each. Use only the given usernames as authors.`;

export async function generateBoardWeek(dynastyId: string, seasonId: number): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  const byHandle = ensureBoardAccounts(dynastyId);
  // One board-generation per week: threads carry the week, so bail politely if it's covered.
  const existing = getThreads(dynastyId, seasonId).filter((t) => t.week === ctx.week && t.accountKind !== 'user');
  if (existing.length > 0) {
    return { ok: true, engine: 'offline', message: 'The board already argued about this week.', postsAdded: 0 };
  }

  let threads: ModelThread[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      threads = await generateJson<ModelThread[]>(
        BOARD_WEEK_SYSTEM,
        `USERNAMES:\n${boardCastPrompt()}\n\nTHIS WEEK'S DATA:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}`,
        5000,
      );
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week);
    }
  } else {
    threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week);
  }

  const added = withBatchedPersist(() => {
    let n = 0;
    for (const t of threads) {
      const author = byHandle.get(t.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: author.id, kind: 'thread', title: t.title, body: t.body, week: ctx.week },
      ]);
      const threadId = lastInsertId();
      n += 1;
      if (threadId === 0) continue;
      for (const r of t.replies ?? []) {
        const replier = byHandle.get(r.author);
        if (!replier) continue;
        insertPosts(dynastyId, [
          { seasonId, accountId: replier.id, kind: 'reply', parentId: threadId, body: r.body, week: ctx.week },
        ]);
        n += 1;
      }
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}

function offlineBoardWeek(team: string, record: string, week: number): ModelThread[] {
  return [
    {
      title: `OFFICIAL: Week ${week} post-mortem thread`,
      author: 'OldGold_Stan',
      body: `Long-time readers know I don't overreact to a single week. That said, let us review the tape together, as a community, like we have since the board software still had frames. ${team} sits at ${record}. Discuss respectfully.\n\n— Stan`,
      replies: [
        { author: 'xX_BlitzKing_Xx', body: 'RESPECTFULLY, we are COOKED.' },
        { author: 'StatGuy_Larry', body: `${record}. That's the record. The numbers don't lie. People do.` },
        { author: 'FireEveryone_Frank', body: 'It’s time for a change. I’ve said it before and I’ll say it again.' },
        { author: 'ConcessionsConnie', body: 'The new brisket stand behind section 114 is worth the halftime line. Also our red-zone play calling is too cute by half and everyone knows it.' },
      ],
    },
    {
      title: 'Unpopular opinion: this board overreacts every single week',
      author: 'Lurker_Since_09',
      body: 'That’s it. That’s the post.',
      replies: [
        { author: 'xX_BlitzKing_Xx', body: 'the LURKER is out of their CAVE. must be serious.' },
        { author: 'OldGold_Stan', body: 'A rare appearance, and a correct one. Welcome back, friend.\n\n— Stan' },
      ],
    },
  ];
}

const BOARD_REPLY_SYSTEM = `You write the next replies in a thread on TheSideline.net, an old-school college-football message board in a video-game dynasty universe. The newest post is from {HANDLE} — an ordinary poster (the human player); treat them like any other board member: quote them with >, argue, agree, essay-post, derail slightly. Stay factual to the data. Return ONLY JSON: [{"author","body"}] with 2-4 replies. Use only the given usernames as authors.`;

async function boardReplies(
  dynastyId: string,
  seasonId: number,
  userHandle: string,
  transcript: string,
): Promise<{ replies: { author: string; body: string }[]; engine: 'claude' | 'offline'; message?: string }> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (hasLiveEngine() && ctx) {
    try {
      const replies = await generateJson<{ author: string; body: string }[]>(
        BOARD_REPLY_SYSTEM.replace('{HANDLE}', userHandle),
        `USERNAMES:\n${boardCastPrompt()}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}\n\nTHREAD (oldest first):\n${transcript}`,
        1500,
      );
      return { replies, engine: 'claude' };
    } catch (err) {
      return {
        replies: offlineBoardReplies(),
        engine: 'offline',
        message: err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined,
      };
    }
  }
  return { replies: offlineBoardReplies(), engine: 'offline' };
}

function offlineBoardReplies(): { author: string; body: string }[] {
  return [
    { author: 'OldGold_Stan', body: 'An interesting contribution. I have thoughts, which I will share at length this evening.\n\n— Stan' },
    { author: 'xX_BlitzKing_Xx', body: '>see above post\n\nthis is either genius or the worst thing ever posted here. no in between.' },
  ];
}

export async function createBoardThread(
  dynastyId: string,
  seasonId: number,
  userAccountId: number,
  title: string,
  body: string,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  const week = ctx?.week ?? 0;
  ensureBoardAccounts(dynastyId);
  const threadId = withBatchedPersist(() => {
    insertPosts(dynastyId, [
      { seasonId, accountId: userAccountId, kind: 'thread', title, body, week },
    ]);
    return lastInsertId();
  });
  if (threadId === 0) return { ok: false, engine: 'offline', message: 'Could not create the thread.', postsAdded: 0 };

  const userHandle = getAccounts(dynastyId).find((a) => a.id === userAccountId)?.handle ?? 'you';
  const { replies, engine, message } = await boardReplies(
    dynastyId,
    seasonId,
    userHandle,
    `${userHandle} (OP): ${title}\n${body}`,
  );
  const byHandle = ensureBoardAccounts(dynastyId);
  const added = withBatchedPersist(() => {
    let n = 1;
    for (const r of replies) {
      const author = byHandle.get(r.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: author.id, kind: 'reply', parentId: threadId, body: r.body, week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}

export async function replyToBoardThread(
  dynastyId: string,
  seasonId: number,
  userAccountId: number,
  threadId: number,
  body: string,
): Promise<NetGenerateResult> {
  const thread = getThread(dynastyId, threadId);
  if (!thread) return { ok: false, engine: 'offline', message: 'That thread no longer exists.', postsAdded: 0 };
  const ctx = buildWeekContext(dynastyId, seasonId);
  const week = ctx?.week ?? thread.week;
  const byHandle = ensureBoardAccounts(dynastyId);

  withBatchedPersist(() => {
    insertPosts(dynastyId, [
      { seasonId, accountId: userAccountId, kind: 'reply', parentId: threadId, body, week },
    ]);
  });

  const userHandle = getAccounts(dynastyId).find((a) => a.id === userAccountId)?.handle ?? 'you';
  const transcript = [
    `${thread.handle} (OP): ${thread.title}\n${thread.body}`,
    ...thread.replies.map((r) => `${r.handle}: ${r.body}`),
    `${userHandle}: ${body}`,
  ].join('\n');
  const { replies, engine, message } = await boardReplies(dynastyId, seasonId, userHandle, transcript);

  const added = withBatchedPersist(() => {
    let n = 1;
    for (const r of replies) {
      const author = byHandle.get(r.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: author.id, kind: 'reply', parentId: threadId, body: r.body, week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}
