import { getSeasonsByDynasty } from '../../database/helpers';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getStandings } from '../../database/getStandings';
import { getNationalStatLeaders } from '../../database/getNationalStatLeaders';
import { getNationalTeamStats } from '../../database/getNationalTeamStats';
import { listMediaItems } from '../../database/media';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import { ensureAccounts, getEditions, insertPosts } from '../../database/dynastyNet';
import { FIXED_CAST } from './cast';
import { withBatchedPersist } from '../../database/init';
import type { LeagueScoreGame } from '../../shared/types';
import type { NetGenerateResult, Top10Topic } from '../../shared/netTypes';

/**
 * The Shows — long-form programming built on the archive.
 *
 * Throwback Thursday resurfaces a real past moment (title games, upsets,
 * ranked wins) as a nostalgic documentary segment, and links the DynastyTube
 * upload when one is tagged to that game. The Top 10 is a countdown show: a
 * catalog of topics, each producing a 10-to-1 article ranked from the
 * database. Both get richer every archived season — a year-15 dynasty has a
 * year-15 sample to argue from.
 */

// ---------------------------------------------------------------- throwback

interface Moment {
  seasonId: number;
  seasonYear: number;
  gameId: number;
  week: number;
  winner: string;
  loser: string;
  score: string;
  winnerRank: number | null;
  loserRank: number | null;
  bowlName: string | null;
  isChampionship: boolean;
  /** Higher = more worthy of a segment. */
  weight: number;
}

function momentsOf(dynastyId: string, seasonId: number, seasonYear: number, maxWeek?: number): Moment[] {
  const scores = getLeagueScores(dynastyId, seasonId);
  if (!scores) return [];
  const out: Moment[] = [];
  for (const g of scores.games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    if (maxWeek !== undefined && g.week > maxWeek) continue;
    const homeWon = g.homeScore > g.awayScore;
    const winnerRank = homeWon ? g.homeRank : g.awayRank;
    const loserRank = homeWon ? g.awayRank : g.homeRank;
    let weight = 0;
    if (g.isNationalChampionship) weight += 100;
    else if (g.weekType === 'ConferenceChampionship') weight += 60;
    else if (g.bowlName) weight += 40;
    if (winnerRank !== null && loserRank !== null) weight += 25;
    if (loserRank !== null && winnerRank === null) weight += 35; // upset
    const margin = Math.abs(g.homeScore - g.awayScore);
    if (margin <= 3) weight += 15;
    if (g.homeScore + g.awayScore >= 80) weight += 10;
    if (weight === 0) continue;
    out.push({
      seasonId,
      seasonYear,
      gameId: g.gameId,
      week: g.week,
      winner: homeWon ? g.homeTeamName : g.awayTeamName,
      loser: homeWon ? g.awayTeamName : g.homeTeamName,
      score: homeWon ? `${g.homeScore}-${g.awayScore}` : `${g.awayScore}-${g.homeScore}`,
      winnerRank,
      loserRank,
      bowlName: g.bowlName,
      isChampionship: g.isNationalChampionship,
      weight,
    });
  }
  return out;
}

const THROWBACK_SYSTEM = `You write "Throwback Thursday" — a nostalgic retro segment about ONE past moment in a fictional college-football universe (a video-game dynasty). Style: classic sports-documentary narration — reverent, vivid, a little dramatic. 2 short paragraphs: set the scene and relive the moment, then what it meant. Facts (teams, score, ranks, year, bowl) must come ONLY from the data. End with one line inviting fans to share where they were. Return ONLY JSON: {"title","body"} — title like "TBT: <year> — <hook>".`;

