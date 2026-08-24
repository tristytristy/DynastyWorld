import { getSeasonsByDynasty, getSnapshot } from '../../database/helpers';
import { getLeagueScores } from '../../database/getLeagueScores';
import { getStandings } from '../../database/getStandings';
import { getNationalStatLeaders } from '../../database/getNationalStatLeaders';
import { listAllResolvedMedia } from '../../database/media';
import { ensureAccounts, insertPosts } from '../../database/dynastyNet';
import { withBatchedPersist } from '../../database/init';
import { generateJson, hasLiveEngine, NetClaudeError } from './claude';
import type { YearSummaryData } from '../../extractors/extract-league-history';
import type { NetGenerateResult } from '../../shared/netTypes';
import type { NationalLeaderEntry } from '../../shared/types';

/**
 * The Historian — free-form questions against the whole archive, answered as
 * an ESPN-style long-form article. This is the feature the record book was
 * originally kept FOR: its owner typed 30 seasons into a document so an AI
 * could be asked "which teams kept reaching the semifinals and never won?" —
 * now the archive is the document, and the Historian reads it directly.
 *
 * THE DYNASTYTUBE RULE (owner-requested, 2026-08-21): when a question touches
 * a team — or the answer ends up discussing one — the Historian checks
 * DynastyTube for that team's tagged uploads and cites the footage inline via
 * [tube:ID] markers, which the renderer turns into "watch on DynastyTube"
 * links. The full media index (game labels + tagged players) rides in the
 * prompt precisely so those citations can only ever point at clips that
 * actually exist; inventing footage is worse than citing none.
 *
 * No offline fallback on purpose: analysis can't be templated, so without an
 * API key the answer is an honest "the Historian needs a live engine".
 */

const HISTORIAN_SYSTEM = `You are The Historian — the senior college football archivist and long-form columnist for one dynasty's private sports network. You answer questions about this dynasty's history the way a great ESPN retrospective reads: authoritative, vivid, specific, with real affection for the material.

RULES:
- Use ONLY the archive data provided. Every score, record, seed, year, and name must come from it. If the archive can't answer part of the question (e.g. seasons that carry no player stats), say so plainly and answer what it CAN support.
- Structure the answer as an article: a strong opening, clear sections or a countdown when the question calls for a ranking, and a closing line worth quoting.
- FOOTAGE CITATIONS: the DYNASTYTUBE INDEX lists every uploaded highlight with its id, description, game, and tagged players. When your article discusses a team, game, or player that has a matching upload, cite it inline by placing the marker [tube:ID] immediately after the sentence it supports. Only cite ids from the index — never invent footage, and don't force a citation where none fits.
- Plain text only otherwise (no markdown headers with #; use short ALL-CAPS section labels or numbered entries instead).

Respond with JSON only:
{"headline": "...", "body": "..."}
The body should be as long as the question deserves — a deep-dive question gets a deep-dive answer.`;

function formatYearSummary(year: number, ys: YearSummaryData | undefined): string[] {
  if (!ys) return [];
  const lines: string[] = [];
  if (ys.nationalChampion) {
    const c = ys.nationalChampion;
    const coach = `${c.coachFirstName} ${c.coachLastName}`.trim();
    const ru = ys.runnerUp ? ` def. ${ys.runnerUp.teamName} (${ys.runnerUp.wins}-${ys.runnerUp.losses})` : '';
    lines.push(`${year} CHAMPION: ${c.teamName} (${c.wins}-${c.losses})${coach ? `, HC ${coach}` : ''}${ru}`);
  }
  if (ys.conferenceChampions.length) {
    lines.push(
      `${year} conf titles: ${ys.conferenceChampions
        .map((c) => `${c.conferenceName}: ${c.winningTeamName} ${c.winningTeamScore}-${c.losingTeamScore} over ${c.losingTeamName}`)
        .join('; ')}`,
    );
  }
  return lines;
}

interface LegacySnapshotShape {
  coach?: {
    name: string | null;
    job: string | null;
    team: string | null;
    seasonRecord: string | null;
    careerRecord: string | null;
    notes: string | null;
  } | null;
  teamStatsOffense?: { columns: string[]; rows: { team: string; rank: number | null; values: string[] }[] } | null;
  teamStatsDefense?: { columns: string[]; rows: { team: string; rank: number | null; values: string[] }[] } | null;
  allTimeCoaches?: Record<string, string>[] | null;
}

function statTableLine(year: number, label: string, table: LegacySnapshotShape['teamStatsOffense']): string | null {
  if (!table || !table.rows.length) return null;
  const rows = table.rows
    .slice(0, 12)
    .map((r) => `${r.team} (${table.columns.map((c, i) => `${c} ${r.values[i] ?? '?'}`).slice(0, 4).join(', ')})`)
    .join('; ');
  return `${year} ${label}: ${rows}`;
}

