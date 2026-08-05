/**
 * Season-page derivations: splits, signature results and the season timeline.
 *
 * Two rules run through all of it.
 *
 * 1. A SPLIT IS ONLY RENDERED WHEN IT HAS A DENOMINATOR. "Rivalry 0-0" on a
 *    schedule with no rivalry games is noise pretending to be information, so
 *    these builders drop empty buckets rather than returning zeroes.
 *
 * 2. RANK-AT-THE-TIME IS ONLY USED WHEN IT WAS CAPTURED AT THE TIME.
 *    `opponentCurrentRank` holds the opponent's rank TODAY unless
 *    `opponentContextCaptured` is true, so anything that claims "beat the #3
 *    team" checks that flag first and otherwise says nothing about rank.
 */
import type { ScheduleGame, ScheduleOverview } from '../../../shared/types';

export type PlayedGame = ScheduleGame & { teamScore: number; opponentScore: number };

export function played(schedule: ScheduleOverview | null): PlayedGame[] {
  return (schedule?.games ?? [])
    .filter((g): g is PlayedGame => g.teamScore !== null && g.opponentScore !== null)
    .sort((a, b) => a.week - b.week);
}

export const margin = (g: PlayedGame) => g.teamScore - g.opponentScore;
export const isWin = (g: PlayedGame) => g.teamScore > g.opponentScore;

/**
 * The poll's placeholder for a generic FCS-pool opponent. Real placings run
 * 1–138; 0 means the poll hadn't been released.
 */
const FCS_RANK_PLACEHOLDER = 255;

/** How deep "ranked" goes. The poll itself is far deeper — see rankedOpponent. */
export const POLL_DEPTH = 25;

/** The opponent's poll position, but only when it was actually recorded around kickoff. */
export function capturedRank(g: ScheduleGame): number | null {
  if (!g.opponentContextCaptured) return null;
  const rank = g.opponentCurrentRank;
  if (!rank || rank <= 0 || rank === FCS_RANK_PLACEHOLDER) return null;
  return rank;
}

/**
 * A genuinely RANKED opponent — top 25.
 *
 * This distinction is not pedantic: the save's polls place ALL 138 FBS teams,
 * so "has a poll position" is true of almost every opponent on a schedule. A
 * 16-game season read "vs Ranked 15-0" before this gate, which is nonsense —
 * it was counting wins over the country's 90th-best team as ranked wins. Every
 * claim that uses the word "ranked" goes through here.
 */
export function rankedOpponent(g: ScheduleGame): number | null {
  const rank = capturedRank(g);
  return rank !== null && rank <= POLL_DEPTH ? rank : null;
}

export type Split = { key: string; label: string; wins: number; losses: number };

/** Every split with at least one game behind it, in a fixed order. */
export function buildSplits(schedule: ScheduleOverview | null): Split[] {
  const games = played(schedule);
  if (games.length === 0) return [];

  const bucket = (key: string, label: string, test: (g: PlayedGame) => boolean): Split | null => {
    const subset = games.filter(test);
    if (subset.length === 0) return null;
    const wins = subset.filter(isWin).length;
    return { key, label, wins, losses: subset.length - wins };
  };

  return [
    bucket('home', 'Home', (g) => g.isHome),
    bucket('away', 'Away', (g) => !g.isHome),
    bucket('conference', 'Conference', (g) => g.gameType === 'conference'),
    bucket('nonconference', 'Non-conference', (g) => g.gameType === 'non-conference'),
    bucket('rivalry', 'Rivalry', (g) => g.isRivalryGame),
    // Top-25 only, and only on a rank recorded at kickoff — see rankedOpponent.
    bucket('ranked', 'vs Top 25', (g) => rankedOpponent(g) !== null),
    bucket('onescore', 'One-score games', (g) => Math.abs(margin(g)) <= 8),
    bucket('blowout', 'Decided by 14+', (g) => Math.abs(margin(g)) >= 14),
    bucket('postseason', 'Bowl / Playoff', (g) => g.gameType === 'bowl'),
  ].filter((s): s is Split => s !== null);
}

export type Signature = {
  key: string;
  label: string;
  game: PlayedGame;
  /** Present only when the headline genuinely rests on a captured rank. */
  rank: number | null;
};

/**
 * The season's four notable games. Each entry names the basis it was chosen on,
 * so a "best win" picked by margin never reads as one picked by opponent rank.
 */