export async function generateThrowback(dynastyId: string): Promise<NetGenerateResult> {
  const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData);
  if (!seasons.length) {
    return { ok: false, engine: 'offline', message: 'No archived seasons yet — sync first.', postsAdded: 0 };
  }
  const current = seasons.find((s) => s.isCurrent);
  const past = seasons.filter((s) => !s.isCurrent);

  let candidates: Moment[] = [];
  for (const s of past) candidates.push(...momentsOf(dynastyId, s.id, s.seasonYear));
  if (!candidates.length && current) {
    // Year one of a dynasty: no past seasons exist yet, so throw back to the
    // current season's own earlier weeks (at least a month old).
    const latest = Math.max(
      0,
      ...(getLeagueScores(dynastyId, current.id)?.games ?? [])
        .filter((g) => g.homeScore !== null)
        .map((g) => g.week),
    );
    candidates = momentsOf(dynastyId, current.id, current.seasonYear, latest - 4);
  }
  // Skip moments the show already covered (matched on year + matchup).
  const aired = getEditions(dynastyId, current?.id ?? seasons[0].id, 'throwback')
    .concat(past.length ? past.flatMap((s) => getEditions(dynastyId, s.id, 'throwback')) : []);
  candidates = candidates.filter(
    (m) => !aired.some((e) => e.body.includes(m.winner) && e.body.includes(m.loser) && e.body.includes(String(m.seasonYear))),
  );
  if (!candidates.length) {
    return { ok: true, engine: 'offline', message: 'Every big moment has already had its throwback — play more football.', postsAdded: 0 };
  }
  candidates.sort((a, b) => b.weight - a.weight);
  // Rotate among the top tier rather than always airing the same #1.
  const pick = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];

  // A tagged DynastyTube upload for this exact game becomes the linked clip.
  const media = (listMediaItems(dynastyId, pick.seasonId) ?? []).find((m) => m.gameId === pick.gameId);

  // That season's final context makes the segment specific.
  const standings = getStandings(dynastyId, pick.seasonId);
  const top5 = (standings?.groups ?? [])
    .flatMap((g) => g.teams)
    .filter((t) => t.mediaPollRank !== null && t.mediaPollRank <= 5)
    .sort((a, b) => (a.mediaPollRank ?? 9) - (b.mediaPollRank ?? 9))
    .map((t) => `#${t.mediaPollRank} ${t.teamName} (${t.overallWins}-${t.overallLosses})`);

  const facts = {
    year: pick.seasonYear,
    week: pick.week,
    winner: pick.winner,
    loser: pick.loser,
    score: pick.score,
    winnerRank: pick.winnerRank,
    loserRank: pick.loserRank,
    bowlName: pick.bowlName,
    nationalChampionship: pick.isChampionship,
    thatSeasonsFinalTop5: top5,
    fanUploadOfThisGame: media ? media.description || 'an untitled highlight' : null,
  };

  let title: string;
  let body: string;
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      const out = await generateJson<{ title: string; body: string }>(
        THROWBACK_SYSTEM,
        `THE MOMENT:\n${JSON.stringify(facts, null, 1)}`,
        1200,
      );
      title = out.title;
      body = out.body;
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      ({ title, body } = offlineThrowback(facts));
    }
  } else {
    ({ title, body } = offlineThrowback(facts));
  }

  const account = ensureShowAccounts(dynastyId).get('@ThrowbackThursday');
  if (!account) return { ok: false, engine, message: 'Show account missing.', postsAdded: 0 };
  const targetSeason = current?.id ?? seasons[0].id;
  withBatchedPersist(() => {
    insertPosts(dynastyId, [
      {
        seasonId: targetSeason,
        accountId: account.id,
        kind: 'throwback',
        title,
        body,
        mediaId: media?.id ?? null,
        week: 0,
      },
    ]);
  });
  return { ok: true, engine, message, postsAdded: 1 };
}

