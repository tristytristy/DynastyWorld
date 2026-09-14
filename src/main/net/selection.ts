import { buildWeekContext } from './context';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import { resolveHandle } from './generate';
import { realHistoryNote } from './canon';
import { FIXED_CAST, fanFor, type CastMember } from './cast';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getSnapshot, getSeasonById } from '../../database/helpers';
import { ensureAccounts, getAccounts, getRecentPosts, insertPosts, lastInsertId } from '../../database/dynastyNet';
import { withBatchedPersist } from '../../database/init';
import { CFP_FIRST_ROUND } from '../../shared/cfpBowls';
import type { NetAccount, NetGenerateResult } from '../../shared/netTypes';

/**
 * The Selection Sunday special (user pick, 2026-09-14): the moment between
 * entering the postseason and the first round kicking off is a real event —
 * the bracket is revealed, the snubs are furious, every fanbase is mapping
 * its path — and without this the Net slept through it (nothing "happened"
 * yet in played-games terms, so the weekly generators had nothing to say).
 *
 * Fires on demand from the Board while the reveal is fresh: CFP first-round
 * games exist in the schedule and none have been played. Content lands on
 * the conference-championship week — Selection Sunday follows championship
 * Saturday — as ADDITIVE posts and threads, so it never collides with the
 * bowl weeks' own game threads later.
 */

const SELECTION_SYSTEM = `You write TheSideline.net and the social feed of a college-football dynasty universe reacting to SELECTION SUNDAY — the playoff bracket was just revealed. Everything factual (seeds, matchups, records, ranks) must come from the data; never invent results — no games have been played yet, so nobody knows outcomes.

Return ONLY JSON: {"posts":[{"handle","body","likes":int,"replies":[{"handle","body","likes":int}]}],"threads":[{"title","author","body","upvotes":int,"replies":[{"author","body","likes":int,"replies":[{"author","body","likes":int}]}]}]}.

- "posts": 6-9 feed posts from the CAST handles — committee outrage, the snub discourse, seeding debates, first-round matchup takes, one fanbase already booking title-game hotels. Short, punchy, real-fan register.
- "threads": 2-3 board threads from POPULATION usernames: one "[Bracket Reveal Thread]" (OP lays out the field, comments argue seeds and snubs), plus a snub rant or an "am I crazy or our path is actually easy" thread. Board comment rules apply: 5-25 words mostly, lowercase fine, quote-riffs with >, one substantive seeding analysis per thread, reddit-shaped likes.
- The biggest snub (the best team OUTSIDE the field) should dominate at least one conversation, and their fans should be inconsolable or litigious.`;

interface ModelReply {
  author?: string;
  handle?: string;
  body: string;
  likes?: number;
  replies?: { author?: string; handle?: string; body: string; likes?: number }[];
}

interface SelectionOut {
  posts?: { handle: string; body: string; likes?: number; replies?: { handle: string; body: string; likes?: number }[] }[];
  threads?: { title: string; author: string; body: string; upvotes?: number; replies?: ModelReply[] }[];
}

