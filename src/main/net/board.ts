import { buildWeekContext } from './context';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import { resolveHandle } from './generate';
import { getLeagueScores } from '../../database/getLeagueScores';
import {
  clearWeekThreads,
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

/** The living, Claude-invented board population (kind 'board'). Grows over time. */
function boardPopulation(dynastyId: string): NetAccount[] {
  return getAccounts(dynastyId).filter((a) => a.kind === 'board');
}

function sanitizeBoardHandle(raw: string): string {
  return raw.replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 28);
}

interface ModelUser {
  handle: string;
  displayName: string;
  persona: string;
}

const POPULATION_SYSTEM = `You invent the user base of TheSideline.net — the national college-football message board of a video-game dynasty universe, in the culture of the big CFB subreddit. Create 14 distinct posters: reddit-style usernames (mixed styles — years, puns, references, underscores; no two alike), most carrying a team flair in the display name like "corn_husked_2011 [Nebraska]", spread across conferences and including the listed must-cover teams; 3-4 flairless veterans with no allegiance. Each gets a one-line persona with a specific quirk or running bit (posting habits, obsessions, catchphrases, rivalries). No real-world people. Return ONLY JSON: [{"handle","displayName","persona"}] — handle is letters/digits/underscores only.`;

/**
 * Populate (or grow) the board with Claude-invented posters. Called on the
 * live path only; inventing nobody is fine — the board just posts with who
 * it has.
 */
async function ensurePopulation(dynastyId: string, mustCoverTeams: string[]): Promise<void> {
  if (boardPopulation(dynastyId).length >= 8) return;
  const users = await generateJson<ModelUser[]>(
    POPULATION_SYSTEM,
    `MUST-COVER TEAMS (at least one flaired poster each):\n${mustCoverTeams.join(', ')}`,
    2500,
  );
  installBoardUsers(dynastyId, users);
}

function installBoardUsers(dynastyId: string, users: ModelUser[]): void {
  const taken = new Set(getAccounts(dynastyId).map((a) => a.handle.toLowerCase()));
  const wanted: CastMember[] = [];
  for (const u of users ?? []) {
    const handle = sanitizeBoardHandle(u.handle ?? '');
    if (handle.length < 3 || taken.has(handle.toLowerCase())) continue;
    taken.add(handle.toLowerCase());
    wanted.push({
      handle,
      displayName: (u.displayName ?? handle).slice(0, 60),
      kind: 'board',
      persona: (u.persona ?? '').slice(0, 300),
    });
  }
  if (wanted.length) ensureAccounts(dynastyId, wanted);
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

const BOARD_WEEK_SYSTEM = `You write TheSideline.net — the NATIONAL college-football message board of a video-game dynasty universe, in the culture of the big CFB subreddit: game threads for every big game anywhere in the country, team flairs in display names, rival fanbases brigading each other's threads, flairless veterans keeping order. People quote with >, essays land at 1am, everyone has a conspiracy about the committee. Everything factual must come from the data — never invent results.

Return ONLY JSON: {"newUsers":[{"handle","displayName","persona"}],"threads":[{"title","author","body","replies":[{"author","body"}]}]}.
- "newUsers": if a featured fanbase has no flaired poster in the population (or the moment calls for a fresh voice), invent up to 4 new posters — reddit-style usernames, flair in displayName like "corn_husked_2011 [Nebraska]", one-line persona. They may then author posts. Empty array if nobody new is needed.
- "threads": one [Post Game Thread] for EACH featured game, using EXACTLY the provided title. OP is a fan of the winning team or a veteran; body is a quick emotional or wry summary. 4-7 replies each: BOTH fanbases, plus neutrals wandering in. Winners gloat, losers spiral, popcorn is eaten. Then 1-2 national talk threads (poll reactions, upset meltdown, "Am I crazy or...").
Authors must be existing population usernames or your newUsers.`;

export async function generateBoardWeek(
  dynastyId: string,
  seasonId: number,
  regenerate = false,
): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (regenerate) clearWeekThreads(dynastyId, seasonId, ctx.week);
  // One board-generation per week: threads carry the week, so bail politely if it's covered.
  const existing = getThreads(dynastyId, seasonId).filter((t) => t.week === ctx.week && t.accountKind !== 'user');
  if (existing.length > 0) {
    return {
      ok: true,
      engine: 'offline',
      message: `The board already argued about Week ${ctx.week} — Regenerate redoes it; fresh threads arrive once more games are in the books (play or advance, then sync).`,
      postsAdded: 0,
    };
  }

  const featured = featuredGames(dynastyId, seasonId, ctx.week, ctx.userTeam);
  const featuredTeams = [...new Set(featured.flatMap((g) => [g.home, g.away]))];

  const gameList = featured
    .map(
      (g, i) =>
        `${i + 1}. TITLE: ${gameThreadTitle(g)}\n   final: ${g.away}${g.awayRank ? ` (#${g.awayRank})` : ''} ${g.awayScore} @ ${g.home}${g.homeRank ? ` (#${g.homeRank})` : ''} ${g.homeScore}${g.isNationalChampionship ? ' — NATIONAL CHAMPIONSHIP' : ''}`,
    )
    .join('\n');

  let threads: ModelThread[];
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  let byHandle: Map<string, NetAccount>;
  if (hasLiveEngine()) {
    try {
      // The population is Claude-invented too: seeded on first live run,
      // grown by the weekly call's newUsers as fresh fanbases get featured.
      await ensurePopulation(dynastyId, [ctx.userTeam, ...featuredTeams].filter(Boolean));
      const population = boardPopulation(dynastyId);
      const out = await generateJson<{ newUsers?: ModelUser[]; threads: ModelThread[] }>(
        BOARD_WEEK_SYSTEM,
        `POPULATION (existing posters):\n${population.map((a) => `${a.handle} (${a.displayName}): ${a.persona}`).join('\n')}\n\nFEATURED GAMES (one [Post Game Thread] each, exact titles):\n${gameList}\n\nWEEK CONTEXT:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}${ctx.neutral ? '\n\nNOTE: This dynasty is run by a NEUTRAL COMMISSIONER \u2014 no team is "the user\'s team". The board covers the nation; do not treat any fanbase as the home crowd.' : ''}`,
        9000,
      );
      installBoardUsers(dynastyId, out.newUsers ?? []);
      threads = out.threads ?? [];
      engine = 'claude';
      byHandle = new Map(getAccounts(dynastyId).map((a) => [a.handle, a]));
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week, featured);
      byHandle = ensureBoardAccounts(dynastyId, featuredTeams.map(flairPoster));
    }
  } else {
    threads = offlineBoardWeek(ctx.userTeam, ctx.userRecord, ctx.week, featured);
    byHandle = ensureBoardAccounts(dynastyId, featuredTeams.map(flairPoster));
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
      const population = boardPopulation(dynastyId);
      const roster = population.length
        ? population.map((a) => `${a.handle} (${a.displayName}): ${a.persona}`).join('\n')
        : boardCastPrompt();
      const replies = await generateJson<{ author: string; body: string }[]>(
        BOARD_REPLY_SYSTEM.replace('{HANDLE}', userHandle),
        `USERNAMES:\n${roster}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}\n\nTHREAD (oldest first):\n${transcript}`,
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
  const byHandle = new Map(getAccounts(dynastyId).map((a) => [a.handle, a]));
  const added = withBatchedPersist(() => {
    let n = 1;
    for (const r of replies) {
      const author = resolveHandle(byHandle, r.author);
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
  const byHandle = new Map(getAccounts(dynastyId).map((a) => [a.handle, a]));

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
      const author = resolveHandle(byHandle, r.author);
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
