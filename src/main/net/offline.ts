import type { NetWeekContext } from './context';
import { fanFor } from './cast';

/**
 * The offline engine — deterministic template posts straight from the week's
 * data. Guarantees the Net is never empty: no API key, no network, no
 * problem. A given (season, week) always renders the same feed.
 */

export interface DraftPost {
  handle: string;
  body: string;
  likes: number;
  replies: { handle: string; body: string; likes: number }[];
}

export interface DraftEditionSet {
  posts: DraftPost[];
  article: { headline: string; body: string } | null;
  podcast: { title: string; body: string } | null;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function offlineWeek(ctx: NetWeekContext): DraftEditionSet {
  const rand = mulberry32(ctx.seasonYear * 100 + ctx.week);
  const likes = () => Math.floor(rand() * rand() * 4000) + 3;
  const posts: DraftPost[] = [];
  const post = (handle: string, body: string, reply?: { handle: string; body: string }) =>
    posts.push({ handle, body, likes: likes(), replies: reply ? [{ ...reply, likes: likes() }] : [] });

  for (const u of ctx.upsets.slice(0, 3)) {
    post(
      '@UpsetAlertSzn',
      `🚨 UPSET 🚨 ${u.winner} takes down #${u.loserRank} ${u.loser} ${u.score}${u.bowlName ? ` in the ${u.bowlName}` : ''}. Nobody is safe.`,
      { handle: '@TheGoalLineShow', body: `I SAID ALL YEAR ${u.loser.toUpperCase()} WAS A PAPER TIGER. Receipts. 🧾` },
    );
  }
  for (const g of ctx.championships.slice(0, 2)) {
    post(
      '@PollCentral',
      `${g.winner} ${g.score} over ${g.loser}${g.isChampionship ? ' — national champions. Etch it.' : ' — conference title secured.'}`,
      { handle: fanFor(g.winner).handle, body: 'Never a doubt. NEVER a doubt.' },
    );
  }
  for (const g of ctx.rankedWins.slice(0, 2)) {
    post('@PollCentral', `#${g.winnerRank} ${g.winner} handles #${g.loserRank} ${g.loser}, ${g.score}. That echoes in the next poll.`);
  }
  for (const g of ctx.userGames.slice(0, 2)) {
    const won = g.winner === ctx.userTeam;
    post(
      fanFor(ctx.userTeam).handle,
      won
        ? `${ctx.userTeam} ${g.score} over ${g.loser}. ${ctx.userRecord} and the haters are QUIET.`
        : `${g.winner} ${g.score}. I don't want to talk about it. Season's over. (See everyone next Saturday.)`,
      won ? undefined : { handle: '@Client97', body: 'hearing some phones are getting warm in that building. just saying.' },
    );
  }
  const number1 = ctx.top10[0];
  if (number1) {
    post('@PollCentral', `Poll check: 1. ${number1.team} (${number1.record}).${ctx.top10[1] ? ` Chasing: ${ctx.top10.slice(1, 4).map((t) => `#${t.rank} ${t.team}`).join(', ')}.` : ''}`, {
      handle: fanFor(number1.team).handle,
      body: '#1 and somehow STILL disrespected.',
    });
  }
  const qb = ctx.statLeaders.passing[0];
  if (qb) {
    post('@StatsNerdCFB', `${qb.player} (${qb.team}) is at ${qb.line}. The tape agrees with the spreadsheet for once.`, {
      handle: '@gridironGrandpa',
      body: 'In my day we ran the wishbone and LIKED it. All this throwing is a cry for help.',
    });
  }
  if (posts.length === 0) {
    post('@gridironGrandpa', 'Quiet week in college football. Too quiet. Somebody check on the transfer portal.');
  }

  const big = ctx.championships[0] ?? ctx.upsets[0] ?? ctx.rankedWins[0] ?? ctx.userGames[0];
  const article = big
    ? {
        headline: big.isChampionship
          ? `${big.winner.toUpperCase()} RULES THE NATION`
          : `${big.winner} ${big.score}: the week's defining result`,
        body:
          `${big.winner} beat ${big.loser} ${big.score}` +
          `${big.bowlName ? ` in the ${big.bowlName}` : ''}${big.loserRank ? `, toppling the #${big.loserRank} team in the country` : ''}. ` +
          `${number1 ? `At the top of the sport, ${number1.team} (${number1.record}) holds the No. 1 line. ` : ''}` +
          `${qb ? `Around the nation, ${qb.player} of ${qb.team} continues to set the offensive pace (${qb.line}).` : ''}`,
      }
    : null;

  const riser = ctx.top10.find((t) => t.rank <= 5);
  const podcast = big
    ? {
        title: `Week ${ctx.week}: ${big.winner} changed the picture`,
        body:
          `The hosts open on ${big.winner}'s ${big.score} result over ${big.loser} — one calls it a program-defining win, the other isn't buying it. ` +
          `${riser ? `Rising: ${riser.team} (${riser.record}) looks like the real thing. ` : ''}` +
          `${ctx.userTeam ? `Local segment: ${ctx.userTeam} sits at ${ctx.userRecord}${ctx.userRank ? `, ranked #${ctx.userRank}` : ''} — the callers have OPINIONS. ` : ''}` +
          `Overreaction of the week: "${ctx.upsets[0] ? `${ctx.upsets[0].loser} should fire everyone in the building` : 'the poll is rigged and always has been'}".`,
      }
    : null;

  return { posts, article, podcast };
}

/** Offline replies when the user posts something — the bots always answer. */
export function offlineReplies(userBody: string, ctx: NetWeekContext): { handle: string; body: string; likes: number }[] {
  const rand = mulberry32(userBody.length * 7 + ctx.week);
  const likes = () => Math.floor(rand() * 900) + 1;
  const pool = [
    { handle: '@TheGoalLineShow', body: 'HOT TAKE ALERT. And you know what — I respect it. WRONG, but I respect it.' },
    { handle: '@StatsNerdCFB', body: `The numbers say otherwise: ${ctx.top10[0] ? `${ctx.top10[0].team} is ${ctx.top10[0].record}` : 'check the table'}. But go off.` },
    { handle: '@gridironGrandpa', body: 'Back in my day coaches posted nothing and won plenty.' },
    { handle: '@Client97', body: "interesting timing on this post. hearing things. can't say more." },
    { handle: '@UpsetAlertSzn', body: 'this is the energy the sport needs 🚨' },
  ];
  const count = 2 + Math.floor(rand() * 2);
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, count).map((r) => ({ ...r, likes: likes() }));
}

