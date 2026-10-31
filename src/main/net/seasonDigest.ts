import { getLeagueScores } from '../../database/getLeagueScores';
import { listAllResolvedMedia } from '../../database/media';
import { getMediaComments } from '../../database/dynastyNet';
import { getSeasonById, getSnapshot } from '../../database/helpers';
import { CFP_ROUND_NAMES } from '../../shared/cfpBowls';
import type { YearSummaryData } from '../../extractors/extract-league-history';

/**
 * THE WHOLE SEASON, FOR THE BOARD (user report, 2026-09-28): an offseason
 * thread asking "best games of 2026 (DynastyTube games only)" got short,
 * interchangeable replies — because the reply prompt only ever saw the
 * CURRENT week. A board that can't remember September can't argue about
 * the season. This digest hands every board prompt the season's notable
 * games and the season's DynastyTube library, so replies can actually rank,
 * compare, and cite.
 */

/** Notable games across the whole season, week order — the season's argument material. */
export function seasonLedger(dynastyId: string, seasonId: number, userTeam = ''): string {
  const games = (getLeagueScores(dynastyId, seasonId)?.games ?? []).filter(
    (g) => g.homeScore !== null && g.awayScore !== null,
  );
  if (!games.length) return '';
  const lines: { week: number; weight: number; line: string }[] = [];
  for (const g of games) {
    const home = g.homeScore as number;
    const away = g.awayScore as number;
    const homeWon = home > away;
    const winnerRank = homeWon ? g.homeRank : g.awayRank;
    const loserRank = homeWon ? g.awayRank : g.homeRank;
    const margin = Math.abs(home - away);
    const tags: string[] = [];
    let weight = 0;
    if (g.isNationalChampionship) {
      tags.push('NATIONAL CHAMPIONSHIP');
      weight += 100;
    } else if (CFP_ROUND_NAMES.has(g.bowlName ?? '')) {
      tags.push(g.bowlName as string);
      weight += 80;
    } else if (g.weekType === 'ConferenceChampionship') {
      tags.push('conference championship');
      weight += 50;
    } else if (g.bowlName) {
      tags.push(g.bowlName);
      weight += 25;
    }
    if (winnerRank !== null && loserRank !== null) {
      tags.push('ranked showdown');
      weight += 25;
    }
    if (loserRank !== null && (winnerRank === null || winnerRank > loserRank)) {
      tags.push(winnerRank === null ? 'UPSET by unranked' : 'upset');
      weight += 30;
    }
    if (margin <= 3) {
      tags.push('one-possession thriller');
      weight += 20;
    } else if (margin <= 7) {
      tags.push('one-score game');
      weight += 8;
    }
    if (home + away >= 80) {
      tags.push('shootout');
      weight += 12;
    }
    if (margin >= 35 && (winnerRank !== null || loserRank !== null)) {
      tags.push('blowout');
      weight += 6;
    }
    if (userTeam && (g.homeTeamName === userTeam || g.awayTeamName === userTeam)) weight += 15;
    if (weight === 0) continue;
    const r = (rank: number | null) => (rank ? `#${rank} ` : '');
    lines.push({
      week: g.week,
      weight,
      line: `Wk ${g.week}: ${r(g.awayRank)}${g.awayTeamName} ${away} @ ${r(g.homeRank)}${g.homeTeamName} ${home}${tags.length ? ` — ${tags.join(', ')}` : ''}`,
    });
  }
  // Keep the loudest 70 but print them in calendar order — a season reads forward.
  const kept = lines.sort((a, b) => b.weight - a.weight).slice(0, 70);
  kept.sort((a, b) => a.week - b.week);

  const season = getSeasonById(seasonId);
  const summary = getSnapshot<YearSummaryData>(seasonId, 'yearSummary');
  const champ = summary?.nationalChampion;
  const champLine = champ
    ? `\nNATIONAL CHAMPION: ${champ.teamName} (${champ.wins}-${champ.losses})${summary?.runnerUp ? ` over ${summary.runnerUp.teamName} ${champ.score}-${summary.runnerUp.score}` : ''}`
    : '';
  return `\n\nTHE ${season?.seasonYear ?? ''} SEASON LEDGER (every notable result this season, week order — use it to compare, rank, and remember):\n${kept.map((l) => l.line).join('\n')}${champLine}`;
}

/**
 * The season's DynastyTube uploads — what the board has WATCHED. Each line
 * carries the id for a [tube:ID] citation, the title and uploader notes, the
 * tagged game/players/plays, and the comment section's top comment (what
 * the internet already said about it).
 */
export function seasonTubeLibrary(dynastyId: string, seasonId: number): { text: string; ids: Set<number> } {
  const items = listAllResolvedMedia(dynastyId)
    .filter((m) => m.seasonId === seasonId)
    .slice(0, 60);
  const ids = new Set(items.map((m) => m.id));
  if (!items.length) return { text: '\n\nDYNASTYTUBE THIS SEASON: no uploads yet.', ids };
  const lines = items.map((m) => {
    const players = m.taggedPlayers.map((p) => `${p.firstName} ${p.lastName}`).join(', ');
    const plays = (m.plays ?? [])
      .slice(0, 5)
      .map(
        (p) =>
          `${p.teamName ?? ''} ${p.playType}${p.scorerNames?.length ? ` by ${p.scorerNames.join(' to ')}` : ''} Q${p.quarter} (${p.awayScore}-${p.homeScore} after)`.trim(),
      )
      .join('; ');
    const top = getMediaComments(dynastyId, m.id).sort((a, b) => b.likes - a.likes)[0];
    const title = m.tubeTitle || m.description || m.fileName;
    return `[tube:${m.id}] "${title}"${m.gameLabel ? ` — game: ${m.gameLabel}` : ''}${m.tubeTitle && m.description ? ` — uploader notes: ${m.description.slice(0, 220)}` : ''}${players ? ` — players: ${players}` : ''}${plays ? ` — plays shown: ${plays}` : ''}${top ? ` — top comment: "${top.body.slice(0, 140)}"` : ''}`;
  });
  return {
    text: `\n\nDYNASTYTUBE THIS SEASON (uploads the board has watched; when a comment discusses one, you may put [tube:ID] right after that sentence to link it — only ids listed here):\n${lines.join('\n')}`,
    ids,
  };
}

/** Where the calendar is — so an offseason thread doesn't get week-12 energy. */
export function seasonPhaseNote(seasonId: number): string {
  const season = getSeasonById(seasonId);
  if (!season) return '';
  if (season.syncedWeekType === 'OffSeason' || (season.syncedOffseasonStage ?? 0) > 0 || season.finalized) {
    return `\n\nCALENDAR: the ${season.seasonYear} season is OVER — this is the offseason. Talk about the season as a finished whole (retrospectives, rankings, what it meant, next year), not as if games are still coming.`;
  }
  if (season.syncedWeekType && /Bowl|NationalChampionship|ConferenceChampionship/i.test(season.syncedWeekType)) {
    return `\n\nCALENDAR: ${season.seasonYear} postseason.`;
  }
  return '';
}

/** Drop [tube:ID] markers that point at uploads we never offered — the model doesn't get to invent footage. */
export function sanitizeTubeCitations(body: string, allowed: Set<number>): string {
  return body.replace(/\s?\[tube:(\d+)\]/g, (whole, id: string) => (allowed.has(Number(id)) ? whole : ''));
}