export function buildSignatures(schedule: ScheduleOverview | null): Signature[] {
  const games = played(schedule);
  if (games.length === 0) return [];
  const wins = games.filter(isWin);
  const losses = games.filter((g) => !isWin(g));
  const out: Signature[] = [];

  if (wins.length) {
    const ranked = wins.filter((g) => rankedOpponent(g) !== null);
    if (ranked.length) {
      const pick = ranked.reduce((best, g) => (rankedOpponent(g)! < rankedOpponent(best)! ? g : best));
      out.push({ key: 'bestwin', label: `Best win — vs #${rankedOpponent(pick)}`, game: pick, rank: rankedOpponent(pick) });
    }
    const widest = wins.reduce((best, g) => (margin(g) > margin(best) ? g : best));
    // Only add the margin-based entry when it isn't already the rank-based one.
    if (!out.some((s) => s.game.gameId === widest.gameId)) {
      out.push({ key: 'largest', label: 'Largest margin', game: widest, rank: null });
    }
  }

  if (losses.length) {
    const ranked = losses.filter((g) => rankedOpponent(g) !== null);
    const pick = ranked.length
      ? ranked.reduce((best, g) => (rankedOpponent(g)! < rankedOpponent(best)! ? g : best))
      : losses.reduce((worst, g) => (margin(g) < margin(worst) ? g : worst));
    out.push({
      key: 'loss',
      label: ranked.length ? `Toughest loss — vs #${rankedOpponent(pick)}` : 'Heaviest defeat',
      game: pick,
      rank: ranked.length ? rankedOpponent(pick) : null,
    });
  }

  const closest = games.reduce((best, g) => (Math.abs(margin(g)) < Math.abs(margin(best)) ? g : best));
  if (!out.some((s) => s.game.gameId === closest.gameId)) {
    out.push({ key: 'closest', label: 'Closest game', game: closest, rank: null });
  }

  return out;
}

export type TimelineEvent = {
  /** Stable across renders and sorts — week plus kind, never an array index. */
  id: string;
  week: number;
  label: string;
  detail: string;
  gameId: number | null;
};

/**
 * The season's events, built deterministically from played games and sorted once
 * by week. Nothing here is invented to fill the page: every entry is a game that
 * happened or a threshold that was actually crossed.
 */
export function buildTimeline(schedule: ScheduleOverview | null, teamName: string): TimelineEvent[] {
  const games = played(schedule);
  if (games.length === 0) return [];
  const events: TimelineEvent[] = [];

  // Bowl eligibility — the week the sixth win landed, not a season-end summary.
  let runningWins = 0;
  for (const g of games) {
    if (isWin(g)) {
      runningWins += 1;
      if (runningWins === 6) {
        events.push({
          id: `w${g.week}-eligible`,
          week: g.week,
          label: 'Bowl eligible',
          detail: `Sixth win of the season, ${g.isHome ? 'vs' : 'at'} ${g.opponent}.`,
          gameId: g.gameId,
        });
      }
    }
  }

  for (const g of games) {
    const rank = rankedOpponent(g);
    const score = `${g.teamScore}-${g.opponentScore}`;

    if (g.isRivalryGame) {
      events.push({
        id: `w${g.week}-rivalry`,
        week: g.week,
        label: isWin(g) ? 'Rivalry win' : 'Rivalry loss',
        detail: `${g.rivalryName ?? 'Rivalry'} — ${score} ${g.isHome ? 'vs' : 'at'} ${g.opponent}.`,
        gameId: g.gameId,
      });
    }

    if (rank !== null && rank <= 10 && isWin(g)) {
      events.push({
        id: `w${g.week}-signature`,
        week: g.week,
        label: 'Signature win',
        detail: `Beat #${rank} ${g.opponent}, ${score}.`,
        gameId: g.gameId,
      });
    }

    // The title games are labelled as themselves rather than as "a bowl" — the
    // national championship IS gameType 'bowl', so without this the biggest
    // game of a dynasty would appear under whatever sponsor name it carries.
    if (g.isNationalChampionship || g.isConferenceChampionship || g.gameType === 'bowl') {
      const label = g.isNationalChampionship
        ? isWin(g)
          ? 'National champions'
          : 'National championship game'
        : g.isConferenceChampionship
          ? isWin(g)
            ? 'Conference champions'
            : 'Conference championship game'
          : (g.bowlName ?? 'Postseason');
      events.push({
        id: `w${g.week}-postseason`,
        week: g.week,
        label,
        detail: `${isWin(g) ? 'Won' : 'Lost'} ${score} against ${g.opponent}.`,
        gameId: g.gameId,
      });
    }
  }

  const losses = games.filter((g) => !isWin(g)).length;
  const last = games[games.length - 1];
  if (losses === 0 && games.length >= 10) {
    events.push({
      id: `w${last.week}-undefeated`,
      week: last.week,
      label: 'Undefeated',
      detail: `${teamName} finished the season without a loss.`,
      gameId: null,
    });
  }

  return events.sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}

/** What the postseason actually came to, from the bowl games on the schedule. */
export function postseasonSummary(schedule: ScheduleOverview | null): string {
  const bowls = played(schedule).filter((g) => g.gameType === 'bowl');
  if (bowls.length === 0) return schedule?.bowlEligible ? 'Bowl eligible' : 'None';
  const last = bowls[bowls.length - 1];
  if (last.isNationalChampionship) return isWin(last) ? 'National champions' : 'Lost the national championship';
  const name = last.bowlName ?? 'Bowl';
  return `${isWin(last) ? 'Won' : 'Lost'} the ${name}`;
}