function offlineThrowback(f: {
  year: number; week: number; winner: string; loser: string; score: string;
  winnerRank: number | null; loserRank: number | null; bowlName: string | null;
  nationalChampionship: boolean; fanUploadOfThisGame: string | null;
}): { title: string; body: string } {
  const stage = f.nationalChampionship
    ? 'the national championship'
    : f.bowlName
      ? `the ${f.bowlName}`
      : `week ${f.week}`;
  return {
    title: `TBT: ${f.year} — ${f.winner} ${f.score} ${f.loser}`,
    body:
      `On this day in ${f.year}, ${f.winnerRank ? `#${f.winnerRank} ` : ''}${f.winner} beat ` +
      `${f.loserRank ? `#${f.loserRank} ` : ''}${f.loser} ${f.score} in ${stage}.` +
      `${f.nationalChampionship ? ' Confetti. Dogpiles. A season immortalized.' : ' A game the faithful still talk about.'}` +
      `${f.fanUploadOfThisGame ? ` The clip ("${f.fanUploadOfThisGame}") is still up on DynastyTube.` : ''}` +
      ' Where were you when it happened?',
  };
}

// ------------------------------------------------------------------ top 10

type Dataset = 'passing' | 'rushing' | 'receiving' | 'defense' | 'teams' | 'games';

const T = (key: string, label: string, group: string, dataset: Dataset, angle: string): Top10Topic => ({
  key, label, group, angle,
  // dataset rides along for the builder; hidden from the renderer's type on purpose
  ...( { dataset } as object ),
});

/** The catalog. Every topic maps to one cross-season dataset + a ranking angle for the writer. */
export const TOP10_TOPICS: Top10Topic[] = [
  // --- Quarterbacks / passing
  T('qb-seasons', 'Best QB seasons ever', 'Quarterbacks', 'passing', 'Rank the greatest single-season quarterback performances — volume, efficiency, TD-to-INT.'),
  T('qb-arms', 'Strongest arms (yardage kings)', 'Quarterbacks', 'passing', 'Pure passing yardage seasons.'),
  T('qb-td', 'Most lethal TD-throwers', 'Quarterbacks', 'passing', 'Passing touchdowns in a season.'),
  T('qb-efficient', 'Most efficient passers', 'Quarterbacks', 'passing', 'Completion rate and TD-to-INT balance, minimum real volume.'),
  T('qb-gunslingers', 'Gunslingers (glorious and reckless)', 'Quarterbacks', 'passing', 'High yardage AND high interceptions — celebrate the chaos.'),
  T('qb-dual', 'Best dual-threat QBs', 'Quarterbacks', 'passing', 'Quarterbacks who also punished defenses on the ground.'),
  // --- Running backs / rushing
  T('rb-seasons', 'Best RB seasons ever', 'Running backs', 'rushing', 'Greatest single-season rushing performances.'),
  T('rb-workhorses', 'Ultimate workhorses', 'Running backs', 'rushing', 'Carry volume — the backs who carried the whole offense.'),
  T('rb-homerun', 'Home-run hitters', 'Running backs', 'rushing', 'Explosive yard-per-carry seasons with long runs.'),
  T('rb-td', 'End-zone machines', 'Running backs', 'rushing', 'Rushing touchdown seasons.'),
  T('rb-tandem', 'Best one-two punches', 'Running backs', 'rushing', 'Two backs from the same team and season, both producing.'),
  // --- Receivers
  T('wr-seasons', 'Best WR seasons ever', 'Receivers', 'receiving', 'Greatest single-season receiving performances.'),
  T('wr-hands', 'Most reliable hands', 'Receivers', 'receiving', 'Reception volume.'),
  T('wr-deep', 'Deep-ball terrors', 'Receivers', 'receiving', 'Yards per catch with real volume.'),
  T('wr-td', 'Touchdown magnets', 'Receivers', 'receiving', 'Receiving touchdown seasons.'),
  T('te-best', 'Best tight-end seasons', 'Receivers', 'receiving', 'Best seasons by tight ends specifically.'),
  // --- Defense
  T('def-seasons', 'Best defensive player seasons', 'Defense', 'defense', 'The most dominant individual defensive seasons.'),
  T('pass-rushers', 'Best pass rushers ever', 'Defense', 'defense', 'Sack artists — single-season sack totals.'),
  T('tacklers', 'Human missiles (tackle machines)', 'Defense', 'defense', 'Total tackles in a season.'),
  T('ballhawks', 'Ballhawks', 'Defense', 'defense', 'Interceptions, pick-sixes, return yards.'),
  T('tfl-kings', 'Backfield wreckers', 'Defense', 'defense', 'Tackles for loss.'),
  T('def-units', 'Best defenses of all time', 'Defense', 'teams', 'Rank team DEFENSES: fewest points and yards allowed, takeaways, sacks.'),
  T('def-worst', 'Worst defenses ever', 'Defense', 'teams', 'The most scorched-earth defensive units — most points and yards allowed.'),
  // --- Teams
  T('teams-best', 'Best teams of all time', 'Teams', 'teams', 'The greatest single-season teams — record, dominance, titles.'),
  T('teams-worst', 'Worst teams ever', 'Teams', 'teams', 'The most miserable seasons any program endured.'),
  T('offenses-best', 'Best offenses of all time', 'Teams', 'teams', 'Points and yardage machines.'),
  T('teams-balanced', 'Most complete teams', 'Teams', 'teams', 'Elite on BOTH sides of the ball.'),
  T('teams-onehit', 'One-hit wonders', 'Teams', 'teams', 'Programs with one shining season surrounded by mediocrity — needs multiple seasons of history.'),
  T('teams-chokers', 'Great teams that fell short', 'Teams', 'teams', 'Dominant records, no championship.'),
  T('teams-surprise', 'Biggest surprise teams', 'Teams', 'teams', 'Teams that massively outperformed their talent or history.'),
  T('teams-runs', 'Greatest dynasty runs', 'Teams', 'teams', 'Sustained excellence across consecutive seasons — needs several seasons of history.'),
  // --- Games
  T('games-best', 'Greatest games ever played', 'Games', 'games', 'The best single games — stakes, closeness, drama.'),
  T('games-upsets', 'Biggest upsets of all time', 'Games', 'games', 'Unranked or lower-ranked teams toppling giants.'),
  T('games-shootouts', 'Wildest shootouts', 'Games', 'games', 'Highest combined scoring.'),
  T('games-blowouts', 'Most brutal beatdowns', 'Games', 'games', 'Largest margins of victory, especially against ranked teams.'),
  T('games-title', 'Best championship games', 'Games', 'games', 'National and conference title games, ranked by drama.'),
  T('games-bowls', 'Best bowl games', 'Games', 'games', 'The bowl classics.'),
  T('games-heartbreak', 'Most heartbreaking losses', 'Games', 'games', 'One-score losses in huge moments.'),
  T('games-rivalry', 'Best rivalry-feeling games', 'Games', 'games', 'Repeat matchups and grudge games with everything on the line.'),
];

