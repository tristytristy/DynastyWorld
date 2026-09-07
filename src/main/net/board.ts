import { buildWeekContext } from './context';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import { resolveHandle } from './generate';
import { getLeagueScores } from '../../database/getLeagueScores';
import { listMediaForGame } from '../../database/media';
import { CFP_ROUND_NAMES } from '../../shared/cfpBowls';
import { realHistoryNote } from './canon';
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
  gameId: number;
  /** A CFP game of any round — always featured, never crowded out by bowls. */
  isPlayoff: boolean;
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
    const isPlayoff = g.isNationalChampionship || CFP_ROUND_NAMES.has(g.bowlName ?? '');
    let weight = 0;
    if (g.isNationalChampionship) weight += 100;
    // Every playoff game outranks any regular bowl: a chaotic Potato Bowl can
    // join the slate, but never displace a CFP game from it (user report,
    // 2026-09-03 — first-round week showed 2 of 4 CFP games).
    else if (isPlayoff) weight += 90;
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
      gameId: g.gameId,
      isPlayoff,
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
  /*
    EVERY playoff game gets a thread — the cap only limits the undercard. A
    CFP first-round week reads as 4 playoff threads plus the 3 loudest bowls;
    a normal week stays at the top 5.
  */
  const sorted = out.sort((a, b) => b.weight - a.weight);
  const playoff = sorted.filter((g) => g.isPlayoff);
  const rest = sorted.filter((g) => !g.isPlayoff);
  return [...playoff, ...rest.slice(0, Math.max(5 - playoff.length, 3))];
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
  const accounts = ensureAccounts(dynastyId, [SIDELINE_BOT, ...BOARD_CAST, ...extra]);
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

interface ModelReply {
  author: string;
  body: string;
  likes?: number;
  /** One level of nesting only — a direct response to the parent comment. */
  replies?: { author: string; body: string; likes?: number }[];
}

interface ModelThread {
  title: string;
  author: string;
  body: string;
  upvotes?: number;
  replies?: ModelReply[];
}

/**
 * The board's scorekeeping bot — every [Post Game Thread] is OP'd by it with a
 * plain box-score body, the way the real CFB subreddit's referee bot posts
 * game threads. Mechanical on purpose: the OP is data, the comments are life.
 */
const SIDELINE_BOT: CastMember = {
  handle: 'SidelineBot',
  displayName: 'SidelineBot [Bot]',
  kind: 'bot',
  persona: 'Automated game-thread poster. Posts the final score and says nothing else, ever.',
};

function pgtBody(g: FeaturedGame): string {
  const r = (rank: number | null) => (rank ? `#${rank} ` : '');
  const lines = [
    `Final: ${r(g.awayRank)}${g.away} ${g.awayScore} — ${r(g.homeRank)}${g.home} ${g.homeScore}`,
  ];
  if (g.isNationalChampionship) lines.push('National Championship');
  else if (g.bowlName) lines.push(g.bowlName);
  lines.push('', 'Box score provided by The Sideline Wire');
  return lines.join('\n');
}