/**
 * The whole archive, flattened to compact lines the model can argue from.
 * Sections are capped individually so one giant dynasty can't crowd out the
 * others, but within a section EVERY season contributes — cross-season
 * questions ("appearances by school, with years") need the full sweep, not a
 * sample.
 */
function buildArchivePack(dynastyId: string): string {
  const seasons = [...getSeasonsByDynasty(dynastyId)].sort((a, b) => a.seasonYear - b.seasonYear);
  const sections: string[] = [];

  const summaryLines: string[] = [];
  const postseasonLines: string[] = [];
  const standingsLines: string[] = [];
  const statLines: string[] = [];
  const leaderLines: string[] = [];
  const coachLines: string[] = [];
  const noteLines: string[] = [];
  let allTime: Record<string, string>[] | null = null;

  for (const season of seasons) {
    const year = season.seasonYear;
    summaryLines.push(...formatYearSummary(year, getSnapshot<YearSummaryData>(season.id, 'yearSummary')));

    // Postseason + notable games from the league scoreboard (works for synced
    // and record-book seasons alike — both store leagueSchedule snapshots).
    const scores = getLeagueScores(dynastyId, season.id);
    if (scores) {
      for (const g of scores.games) {
        if (g.homeScore === null || g.awayScore === null) continue;
        const isPostseason = g.week >= 16 || g.isBowlGame || g.isNationalChampionship;
        if (!isPostseason) continue;
        const homeWon = g.homeScore > g.awayScore;
        const w = homeWon ? g.homeTeamName : g.awayTeamName;
        const l = homeWon ? g.awayTeamName : g.homeTeamName;
        const wr = homeWon ? g.homeRank : g.awayRank;
        const lr = homeWon ? g.awayRank : g.homeRank;
        const score = homeWon ? `${g.homeScore}-${g.awayScore}` : `${g.awayScore}-${g.homeScore}`;
        const tag = g.isNationalChampionship
          ? 'NATIONAL CHAMPIONSHIP'
          : g.bowlName ?? (g.week === 16 ? 'Conference Championship' : `wk ${g.week}`);
        postseasonLines.push(`${year} ${tag}: ${wr ? `#${wr} ` : ''}${w} def. ${lr ? `#${lr} ` : ''}${l} ${score}`);
      }
    }

    const standings = getStandings(dynastyId, season.id);
    if (standings) {
      for (const group of standings.groups) {
        const rows = group.teams.map((t) => `${t.teamName} ${t.overallWins}-${t.overallLosses}`).join(', ');
        if (rows) standingsLines.push(`${year} ${group.conferenceName}: ${rows}`);
      }
    }

    const legacy = getSnapshot<LegacySnapshotShape>(season.id, 'legacy');
    if (legacy) {
      const off = statTableLine(year, 'TOP OFFENSES', legacy.teamStatsOffense);
      const def = statTableLine(year, 'TOP DEFENSES', legacy.teamStatsDefense);
      if (off) statLines.push(off);
      if (def) statLines.push(def);
      if (legacy.coach?.name) {
        coachLines.push(
          `${year}: ${legacy.coach.name} — ${legacy.coach.job ?? ''} at ${legacy.coach.team ?? '?'}, season ${legacy.coach.seasonRecord ?? '?'}, career ${legacy.coach.careerRecord ?? '?'}`,
        );
      }
      if (legacy.coach?.notes) noteLines.push(`${year} NOTES: ${legacy.coach.notes}`);
      if (legacy.allTimeCoaches?.length) allTime = legacy.allTimeCoaches;
    }

    // Player leaders exist only for save-synced seasons; record-book seasons
    // simply contribute nothing here, and the prompt owns saying so.
    const leaders = getNationalStatLeaders(dynastyId, season.id);
    if (leaders) {
      const fmt = (
        label: string,
        entries: NationalLeaderEntry[],
        line: (e: NationalLeaderEntry) => string,
      ) => {
        const top = entries.slice(0, 5).map((e) => `${e.firstName} ${e.lastName} (${e.position}, ${e.teamName}) ${line(e)}`);
        if (top.length) leaderLines.push(`${year} ${label}: ${top.join('; ')}`);
      };
      fmt('passing', leaders.passing, (e) => (e.offense ? `${e.offense.passYards} yds ${e.offense.passTDs} TD` : ''));
      fmt('rushing', leaders.rushing, (e) => (e.offense ? `${e.offense.rushYards} yds ${e.offense.rushTDs} TD` : ''));
      fmt('receiving', leaders.receiving, (e) =>
        e.offense ? `${e.offense.receptions} rec ${e.offense.receivingYards} yds ${e.offense.receivingTDs} TD` : '',
      );
      fmt('defense', leaders.defense, (e) =>
        e.defense ? `${e.defense.tackles + e.defense.assistedTackles} tkl ${e.defense.sacks} sck ${e.defense.interceptions} INT` : '',
      );
    }
  }

  if (summaryLines.length) sections.push(`CHAMPIONS AND TITLE GAMES:\n${summaryLines.join('\n')}`);
  if (postseasonLines.length) sections.push(`POSTSEASON RESULTS (conference championships, bowls, CFP):\n${postseasonLines.join('\n')}`);
  if (standingsLines.length) sections.push(`FINAL STANDINGS BY CONFERENCE:\n${standingsLines.join('\n')}`);
  if (statLines.length) sections.push(`NATIONAL TEAM STAT LEADERS (from the record book):\n${statLines.join('\n')}`);
  if (leaderLines.length) sections.push(`NATIONAL PLAYER STAT LEADERS:\n${leaderLines.join('\n')}`);
  if (coachLines.length) sections.push(`THE COACH'S OWN JOURNEY:\n${coachLines.join('\n')}`);
  if (noteLines.length) sections.push(`HAND-WRITTEN SEASON NOTES:\n${noteLines.join('\n')}`);
  if (allTime) {
    const rows = allTime.map((r) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', '));
    sections.push(`END-OF-DYNASTY ALL-TIME COACHING TABLE:\n${rows.join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * The film archive, one line per upload — this is what lets an article cite
 * real footage. Ordered oldest first and capped generously; a library big
 * enough to blow the cap deserves its own retrieval pass someday.
 */
function buildTubeIndex(dynastyId: string): string {
  const items = listAllResolvedMedia(dynastyId).slice(0, 300);
  if (!items.length) return 'DYNASTYTUBE INDEX: no uploads yet.';
  const lines = items.map((m) => {
    const players = m.taggedPlayers.map((p) => `${p.firstName} ${p.lastName}`).join(', ');
    const plays = m.plays?.length
      ? ` — shows: ${m.plays
          .slice(0, 3)
          .map((p) => `${p.teamName ?? ''} ${p.playType}${p.scorerNames?.length ? ` by ${p.scorerNames.join(' to ')}` : ''} Q${p.quarter}`.trim())
          .join('; ')}`
      : '';
    return `[tube:${m.id}] ${m.mediaType} "${m.description || m.fileName}"${m.gameLabel ? ` — ${m.gameLabel}` : ''}${players ? ` — players: ${players}` : ''}${plays}`;
  });
  return `DYNASTYTUBE INDEX (cite with [tube:ID] where relevant):\n${lines.join('\n')}`;
}

export async function askHistorian(dynastyId: string, question: string): Promise<NetGenerateResult> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, engine: 'offline', message: 'Ask a question first.', postsAdded: 0 };
  if (!hasLiveEngine()) {
    return {
      ok: false,
      engine: 'offline',
      message: 'The Historian needs a live engine — add your Claude API key on the Feed page and ask again.',
      postsAdded: 0,
    };
  }

  const seasons = getSeasonsByDynasty(dynastyId);
  if (!seasons.length) {
    return { ok: false, engine: 'offline', message: 'No seasons in this dynasty yet — nothing to research.', postsAdded: 0 };
  }

  const pack = buildArchivePack(dynastyId);
  const tube = buildTubeIndex(dynastyId);

  try {
    const out = await generateJson<{ headline: string; body: string }>(
      HISTORIAN_SYSTEM,
      `QUESTION FROM THE OWNER OF THIS DYNASTY:\n${trimmed}\n\n${tube}\n\nTHE ARCHIVE:\n${pack}`,
      9000,
    );
    if (!out.headline || !out.body) throw new NetClaudeError('Malformed article.');
    // Cross-season answers hang off the newest season row purely because the
    // posts table requires one; getHistorianArticles reads dynasty-wide.
    const newest = [...seasons].sort((a, b) => b.seasonYear - a.seasonYear)[0];
    withBatchedPersist(() => {
      const [historian] = ensureAccounts(dynastyId, [
        {
          handle: '@TheHistorian',
          displayName: 'The Historian',
          kind: 'paper',
          persona: 'Senior archivist; writes long-form retrospectives on demand.',
        },
      ]);
      insertPosts(dynastyId, [
        { seasonId: newest.id, accountId: historian.id, kind: 'historian', title: out.headline, body: out.body, week: 0 },
      ]);
    });
    return { ok: true, engine: 'claude', postsAdded: 1 };
  } catch (err) {
    const message = err instanceof NetClaudeError ? err.message : err instanceof Error ? err.message : String(err);
    return { ok: false, engine: 'offline', message: `The Historian hit a snag: ${message}`, postsAdded: 0 };
  }
}