interface Top10Data {
  seasonsCount: number;
  years: string;
  rows: string[];
}

function buildDataset(dynastyId: string, dataset: Dataset): Top10Data {
  const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData).sort((a, b) => a.seasonYear - b.seasonYear);
  const rows: string[] = [];
  for (const s of seasons) {
    if (dataset === 'passing' || dataset === 'rushing' || dataset === 'receiving' || dataset === 'defense') {
      const leaders = getNationalStatLeaders(dynastyId, s.id);
      const list = leaders?.[dataset] ?? [];
      for (const e of list.slice(0, 12)) {
        const o = e.offense;
        const d = e.defense;
        const line =
          dataset === 'passing' && o
            ? `${o.passCompletions}/${o.passAttempts}, ${o.passYards} yds, ${o.passTDs} TD, ${o.passInts} INT; rushed ${o.rushYards} yds ${o.rushTDs} TD`
            : dataset === 'rushing' && o
              ? `${o.rushAttempts} car, ${o.rushYards} yds, ${o.rushTDs} TD, long ${o.rushLongest}`
              : dataset === 'receiving' && o
                ? `${o.receptions} rec, ${o.receivingYards} yds, ${o.receivingTDs} TD, long ${o.receivingLongest}`
                : '';
        if (dataset === 'defense' && d) {
          rows.push(
            `${s.seasonYear} ${e.firstName} ${e.lastName} (${e.position}, ${e.teamName}): ${d.tackles + d.assistedTackles} tkl, ${d.tacklesForLoss} TFL, ${d.sacks} sacks, ${d.interceptions} INT, ${d.forcedFumbles} FF`,
          );
        } else if (line) {
          rows.push(`${s.seasonYear} ${e.firstName} ${e.lastName} (${e.position}, ${e.teamName}): ${line}`);
        }
      }
    } else if (dataset === 'teams') {
      const stats = getNationalTeamStats(dynastyId, s.id) ?? [];
      const standings = getStandings(dynastyId, s.id);
      const rec = new Map(
        (standings?.groups ?? []).flatMap((g) => g.teams).map((t) => [t.teamName, `${t.overallWins}-${t.overallLosses}${t.mediaPollRank ? `, finished #${t.mediaPollRank}` : ''}`]),
      );
      const fmt = (r: typeof stats[number]) =>
        `${s.seasonYear} ${r.teamName} (${rec.get(r.teamName) ?? '?'}): ${r.points} PF, ${r.pointsAllowed} PA, ${r.offenseYards} off yds (${r.passYards} pass/${r.rushYards} rush), ${r.defTotalYards} yds allowed, ${r.sacks} sacks, ${r.takeaways} TA, ${r.turnovers} TO`;
      const sorted = (cmp: (a: typeof stats[number], b: typeof stats[number]) => number, n: number) =>
        [...stats].sort(cmp).slice(0, n);
      const picks = new Set<string>();
      for (const r of [
        ...sorted((a, b) => b.points - a.points, 8),
        ...sorted((a, b) => a.points - b.points, 6),
        ...sorted((a, b) => a.pointsAllowed - b.pointsAllowed, 8),
        ...sorted((a, b) => b.pointsAllowed - a.pointsAllowed, 6),
        ...sorted((a, b) => b.offenseYards - a.offenseYards, 6),
      ]) {
        const line = fmt(r);
        if (!picks.has(line)) { picks.add(line); rows.push(line); }
      }
    } else {
      const scores = getLeagueScores(dynastyId, s.id);
      const played = (scores?.games ?? []).filter((g) => g.homeScore !== null && g.awayScore !== null);
      const fmt = (g: LeagueScoreGame) => {
        const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0);
        const w = homeWon ? g.homeTeamName : g.awayTeamName;
        const l = homeWon ? g.awayTeamName : g.homeTeamName;
        const wr = homeWon ? g.homeRank : g.awayRank;
        const lr = homeWon ? g.awayRank : g.homeRank;
        return `${s.seasonYear} wk${g.week}: ${wr ? `#${wr} ` : ''}${w} beat ${lr ? `#${lr} ` : ''}${l} ${homeWon ? `${g.homeScore}-${g.awayScore}` : `${g.awayScore}-${g.homeScore}`}${g.bowlName ? ` (${g.bowlName})` : ''}${g.isNationalChampionship ? ' [NATIONAL CHAMPIONSHIP]' : ''}`;
      };
      const total = (g: LeagueScoreGame) => (g.homeScore ?? 0) + (g.awayScore ?? 0);
      const margin = (g: LeagueScoreGame) => Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0));
      const picks = new Set<string>();
      const add = (games: LeagueScoreGame[]) => {
        for (const g of games) { const line = fmt(g); if (!picks.has(line)) { picks.add(line); rows.push(line); } }
      };
      add(played.filter((g) => g.isNationalChampionship || g.weekType === 'ConferenceChampionship'));
      add(played.filter((g) => g.bowlName).slice(0, 12));
      add(played.filter((g) => g.homeRank !== null && g.awayRank !== null).slice(0, 10));
      add([...played].sort((a, b) => total(b) - total(a)).slice(0, 8));
      add([...played].sort((a, b) => margin(b) - margin(a)).slice(0, 6));
      add(played.filter((g) => {
        const homeWon = (g.homeScore ?? 0) > (g.awayScore ?? 0);
        const wr = homeWon ? g.homeRank : g.awayRank;
        const lr = homeWon ? g.awayRank : g.homeRank;
        return lr !== null && (wr === null || wr > lr + 8);
      }).slice(0, 10));
    }
  }
  return {
    seasonsCount: seasons.length,
    years: seasons.length ? `${seasons[0].seasonYear}-${seasons[seasons.length - 1].seasonYear}` : '',
    rows: rows.slice(0, 400),
  };
}