const BOARD_WEEK_SYSTEM = `You write the comments of TheSideline.net — the national college-football board of a video-game dynasty universe, with the exact culture of the big CFB subreddit's game threads. Everything factual (scores, records, ranks, streaks) must come from the provided data — never invent results.

Return ONLY JSON: {"newUsers":[{"handle","displayName","persona"}],"threads":[{"title","author","body","upvotes":int,"replies":[{"author","body","likes":int,"replies":[{"author","body","likes":int}]}]}]}.

STRUCTURE:
- One thread for EACH featured game, title EXACTLY as provided. For these game threads the OP is already posted by a score bot — set "author" to "SidelineBot" and "body" to "" and write ONLY the replies (6-10 for the biggest game, 4-7 for the rest).
- Then 1-2 national talk threads (poll gripes, "so the top four are...", coach hot seat, am-I-crazy posts) — these you author fully: a real poster as OP, short body, 3-6 replies.
- "newUsers": up to 4 new posters if a featured fanbase has nobody (reddit-style usernames, flair in displayName like "corn_husked_2011 [Nebraska]"). Empty array if not needed.
- Authors must be existing population usernames, your newUsers, or "SidelineBot" (OP only).

HOW REAL GAME-THREAD COMMENTS SOUND — follow this closely:
- SHORT. Most comments are 5-25 words. Several under 10. lowercase is common, so are "lol", "lmao", "bro", "man". Fragments are fine.
- NOT EVERYONE IS CLEVER. Most comments are plain gut reactions: "WE ARE SO BACK", "i hate this sport", "fire him. i mean it this time", "nobody can tell him anything right now lol", "that man is playing a different sport". At most ONE longer, effortful comment per thread — never polished stand-up bits with twist endings on ordinary comments.
- ONE stats-dump comment in the BIGGEST game's thread only: a bullet list (use "- " lines) of 4-7 dry factual nuggets pulled strictly from the data (records, ranks, margins, season points). It gets huge likes. Its author is a numbers-account type.
- Quote-riffs: a reply quoting a fragment of the parent with "&gt;" on its own line, then one short line back.
- Nested replies (the inner "replies" array) are direct responses — pile-ons, corrections, one-word agreements.
- Fanbase truth: losers doom-spiral or go silent-then-one-liner, winners are euphoric and briefly insufferable, neutrals drive by with jokes. Flairless veterans post perspective.
- LIKES: reddit-shaped. Top comment in a big thread 800-6000, mid comments 40-900, late/niche 3-60, and one mildly downvoted take (-5 to -25) somewhere per week. Thread "upvotes" 200-8000 by game size.
- Continuity: keep grudges and running bits from the board history going; call back to old takes.`;

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

  /*
    THE FILM ROOM (user idea, 2026-08-22): DynastyTube uploads tagged to a
    featured game are eyewitness material — the description, tagged players,
    and tagged scoring plays carry details the box score doesn't ("Indiana
    fumbled with :25 left"). Fed into the prompt per game so a few commenters
    in that game's thread talk like people who actually watched.
  */
  const filmRoom = featured
    .map((g) => {
      const clips = listMediaForGame(dynastyId, seasonId, g.gameId);
      if (!clips.length) return null;
      const lines = clips.slice(0, 4).map((m) => {
        const players = m.taggedPlayers.map((tp) => `${tp.firstName} ${tp.lastName}`).join(', ');
        const plays = (m.plays ?? [])
          .slice(0, 6)
          .map((pl) => `${pl.teamName ?? ''} ${pl.playType}${pl.scorerNames?.length ? ` by ${pl.scorerNames.join(' to ')}` : pl.playType === 'touchdown' ? ' (unlisted scorer — possibly defense/special teams)' : ''} Q${pl.quarter} (${pl.awayScore}-${pl.homeScore} after)`.trim())
          .join('; ');
        return `  - "${m.tubeTitle || m.description || m.fileName}"${m.tubeTitle && m.description ? ` (${m.description})` : ''}${players ? ` — players: ${players}` : ''}${plays ? ` — plays shown: ${plays}` : ''}`;
      });
      return `${gameThreadTitle(g)}:\n${lines.join('\n')}`;
    })
    .filter((entry): entry is string => entry !== null);
  const filmRoomSection = filmRoom.length
    ? `\n\nTHE FILM ROOM (fan-uploaded highlights for these games — commenters have watched them; in those threads let 1-3 comments reference these specific details naturally, like people who saw the broadcast; never contradict them):\n${filmRoom.join('\n')}`
    : '';

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
        `POPULATION (existing posters):\n${population.map((a) => `${a.handle} (${a.displayName}): ${a.persona}`).join('\n')}\n\nFEATURED GAMES (one [Post Game Thread] each, exact titles):\n${gameList}${filmRoomSection}\n\nWEEK CONTEXT:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}${ctx.neutral ? '\n\nNOTE: This dynasty is run by a NEUTRAL COMMISSIONER \u2014 no team is "the user\'s team". The board covers the nation; do not treat any fanbase as the home crowd.' : ''}${realHistoryNote(ctx.firstSeasonYear)}`,
        12000, // a playoff week carries up to 7 threads' worth of comments
      );
      installBoardUsers(dynastyId, out.newUsers ?? []);
      threads = out.threads ?? [];
      engine = 'claude';
      ensureBoardAccounts(dynastyId); // the score bot must exist before PGT OPs insert
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

  // Game threads are OP'd by the score bot with a mechanical box-score body,
  // whatever the model set — exact titles are the join key back to the game.
  const pgtByTitle = new Map(featured.map((g) => [gameThreadTitle(g), g]));

  const added = withBatchedPersist(() => {
    let n = 0;
    for (const t of threads) {
      const game = pgtByTitle.get(t.title);
      const author = game ? resolveHandle(byHandle, SIDELINE_BOT.handle) : resolveHandle(byHandle, t.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        {
          seasonId,
          accountId: author.id,
          kind: 'thread',
          title: t.title,
          body: game ? pgtBody(game) : t.body,
          likes: t.upvotes ?? Math.max(150, (game?.weight ?? 4) * 60),
          week: ctx.week,
        },
      ]);
      const threadId = lastInsertId();
      n += 1;
      if (threadId === 0) continue;
      for (const r of t.replies ?? []) {
        const replier = resolveHandle(byHandle, r.author);
        if (!replier) continue;
        insertPosts(dynastyId, [
          { seasonId, accountId: replier.id, kind: 'reply', parentId: threadId, body: r.body, likes: r.likes ?? 0, week: ctx.week },
        ]);
        const replyId = lastInsertId();
        n += 1;
        if (replyId === 0) continue;
        for (const rr of r.replies ?? []) {
          const child = resolveHandle(byHandle, rr.author);
          if (!child) continue;
          insertPosts(dynastyId, [
            { seasonId, accountId: child.id, kind: 'reply', parentId: replyId, body: rr.body, likes: rr.likes ?? 0, week: ctx.week },
          ]);
          n += 1;
        }
      }
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}

function offlineBoardWeek(team: string, record: string, week: number, featured: FeaturedGame[] = []): ModelThread[] {
  // PGT bodies are overridden with the score-bot box score at insert time
  // (see pgtByTitle) — offline only supplies the comment section.
  const gameThreads: ModelThread[] = featured.map((g, i) => ({
    title: gameThreadTitle(g),
    author: SIDELINE_BOT.handle,
    body: '',
    upvotes: 400 + g.weight * 40,
    replies: [
      { author: flairPoster(g.winner).handle, body: g.isNationalChampionship ? 'NATIONAL CHAMPS. im not okay lol' : 'never a doubt. ok several doubts', likes: 900 - i * 120 },
      {
        author: flairPoster(g.loser).handle,
        body: 'i am never watching this sport again. see everyone next saturday',
        likes: 640 - i * 90,
        replies: [{ author: 'xX_BlitzKing_Xx', body: 'welcome to how i feel EVERY week', likes: 88 }],
      },
      { author: 'StatGuy_Larry', body: `- Final margin: ${Math.abs(g.homeScore - g.awayScore)}\n- Combined points: ${g.homeScore + g.awayScore}\n\nThe numbers don't lie. People do.`, likes: 1200 - i * 150 },
      { author: 'Lurker_Since_09', body: 'good game', likes: 45 },
    ],
  }));
  return [
    ...gameThreads,
    {
      title: `week ${week} was a psyop and i can prove it`,
      author: 'xX_BlitzKing_Xx',
      body: 'i watched every one of these games. none of them were real.' + (team ? ` also ${team} is ${record} and nobody wants to talk about it` : ''),
      upvotes: 310,
      replies: [
        { author: 'OldGold_Stan', body: 'They were real. I attended one.\n\n\u2014 Stan', likes: 240 },
        { author: 'FireEveryone_Frank', body: 'fire everyone involved. the refs too', likes: 96 },
        { author: 'ConcessionsConnie', body: 'the brisket stand behind 114 was real. best thing i saw all day', likes: 71 },
      ],
    },
  ];
}

const BOARD_REPLY_SYSTEM = `You write the next replies in a thread on TheSideline.net, the national college-football board of a video-game dynasty universe (CFB-subreddit culture). The newest post is from {HANDLE} — an ordinary poster (the human player); treat them like any other member: quote a fragment with > and respond, agree, pile on, drive by. KEEP IT SHORT — most replies 5-25 words, lowercase fine, "lol" fine, not everyone is clever; no polished bits. Stay factual to the data. Return ONLY JSON: [{"author","body","likes":int}] with 2-4 replies (reddit-shaped likes, 3-400). Use only the given usernames as authors.`;

async function boardReplies(
  dynastyId: string,
  seasonId: number,
  userHandle: string,
  transcript: string,
): Promise<{ replies: { author: string; body: string; likes?: number }[]; engine: 'claude' | 'offline'; message?: string }> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (hasLiveEngine() && ctx) {
    try {
      const population = boardPopulation(dynastyId);
      const roster = population.length
        ? population.map((a) => `${a.handle} (${a.displayName}): ${a.persona}`).join('\n')
        : boardCastPrompt();
      const replies = await generateJson<{ author: string; body: string; likes?: number }[]>(
        BOARD_REPLY_SYSTEM.replace('{HANDLE}', userHandle),
        `USERNAMES:\n${roster}\n\nWEEK DATA:\n${JSON.stringify(ctx, null, 1)}${boardMemory(dynastyId)}${realHistoryNote(ctx.firstSeasonYear)}\n\nTHREAD (oldest first):\n${transcript}`,
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

function offlineBoardReplies(): { author: string; body: string; likes?: number }[] {
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
        { seasonId, accountId: author.id, kind: 'reply', parentId: threadId, body: r.body, likes: r.likes ?? 0, week },
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
        { seasonId, accountId: author.id, kind: 'reply', parentId: threadId, body: r.body, likes: r.likes ?? 0, week },
      ]);
      n += 1;
    }
    return n;
  });
  return { ok: true, engine, message, postsAdded: added };
}