/** Offline comment section for a tagged clip/screenshot ("video upload"). */
export function offlineMediaComments(
  desc: string,
  gameLabel: string | null,
  players: string[],
  ctx: NetWeekContext,
): DraftPost[] {
  const rand = mulberry32(desc.length * 13 + (gameLabel?.length ?? 0));
  const likes = () => Math.floor(rand() * 2500) + 2;
  const star = players[0] ?? null;
  const out: DraftPost[] = [];
  out.push({
    handle: '@UpsetAlertSzn',
    body: star ? `${star} is HIM. That's the clip. That's the tweet.` : 'This clip goes hard. Rewatched it five times.',
    likes: likes(),
    replies: [
      {
        handle: '@gridironGrandpa',
        body: star ? `${star} is fine. Barry in '88 did this against real defenses in the snow.` : 'We had clips like this every week in 1987. On VHS.',
        likes: likes(),
      },
      { handle: '@StatsNerdCFB', body: 'The broken-tackle rate on this play alone is a 99th-percentile outcome.', likes: likes() },
    ],
  });
  out.push({
    handle: fanFor(ctx.userTeam).handle,
    body: gameLabel ? `Was there. ${gameLabel}. Still not over it.` : 'I remember exactly where I was for this one.',
    likes: likes(),
    replies: [{ handle: '@TheGoalLineShow', body: 'GOAT conversation. I said what I said. Call in Monday.', likes: likes() }],
  });
  return out;
}
