import { buildWeekContext } from './context';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import { resolveHandle } from './generate';
import { getLeagueScores } from '../../database/getLeagueScores';
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
 * TheSideline.net — the Net's message board, run like the national CFB
 * board: game threads for the week's biggest games ANYWHERE in the country,
 * rival fanbases with team flairs piling in, and a core of flairless
 * regulars who've been posting since dial-up. The user posts like any other
 * member.
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

/** A team's resident board poster — the flair in the display name is the whole identity, r/CFB style. */
function flairPoster(teamName: string): CastMember {
  const compact = teamName.replace(/[^A-Za-z0-9]/g, '');
  return {
    handle: `${compact}_faithful`,
    displayName: `${compact}_faithful [${teamName}]`,
    kind: 'bot',
    persona: `${teamName} flair. Lives in that team's game threads: euphoric in wins, inconsolable in losses, always convinced the refs were against them. Feuds with rival flairs.`,
  };
}

interface FeaturedGame {
  away: string;
  home: string;
  awayRank: number | null;
  homeRank: number | null;
  awayScore: number;
  homeScore: number;
  winner: string;
  loser: string;
  bowlName: string | null;
  isNationalChampionship: boolean;
  weight: number;
}

/** The week's slate, ranked by how loudly the national board would care. */
function featuredGames(dynastyId: string, seasonId: number, week: number, userTeam: string): FeaturedGame[] {
  const games = getLeagueScores(dynastyId, seasonId)?.games ?? [];
  const out: FeaturedGame[] = [];
  for (const g of games) {
    if (g.week !== week || g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;
    const winnerRank = homeWon ? g.homeRank : g.awayRank;
    const loserRank = homeWon ? g.awayRank : g.homeRank;
    let weight = 0;
    if (g.isNationalChampionship) weight += 100;
    else if (g.weekType === 'ConferenceChampionship') weight += 60;
    else if (g.bowlName) weight += 35;
    if (winnerRank !== null && loserRank !== null) weight += 30;
    else if (winnerRank !== null || loserRank !== null) weight += 12;
    if (loserRank !== null && winnerRank === null) weight += 30; // upset
    const margin = Math.abs(g.homeScore - g.awayScore);
    if (margin <= 3) weight += 12;
    if (g.homeScore + g.awayScore >= 80) weight += 8;
    if (g.homeTeamName === userTeam || g.awayTeamName === userTeam) weight += 20;
    if (weight === 0) continue;
    out.push({
      away: g.awayTeamName,
      home: g.homeTeamName,
      awayRank: g.awayRank,
      homeRank: g.homeRank,
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      winner: homeWon ? g.homeTeamName : g.awayTeamName,
      loser: homeWon ? g.awayTeamName : g.homeTeamName,
      bowlName: g.bowlName,
      isNationalChampionship: g.isNationalChampionship,
      weight,
    });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

function gameThreadTitle(g: FeaturedGame): string {
  const r = (rank: number | null) => (rank ? `#${rank} ` : '');
  return `[Post Game Thread] ${r(g.winner === g.home ? g.homeRank : g.awayRank)}${g.winner} defeats ${r(g.winner === g.home ? g.awayRank : g.homeRank)}${g.loser} ${Math.max(g.homeScore, g.awayScore)}-${Math.min(g.homeScore, g.awayScore)}${g.bowlName ? ` (${g.bowlName})` : ''}`;
}

function castPromptOf(cast: CastMember[]): string {
  return cast.map((c) => `${c.handle}${c.displayName !== c.handle ? ` (${c.displayName})` : ''}: ${c.persona}`).join('\n');
}

function boardCastPrompt(): string {
  return castPromptOf(BOARD_CAST);
}

function ensureBoardAccounts(dynastyId: string, extra: CastMember[] = []): Map<string, NetAccount> {
  const accounts = ensureAccounts(dynastyId, [...BOARD_CAST, ...extra]);
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

const BOARD_WEEK_SYSTEM = `You write TheSideline.net — the NATIONAL college-football message board of a video-game dynasty universe, in the culture of the big CFB subreddit: game threads for every big game anywhere in the country, team flairs in display names, rival fanbases brigading each other's threads, flairless old-guard regulars keeping order. People quote with >, essays land at 1am, everyone has a conspiracy about the committee. Everything factual must come from the data — never invent results.

Return ONLY JSON: [{"title","author","body","replies":[{"author","body"}]}].
- One [Post Game Thread] for EACH featured game, using EXACTLY the provided title. OP is a fan of the winning team or a regular; body is a quick emotional or wry summary. 4-7 replies each: BOTH fanbases (their flair accounts are in the cast), plus regulars wandering in. Winners gloat, losers spiral, neutrals eat popcorn.
- Then 1-2 national talk threads (poll reactions, upset meltdown, "Am I crazy or...", weekly overreactions).
Use only the given usernames as authors.`;

export async function generateBoardWeek(dynastyId: string, seasonId: number): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  // One board-generation per week: threads carry the week, so bail politely if it's covered.
  const existing = getThreads(dynastyId, seasonId).filter((t) => t.week === ctx.week && t.accountKind !== 'user');
  if (existing.length > 0) {
    return { ok: true, engine: 'offline', message: 'The board already argued about this week.', postsAdded: 0 };
  }

  // The week's slate from anywhere in the nation, plus a resident flair
  // poster for every fanbase involved — accounts persist, so a team's
  // poster is the same account next time they're featured.
  const featured = featuredGames(dynastyId, seasonId, ctx.week, ctx.userTeam);
  const flairTeams = [...new Set(featured.flatMap((g) => [g.home, g.away]))];
  const flairs = flairTeams.map(flairPoster);
  const byHandle = ensureBoardAccounts(dynastyId, flairs);

  const gameList = featured
    .map(
      (g, i) =>
        `${i + 1}. TITLE: ${gameThreadTitle(g)}\n   final: ${g.away}${g.awayRank ? ` (#${g.awayRank})` : ''} ${g.awayScore} @ ${g.home}${g.homeRank ? ` (#${g.homeRank})` : ''} ${g.homeScore}${g.isNationalChampionship ? ' — NATIONAL CHAMPIONSHIP' : ''}\n   fan accounts: ${flairPoster(g.winner).handle} (winner), ${flairPoster(g.loser).handle} (loser)`,
    )
    .join('\n');

  let threads: ModelThread[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      threads = await generateJson<ModelThread[]>(
        BOARD_WEEK_SYSTEM,
        `USERNAMES (regulars):\n${boardCastPrompt()}\n\nUSERNAMES (team flairs this week):\n${castPromptOf(flairs)}\n\nFEATURED GAMES (one [Post Game Thread] each, exact titles):\n${gameList}\n\nWEEK CONTEXT:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}`,
        9000,
      );
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week, featured);
    }
  } else {
    threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week, featured);
  }

  const added = withBatchedPersist(() => {
    let n = 0;
    for (const t of threads) {
      const author = resolveHandle(byHandle, t.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: author.id, kind: 'thread', title: t.title, body: t.body, week: ctx.week },
      ]);
      const threadId = lastInsertId();
      n += 1;
      if (threadId === 0) continue;
      for (const r of t.replies ?? []) {
        const replier = resolveHandle(byHandle, r.author);
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

function offlineBoardWeek(team: string, record: string, week: number, featured: FeaturedGame[] = []): ModelThread[] {
  const gameThreads: ModelThread[] = featured.map((g) => ({
    title: gameThreadTitle(g),
    author: flairPoster(g.winner).handle,
    body: g.isNationalChampionship
      ? 'NATIONAL CHAMPIONS. I have nothing coherent to add. See everyone at the parade.'
      : `Ball game. ${g.winner} ${Math.max(g.homeScore, g.awayScore)}, ${g.loser} ${Math.min(g.homeScore, g.awayScore)}. Good game thread everyone.`,
    replies: [
      { author: flairPoster(g.loser).handle, body: 'I am never watching this sport again. See everyone next Saturday.' },
      { author: 'xX_BlitzKing_Xx', body: 'both of these fanbases are insufferable and I read every post. carry on.' },
      { author: 'StatGuy_Larry', body: `Final margin: ${Math.abs(g.homeScore - g.awayScore)}. The numbers don't lie. People do.` },
    ],
  }));
  return [
    ...gameThreads,
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