export async function generateSelectionReaction(dynastyId: string, seasonId: number): Promise<NetGenerateResult> {
  const ctx = buildWeekContext(dynastyId, seasonId);
  if (!ctx) return { ok: false, engine: 'offline', message: 'No synced data for this season yet.', postsAdded: 0 };
  if (!hasLiveEngine()) {
    return {
      ok: false,
      engine: 'offline',
      message: 'The bracket-reveal special needs the live engine — add your Claude API key on the Feed page.',
      postsAdded: 0,
    };
  }

  const games = getLeagueScores(dynastyId, seasonId)?.games ?? [];
  const firstRound = games.filter((g) => g.bowlName === CFP_FIRST_ROUND);
  if (!firstRound.length) {
    return {
      ok: false,
      engine: 'offline',
      message: 'No playoff bracket in the archive yet — sync after entering the postseason, then fire this.',
      postsAdded: 0,
    };
  }
  if (firstRound.some((g) => g.homeScore !== null)) {
    return {
      ok: false,
      engine: 'offline',
      message: 'The first round has already kicked off — the reveal moment has passed. (The game threads take it from here.)',
      postsAdded: 0,
    };
  }

  // The field, from the CFP poll the bracket is seeded by.
  const season = getSeasonById(seasonId);
  const teams = season
    ? getSnapshot<{ teamIndex: number; displayName: string; cfpRank: number; confWins: number; confLosses: number; nonConfWins: number; nonConfLosses: number; conferenceName?: string }[]>(
        season.id,
        'teams',
      ) ?? []
    : [];
  const ranked = teams
    .filter((t) => t.cfpRank >= 1 && t.cfpRank <= 16)
    .sort((a, b) => a.cfpRank - b.cfpRank)
    .map(
      (t) =>
        `#${t.cfpRank} ${t.displayName} (${t.confWins + t.nonConfWins}-${t.confLosses + t.nonConfLosses}${t.conferenceName ? `, ${t.conferenceName}` : ''})${t.cfpRank <= 4 ? ' — BYE' : t.cfpRank <= 12 ? '' : ' — OUT (bubble)'}`,
    );
  const matchups = firstRound
    .map((g) => `${g.awayRank ? `#${g.awayRank} ` : ''}${g.awayTeamName} at ${g.homeRank ? `#${g.homeRank} ` : ''}${g.homeTeamName}`)
    .join('\n');
  const bowls = games
    .filter((g) => g.homeScore === null && g.bowlName && g.bowlName !== CFP_FIRST_ROUND && (g.homeRank !== null || g.awayRank !== null))
    .slice(0, 8)
    .map((g) => `${g.bowlName}: ${g.awayTeamName} vs ${g.homeTeamName}`)
    .join('\n');

  // Feed cast + the whole board population write this together.
  const castWanted: CastMember[] = [...FIXED_CAST, ...ctx.teamsInTheNews.map((t) => fanFor(t))];
  ensureAccounts(dynastyId, castWanted);
  const population = getAccounts(dynastyId).filter((a) => a.kind === 'board');
  const memory = getRecentPosts(dynastyId, 25)
    .map((r) => `${r.handle}${r.isUser ? ' [the human fan]' : ''}: ${r.body}`)
    .join('\n');

  let out: SelectionOut;
  try {
    out = await generateJson<SelectionOut>(
      SELECTION_SYSTEM,
      `CAST (feed voices):\n${castWanted.map((c) => `${c.handle}: ${c.persona}`).join('\n')}\n\nPOPULATION (board usernames):\n${population.map((a) => `${a.handle} (${a.displayName}): ${a.persona}`).join('\n')}\n\nTHE FIELD (CFP poll = the seeding):\n${ranked.join('\n')}\n\nFIRST-ROUND MATCHUPS (higher seed hosts):\n${matchups}${bowls ? `\n\nNOTABLE BOWL PAIRINGS:\n${bowls}` : ''}\n\nSEASON CONTEXT:\n${JSON.stringify(ctx, null, 1)}${memory ? `\n\nRECENT NET HISTORY:\n${memory}` : ''}${realHistoryNote(ctx.firstSeasonYear)}`,
      9000,
    );
  } catch (err) {
    const message = err instanceof NetClaudeError ? err.message : err instanceof Error ? err.message : String(err);
    return { ok: false, engine: 'offline', message: `The reveal special failed: ${message}`, postsAdded: 0 };
  }

  const byHandle = new Map(getAccounts(dynastyId).map((a) => [a.handle, a] as [string, NetAccount]));
  const added = withBatchedPersist(() => {
    let n = 0;
    for (const p of out.posts ?? []) {
      const account = resolveHandle(byHandle, p.handle);
      if (!account) continue;
      insertPosts(dynastyId, [{ seasonId, accountId: account.id, kind: 'post', body: p.body, likes: p.likes ?? 0, week: ctx.week }]);
      const parentId = lastInsertId();
      n += 1;
      if (parentId === 0) continue;
      for (const r of p.replies ?? []) {
        const replier = resolveHandle(byHandle, r.handle);
        if (!replier) continue;
        insertPosts(dynastyId, [
          { seasonId, accountId: replier.id, kind: 'reply', parentId, body: r.body, likes: r.likes ?? 0, week: ctx.week },
        ]);
        n += 1;
      }
    }
    for (const t of out.threads ?? []) {
      const author = resolveHandle(byHandle, t.author);
      if (!author) continue;
      insertPosts(dynastyId, [
        { seasonId, accountId: author.id, kind: 'thread', title: t.title, body: t.body, likes: t.upvotes ?? 400, week: ctx.week },
      ]);
      const threadId = lastInsertId();
      n += 1;
      if (threadId === 0) continue;
      for (const r of t.replies ?? []) {
        const replier = resolveHandle(byHandle, r.author ?? r.handle ?? '');
        if (!replier) continue;
        insertPosts(dynastyId, [
          { seasonId, accountId: replier.id, kind: 'reply', parentId: threadId, body: r.body, likes: r.likes ?? 0, week: ctx.week },
        ]);
        const replyId = lastInsertId();
        n += 1;
        if (replyId === 0) continue;
        for (const rr of r.replies ?? []) {
          const child = resolveHandle(byHandle, rr.author ?? rr.handle ?? '');
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

  return {
    ok: true,
    engine: 'claude',
    message: `Selection Sunday hit the Net — ${added} posts and thread comments across the Feed and the Board.`,
    postsAdded: added,
  };
}
