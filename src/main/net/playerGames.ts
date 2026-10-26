import { getGameLog } from '../../database/getGameLog';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getSeasonById, getSeasonsByDynasty } from '../../database/helpers';
import { gameImpactScore } from '../../shared/gameImpactScore';
import type { DefensiveGameLine, GameLogEntry, OffensiveGameLine } from '../../shared/types';

/**
 * PLAYER GAME TOTALS, FOR THE NET (user request, 2026-10-26): every game's
 * per-player box score already sits in each season's league-wide `gamelog`
 * snapshot — the same data the Game Info "Players" tab renders. Until now the
 * Historian and the Board never saw it, so "who had the best single game of
 * 2027?" or "how did their QB do in the natty?" had nothing behind it.
 *
 * Everything here is DERIVED from snapshots the sync already writes; nothing
 * new is stored. Lines are joined to the game (week, opponent, score, result)
 * so a performance always reads in context.
 */

export interface GamePerformance {
  seasonYear: number;
  week: number;
  gameId: number;
  playerId: number;
  name: string;
  position: string;
  team: string;
  opponent: string;
  /** "W 38-14" from the player's side; null if the game row couldn't be resolved. */
  result: string | null;
  isPostseason: boolean;
  bowlName: string | null;
  offense: OffensiveGameLine | null;
  defense: DefensiveGameLine | null;
  impact: number;
}

/* Joined performances per season, keyed on the season's extractedAt so a re-sync invalidates. */
const cache = new Map<number, { stamp: string; perfs: GamePerformance[] }>();