const TOP10_SYSTEM = `You write "The Top 10" — a countdown documentary show for a fictional college-football universe (a video-game dynasty), in the style of classic NFL Films countdowns. You are given the topic and the REAL data pool from the dynasty's archive ({YEARS}, {N} season(s)).

Write the episode: an intro paragraph, then the countdown from #10 to #1 — each entry a bold-worthy name/team line followed by 2-3 sentences with the real numbers. Close with one debate-bait line. Every stat and result must come from the data pool; never invent. If the era is young (few seasons), acknowledge it with charm ("a young sport's early legends") and it's fine to rank fewer than 10 — rank what the data supports. Return ONLY JSON: {"title","body"}.`;

export async function generateTop10(dynastyId: string, topicKey: string): Promise<NetGenerateResult> {
  const topic = TOP10_TOPICS.find((t) => t.key === topicKey);
  if (!topic) return { ok: false, engine: 'offline', message: 'Unknown topic.', postsAdded: 0 };
  const dataset = (topic as unknown as { dataset: Dataset }).dataset;
  const data = buildDataset(dynastyId, dataset);
  if (!data.rows.length) {
    return { ok: false, engine: 'offline', message: 'No archived data yet — sync a season first.', postsAdded: 0 };
  }

  let title: string;
  let body: string;
  let engine: 'claude' | 'offline' = 'offline';
  let message: string | undefined;
  if (hasLiveEngine()) {
    try {
      const out = await generateJson<{ title: string; body: string }>(
        TOP10_SYSTEM.replace('{YEARS}', data.years).replace('{N}', String(data.seasonsCount)),
        `TOPIC: ${topic.label}\nANGLE: ${topic.angle}\n\nDATA POOL:\n${data.rows.join('\n')}`,
        4000,
      );
      title = out.title;
      body = out.body;
      engine = 'claude';
    } catch (err) {
      message = err instanceof NetClaudeError ? `${err.message} — used the offline engine instead.` : undefined;
      title = `The Top 10: ${topic.label}`;
      body = `The raw board (offline engine — add an API key for the full episode):\n\n${data.rows.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
    }
  } else {
    title = `The Top 10: ${topic.label}`;
    body = `The raw board (offline engine — add an API key for the full episode):\n\n${data.rows.slice(0, 10).map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }

  const account = ensureShowAccounts(dynastyId).get('@TheTop10Show');
  const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData);
  const target = seasons.find((s) => s.isCurrent) ?? seasons[0];
  if (!account || !target) return { ok: false, engine, message: 'Show account or season missing.', postsAdded: 0 };
  withBatchedPersist(() => {
    insertPosts(dynastyId, [
      { seasonId: target.id, accountId: account.id, kind: 'top10', title, body, week: 0 },
    ]);
  });
  return { ok: true, engine, message, postsAdded: 1 };
}

// ------------------------------------------------------------------- shared

function ensureShowAccounts(dynastyId: string) {
  const accounts = ensureAccounts(dynastyId, [
    ...FIXED_CAST,
    {
      handle: '@ThrowbackThursday',
      displayName: 'Throwback Thursday',
      kind: 'podcast',
      persona: 'Nostalgic documentary narrator. Reverent, vivid, slightly dramatic. Lives in the archive.',
    },
    {
      handle: '@TheTop10Show',
      displayName: 'The Top 10',
      kind: 'podcast',
      persona: 'Countdown documentary show. Authoritative, loves a debate, always ranks from the numbers.',
    },
  ]);
  return new Map(accounts.map((a) => [a.handle, a]));
}