export function seasonPerformances(dynastyId: string, seasonId: number): GamePerformance[] {
  const season = getSeasonById(seasonId);
  if (!season || !season.hasFullData) return [];
  const hit = cache.get(seasonId);
  if (hit && hit.stamp === season.extractedAt) return hit.perfs;

  const log = getGameLog(dynastyId, seasonId) ?? [];
  const games = new Map((getLeagueScores(dynastyId, seasonId)?.games ?? []).map((g) => [g.gameId, g]));
  // A player can log offense AND defense in one game (two-way, or a pick by a
  // receiver) — one performance per player per game.
  const byKey = new Map<string, GamePerformance>();
  for (const entry of log as GameLogEntry[]) {
    const game = games.get(entry.gameId);
    if (!game || game.homeScore === null || game.awayScore === null) continue;
    const isHome = entry.teamIndex === game.homeTeamIndex;
    if (!isHome && entry.teamIndex !== game.awayTeamIndex) continue; // pre-teamIndex seasons: can't place him
    const key = `${entry.gameId}:${entry.playerId}`;
    let perf = byKey.get(key);
    if (!perf) {
      const us = isHome ? game.homeScore : game.awayScore;
      const them = isHome ? game.awayScore : game.homeScore;
      perf = {
        seasonYear: season.seasonYear,
        week: game.week,
        gameId: entry.gameId,
        playerId: entry.playerId,
        name: `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim() || `Player ${entry.playerId}`,
        position: entry.position ?? '',
        team: isHome ? game.homeTeamName : game.awayTeamName,
        opponent: isHome ? game.awayTeamName : game.homeTeamName,
        result: `${us > them ? 'W' : us < them ? 'L' : 'T'} ${us}-${them}`,
        isPostseason: Boolean(game.bowlName) || game.isNationalChampionship,
        bowlName: game.isNationalChampionship ? 'National Championship' : game.bowlName,
        offense: null,
        defense: null,
        impact: 0,
      };
      byKey.set(key, perf);
    }
    if (entry.category === 'offense') perf.offense = entry.line as OffensiveGameLine;
    else perf.defense = entry.line as DefensiveGameLine;
    perf.impact += gameImpactScore(entry);
  }
  const perfs = [...byKey.values()];
  cache.set(seasonId, { stamp: season.extractedAt, perfs });
  return perfs;
}

/** "24/31, 356 pass yds, 3 TD, 1 INT · 6 rec, 120 yds, 2 TD · 11 tkl (2 TFL), 2 sck" */
export function statLine(p: Pick<GamePerformance, 'offense' | 'defense'>): string {
  const parts: string[] = [];
  const o = p.offense;
  if (o) {
    if (o.passAttempts > 0) {
      parts.push(`${o.passCompletions}/${o.passAttempts}, ${o.passYards} pass yds, ${o.passTDs} TD${o.passInts ? `, ${o.passInts} INT` : ''}${o.passLongest ? `, long ${o.passLongest}` : ''}`);
    }
    if (o.rushAttempts > 0) parts.push(`${o.rushAttempts} car, ${o.rushYards} rush yds${o.rushTDs ? `, ${o.rushTDs} TD` : ''}${o.rushLongest ? `, long ${o.rushLongest}` : ''}`);
    if (o.receptions > 0) parts.push(`${o.receptions} rec, ${o.receivingYards} yds${o.receivingTDs ? `, ${o.receivingTDs} TD` : ''}${o.receivingLongest ? `, long ${o.receivingLongest}` : ''}`);
  }
  const d = p.defense;
  if (d) {
    const tkl = d.tackles + d.assistedTackles;
    const bits: string[] = [];
    if (tkl > 0) bits.push(`${tkl} tkl${d.tacklesForLoss ? ` (${d.tacklesForLoss} TFL)` : ''}`);
    if (d.sacks > 0) bits.push(`${d.sacks} sck`);
    if (d.interceptions > 0) bits.push(`${d.interceptions} INT${d.interceptionTDs ? ` (${d.interceptionTDs} TD)` : ''}`);
    if (d.forcedFumbles > 0) bits.push(`${d.forcedFumbles} FF`);
    if (d.fumbleRecoveries > 0) bits.push(`${d.fumbleRecoveries} FR`);
    if (d.passDeflections > 0) bits.push(`${d.passDeflections} PD`);
    if (bits.length) parts.push(bits.join(', '));
  }
  return parts.join(' · ');
}

function perfLine(p: GamePerformance, withSeason = false): string {
  const when = `${withSeason ? `${p.seasonYear} ` : ''}Wk ${p.week}${p.bowlName ? ` (${p.bowlName})` : ''}`;
  return `${when}: ${p.name} (${p.position}, ${p.team}) vs ${p.opponent} [${p.result}] — ${statLine(p)}`;
}

const totalTDs = (p: GamePerformance) =>
  (p.offense ? p.offense.passTDs + p.offense.rushTDs + p.offense.receivingTDs : 0) + (p.defense?.interceptionTDs ?? 0);

/**
 * The season's standout single-game performances, by category, so "best
 * game of the year" arguments have the real box scores behind them.
 * Games against FCS opponents count too (user call, 2026-10-26) — the
 * opponent is printed on every line, so the board can roast a cupcake
 * stat-pad on its own.
 */
export function standoutPerformances(perfs: GamePerformance[], perCategory = 6): GamePerformance[] {
  const pick = (score: (p: GamePerformance) => number, floor: number) =>
    perfs
      .filter((p) => score(p) >= floor)
      .sort((a, b) => score(b) - score(a))
      .slice(0, perCategory);
  const chosen = new Map<string, GamePerformance>();
  const add = (list: GamePerformance[]) => list.forEach((p) => chosen.set(`${p.gameId}:${p.playerId}`, p));
  add(pick((p) => p.offense?.passYards ?? 0, 300));
  add(pick((p) => p.offense?.rushYards ?? 0, 150));
  add(pick((p) => p.offense?.receivingYards ?? 0, 130));
  add(pick(totalTDs, 4));
  add(pick((p) => p.defense?.sacks ?? 0, 2));
  add(pick((p) => (p.defense?.interceptions ?? 0) * 2 + (p.defense?.interceptionTDs ?? 0) * 3, 4));
  add(pick((p) => (p.defense ? p.defense.tackles + p.defense.assistedTackles : 0), 13));
  return [...chosen.values()].sort((a, b) => b.impact - a.impact);
}

/** Prompt block: the season's best individual games. Empty when nothing synced has box scores. */
export function seasonStandoutsText(dynastyId: string, seasonId: number, limit = 36): string {
  const perfs = seasonPerformances(dynastyId, seasonId);
  if (!perfs.length) return '';
  const top = standoutPerformances(perfs).slice(0, limit);
  if (!top.length) return '';
  const year = perfs[0].seasonYear;
  return `\n\nSTANDOUT INDIVIDUAL GAMES OF ${year} (real box scores — cite these numbers, never invent stats):\n${top.map((p) => perfLine(p)).join('\n')}`;
}

/** Per-team box-score leaders for one game — what a post-game thread argues about. */
export function gameLeadersText(dynastyId: string, seasonId: number, gameId: number): string {
  const inGame = seasonPerformances(dynastyId, seasonId).filter((p) => p.gameId === gameId);
  if (!inGame.length) return '';
  const teams = [...new Set(inGame.map((p) => p.team))];
  const lines = teams.map((team) => {
    const side = inGame.filter((p) => p.team === team);
    const best = (score: (p: GamePerformance) => number) => side.filter((p) => score(p) > 0).sort((a, b) => score(b) - score(a))[0];
    const leaders = [
      best((p) => p.offense?.passAttempts ?? 0),
      best((p) => p.offense?.rushYards ?? 0),
      best((p) => p.offense?.receivingYards ?? 0),
      best((p) => (p.defense ? gameImpactScore({ category: 'defense', line: p.defense } as GameLogEntry) : 0)),
    ].filter((p): p is GamePerformance => Boolean(p));
    const unique = [...new Map(leaders.map((p) => [p.playerId, p])).values()];
    return `  ${team}: ${unique.map((p) => `${p.name} (${p.position}) ${statLine(p)}`).join('; ')}`;
  });
  return `   box score leaders:\n${lines.join('\n')}`;
}

/** Normalize for name matching: lowercase letters and spaces only. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Surnames that are also everyday (or football) words — a bare "love" in
 * "I love this team" must not pull a player's game log into the prompt.
 * Full-name mentions still match these players.
 */
const COMMON_WORD_SURNAMES = new Set(
  'love hill king rice bell ward wade gray grey rush pass best game ball will more hall west east north south long short young black white brown green banks price cash rich hope joy page mark lane park wood woods stone rose fair sharp swift strong hunter walker baker cook mason miles moon reed frost snow hart hood hand head foot field fields lamb wolf fox drew dean shaw ross ford carr kidd kirk lord wise good goodman nice speed power powers bowl bowls rock early late little small hale dye blue gold silver pace post block blocks'.split(' '),
);

/**
 * Players whose full name (or distinctive last name) appears in `text`, from
 * a pool of performances. Full-name hits always count; a bare last name only
 * counts when it's 4+ letters, not an everyday word, and unique in the pool,
 * so "Smith" never drags in twelve Smiths and "love" never means a player.
 */
export function mentionedPlayers(text: string, perfs: GamePerformance[], max = 6): string[] {
  const hay = ` ${norm(text)} `;
  const names = [...new Set(perfs.map((p) => p.name))];
  const full = names.filter((n) => n.includes(' ') && hay.includes(` ${norm(n)} `));
  const lastCounts = new Map<string, string[]>();
  for (const n of names) {
    const last = norm(n).split(' ').pop() ?? '';
    if (last.length >= 4 && !COMMON_WORD_SURNAMES.has(last)) lastCounts.set(last, [...(lastCounts.get(last) ?? []), n]);
  }
  const byLast = [...lastCounts.entries()]
    .filter(([last, owners]) => owners.length === 1 && hay.includes(` ${last} `))
    .map(([, owners]) => owners[0]);
  // Most productive first when the cap bites — the star, not the backup.
  const impactOf = (n: string) => perfs.filter((p) => p.name === n).reduce((s, p) => s + p.impact, 0);
  return [...new Set([...full, ...byLast])].sort((a, b) => impactOf(b) - impactOf(a)).slice(0, max);
}

/** Every game line for the named players across the given performances, grouped by player then date, with season totals. */
export function playerGameLogsText(names: string[], perfs: GamePerformance[], heading: string): string {
  if (!names.length) return '';
  const blocks = names.map((name) => {
    const games = perfs
      .filter((p) => p.name === name)
      .sort((a, b) => a.seasonYear - b.seasonYear || a.week - b.week);
    if (!games.length) return '';
    const first = games[0];
    const seasons = [...new Set(games.map((g) => g.seasonYear))];
    const totals = seasons.map((year) => {
      const yr = games.filter((g) => g.seasonYear === year);
      const sum = (f: (p: GamePerformance) => number) => yr.reduce((s, p) => s + f(p), 0);
      const bits = [
        sum((p) => p.offense?.passYards ?? 0) && `${sum((p) => p.offense?.passYards ?? 0)} pass yds, ${sum((p) => p.offense?.passTDs ?? 0)} pass TD`,
        sum((p) => p.offense?.rushYards ?? 0) && `${sum((p) => p.offense?.rushYards ?? 0)} rush yds, ${sum((p) => p.offense?.rushTDs ?? 0)} rush TD`,
        sum((p) => p.offense?.receivingYards ?? 0) && `${sum((p) => p.offense?.receivingYards ?? 0)} rec yds, ${sum((p) => p.offense?.receivingTDs ?? 0)} rec TD`,
        sum((p) => (p.defense ? p.defense.tackles + p.defense.assistedTackles : 0)) &&
          `${sum((p) => (p.defense ? p.defense.tackles + p.defense.assistedTackles : 0))} tkl, ${sum((p) => p.defense?.sacks ?? 0)} sck, ${sum((p) => p.defense?.interceptions ?? 0)} INT`,
      ].filter(Boolean);
      return `${year}: ${yr.length} games${bits.length ? ` — ${bits.join('; ')}` : ''}`;
    });
    return `${name} (${first.position}, ${[...new Set(games.map((g) => g.team))].join(' / ')}) — ${totals.join(' | ')}\n${games.map((g) => `  ${perfLine(g, seasons.length > 1)}`).join('\n')}`;
  });
  const body = blocks.filter(Boolean).join('\n');
  return body ? `\n\n${heading}\n${body}` : '';
}

/** Every season of the dynasty with box scores, oldest first — the Historian's whole memory. */
export function dynastyPerformances(dynastyId: string): GamePerformance[] {
  return getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => a.seasonYear - b.seasonYear)
    .flatMap((s) => seasonPerformances(dynastyId, s.id));
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPUTED LEADERBOARDS (user report, 2026-10-26): "best five-game stretch in
   dynasty history" came back as "the archive can't prove consecutive games" —
   because the Historian only ever saw curated standouts, never every line,
   and every line across eight seasons (~300k) can't fit in a prompt. So the
   app does the counting and hands over the answers, computed over EVERY
   logged game.
   ───────────────────────────────────────────────────────────────────────── */

interface StretchCategory {
  key: string;
  label: string;
  score: (p: GamePerformance) => number;
  /** Ignore windows whose total is below this — a 5-game "rushing stretch" by a QB isn't one. */
  floor: number;
}

const takeaways = (p: GamePerformance) =>
  (p.defense ? p.defense.interceptions + p.defense.fumbleRecoveries + p.defense.forcedFumbles : 0);

const STRETCH_CATEGORIES: StretchCategory[] = [
  { key: 'impact', label: 'OVERALL (all-around production score)', score: (p) => p.impact, floor: 1 },
  { key: 'pass', label: 'PASSING YARDS', score: (p) => p.offense?.passYards ?? 0, floor: 1 },
  { key: 'passtd', label: 'PASSING TOUCHDOWNS', score: (p) => p.offense?.passTDs ?? 0, floor: 1 },
  { key: 'rush', label: 'RUSHING YARDS', score: (p) => p.offense?.rushYards ?? 0, floor: 1 },
  { key: 'rec', label: 'RECEIVING YARDS', score: (p) => p.offense?.receivingYards ?? 0, floor: 1 },
  { key: 'td', label: 'TOTAL TOUCHDOWNS (pass+rush+rec+def)', score: totalTDs, floor: 1 },
  { key: 'sack', label: 'SACKS', score: (p) => p.defense?.sacks ?? 0, floor: 1 },
  { key: 'take', label: 'TAKEAWAYS (INT + FF + FR)', score: takeaways, floor: 1 },
];

/** "Every game the TEAM played that season", by week — so a missed game breaks a stretch. */
function teamWeeks(perfs: GamePerformance[]): Map<string, number[]> {
  const out = new Map<string, Set<number>>();
  for (const p of perfs) {
    const k = `${p.seasonYear}|${p.team}`;
    if (!out.has(k)) out.set(k, new Set());
    out.get(k)!.add(p.week);
  }
  return new Map([...out.entries()].map(([k, s]) => [k, [...s].sort((a, b) => a - b)]));
}

interface Stretch {
  games: GamePerformance[];
  total: number;
}

/**
 * Best N-game stretches: N CONSECUTIVE games of the player's team in one
 * season, all of which he logged a line in. Returns the top `perCategory`
 * per category, never repeating a player within a category (his best
 * window only — otherwise one season's overlapping windows fill the list).
 */
export function bestStretches(perfs: GamePerformance[], window: number, perCategory = 5): { category: StretchCategory; stretches: Stretch[] }[] {
  const schedule = teamWeeks(perfs);
  const byPlayerSeason = new Map<string, GamePerformance[]>();
  for (const p of perfs) {
    const k = `${p.seasonYear}|${p.team}|${p.playerId}|${p.name}`;
    if (!byPlayerSeason.has(k)) byPlayerSeason.set(k, []);
    byPlayerSeason.get(k)!.push(p);
  }
  // Every valid consecutive window, once.
  const windows: GamePerformance[][] = [];
  for (const games of byPlayerSeason.values()) {
    if (games.length < window) continue;
    games.sort((a, b) => a.week - b.week);
    const weeks = schedule.get(`${games[0].seasonYear}|${games[0].team}`) ?? [];
    const slot = new Map(weeks.map((w, i) => [w, i]));
    for (let i = 0; i + window <= games.length; i++) {
      const run = games.slice(i, i + window);
      const first = slot.get(run[0].week) ?? -99;
      const last = slot.get(run[window - 1].week) ?? -99;
      if (last - first === window - 1) windows.push(run); // no team game skipped in between
    }
  }
  return STRETCH_CATEGORIES.map((category) => {
    const best = new Map<string, Stretch>();
    for (const run of windows) {
      const total = run.reduce((s, g) => s + category.score(g), 0);
      if (total < category.floor) continue;
      const who = `${run[0].playerId}|${run[0].name}`;
      const cur = best.get(who);
      if (!cur || total > cur.total) best.set(who, { games: run, total });
    }
    const stretches = [...best.values()].sort((a, b) => b.total - a.total).slice(0, perCategory);
    return { category, stretches };
  });
}

/** Summed line for a stretch — the numbers a columnist would quote. */
function stretchTotals(games: GamePerformance[]): string {
  const sum = (f: (p: GamePerformance) => number) => games.reduce((s, g) => s + f(g), 0);
  const bits: string[] = [];
  const att = sum((g) => g.offense?.passAttempts ?? 0);
  if (att) bits.push(`${sum((g) => g.offense?.passCompletions ?? 0)}/${att}, ${sum((g) => g.offense?.passYards ?? 0)} pass yds, ${sum((g) => g.offense?.passTDs ?? 0)} pass TD, ${sum((g) => g.offense?.passInts ?? 0)} INT`);
  const car = sum((g) => g.offense?.rushAttempts ?? 0);
  if (car) bits.push(`${car} car, ${sum((g) => g.offense?.rushYards ?? 0)} rush yds, ${sum((g) => g.offense?.rushTDs ?? 0)} rush TD`);
  const rec = sum((g) => g.offense?.receptions ?? 0);
  if (rec) bits.push(`${rec} rec, ${sum((g) => g.offense?.receivingYards ?? 0)} rec yds, ${sum((g) => g.offense?.receivingTDs ?? 0)} rec TD`);
  const tkl = sum((g) => (g.defense ? g.defense.tackles + g.defense.assistedTackles : 0));
  const sck = sum((g) => g.defense?.sacks ?? 0);
  const ints = sum((g) => g.defense?.interceptions ?? 0);
  if (tkl || sck || ints) bits.push(`${tkl} tkl, ${sck} sck, ${ints} INT, ${sum((g) => g.defense?.forcedFumbles ?? 0)} FF`);
  const wins = games.filter((g) => g.result?.startsWith('W')).length;
  return `${bits.join(' · ')} — team went ${wins}-${games.length - wins}`;
}

const WORD_NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * Does the question ask about a multi-game stretch? Returns the window size
 * ("best 3-game run" → 3; "best stretch" / "streak" / "in a row" → 5), or
 * null when it doesn't.
 */
export function stretchWindowFor(question: string): number | null {
  const q = question.toLowerCase();
  const m = /\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:game|week|straight)/.exec(q);
  const asksStretch = /stretch|streak|\brun\b|\bruns\b|span|consecutive|in a row|straight games|hot streak/.test(q);
  if (m) {
    const n = WORD_NUMBERS[m[1]] ?? Number(m[1]);
    if (n >= 2 && n <= 10 && (asksStretch || /game/.test(q))) return n;
  }
  return asksStretch ? 5 : null;
}

/** Prompt block: best N-game stretches across the given performances, top entries with their game-by-game lines. */
export function bestStretchesText(perfs: GamePerformance[], window: number): string {
  const boards = bestStretches(perfs, window).filter((b) => b.stretches.length);
  if (!boards.length) return '';
  const blocks = boards.map(({ category, stretches }) => {
    const rows = stretches.map((s, i) => {
      const g0 = s.games[0];
      const gN = s.games[s.games.length - 1];
      const head = `${i + 1}. ${g0.name} (${g0.position}, ${g0.team}) ${g0.seasonYear}, Wk ${g0.week}–Wk ${gN.week}: ${stretchTotals(s.games)}`;
      // Game-by-game detail for the top three of each board — enough to narrate.
      return i < 3 ? `${head}\n${s.games.map((g) => `     ${perfLine(g)}`).join('\n')}` : head;
    });
    return `${category.label}:\n${rows.join('\n')}`;
  });
  return `\n\nBEST ${window}-GAME STRETCHES (COMPUTED over EVERY logged game in the archive — complete, not a sample. A stretch = ${window} consecutive games of the player's team in one season, all of which he played; a missed game breaks it. Each player appears once per board, at his best window):\n${blocks.join('\n\n')}`;
}

/**
 * Big-game counts — "most 300-yard games", "100-yard rushing games" — per
 * player-season and per career, computed over every logged game.
 */
export function bigGameCountsText(perfs: GamePerformance[], perList = 6): string {
  const tests: { label: string; hit: (p: GamePerformance) => boolean }[] = [
    { label: '300-YARD PASSING GAMES', hit: (p) => (p.offense?.passYards ?? 0) >= 300 },
    { label: '100-YARD RUSHING GAMES', hit: (p) => (p.offense?.rushYards ?? 0) >= 100 },
    { label: '100-YARD RECEIVING GAMES', hit: (p) => (p.offense?.receivingYards ?? 0) >= 100 },
    { label: '3+ TOUCHDOWN GAMES (any kind)', hit: (p) => totalTDs(p) >= 3 },
    { label: 'MULTI-SACK GAMES', hit: (p) => (p.defense?.sacks ?? 0) >= 2 },
  ];
  const blocks = tests.map(({ label, hit }) => {
    const season = new Map<string, number>();
    const career = new Map<string, { n: number; team: Set<string>; years: Set<number> }>();
    for (const p of perfs) {
      if (!hit(p)) continue;
      const sk = `${p.name} (${p.position}, ${p.team}) ${p.seasonYear}`;
      season.set(sk, (season.get(sk) ?? 0) + 1);
      const ck = `${p.name}|${p.position}`;
      const c = career.get(ck) ?? { n: 0, team: new Set<string>(), years: new Set<number>() };
      c.n += 1;
      c.team.add(p.team);
      c.years.add(p.seasonYear);
      career.set(ck, c);
    }
    if (!season.size) return '';
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, perList);
    const careerTop = [...career.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, perList);
    return `${label} — single season: ${top(season).map(([k, n]) => `${k}: ${n}`).join('; ')} | dynasty career: ${careerTop
      .map(([k, c]) => `${k.split('|')[0]} (${[...c.team].join('/')}, ${Math.min(...c.years)}-${Math.max(...c.years)}): ${c.n}`)
      .join('; ')}`;
  });
  const body = blocks.filter(Boolean).join('\n');
  return body ? `\n\nBIG-GAME COUNTS (COMPUTED over EVERY logged game — complete):\n${body}` : '';
}
