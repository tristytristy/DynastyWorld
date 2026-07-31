import { getSeasonsByDynasty } from './helpers';
import { getSchedule } from './getSchedule';
import type { HeadToHeadGame, HeadToHeadOpponent } from '../shared/types';
import { isFcsPool } from '../shared/fcsPool';

interface Bucket {
  opponentTeamIndex: number | null;
  opponentName: string;
  isRival: boolean;
  rivalryName: string | null;
  games: HeadToHeadGame[];
}

/**
 * The program's all-time series record vs every opponent it has actually
 * played across the synced seasons — the payoff of keeping per-season schedule
 * history. Aggregates the user's PLAYED games (from getSchedule, already mapped
 * to the user's perspective with result + scores) by opponent, computing the
 * series record, current streak, average scoring margin, and the full
 * game-by-game list (newest first). The game's own designated rivals are
 * flagged. Needs 1+ synced season with played games; richer with more.
 */
export function getHeadToHead(dynastyId: string): HeadToHeadOpponent[] {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  const buckets = new Map<string, Bucket>();

  for (const season of seasons) {
    const schedule = getSchedule(dynastyId, season.id);
    if (!schedule) continue;
    for (const g of schedule.games) {
      if (!g.result || g.teamScore === null || g.opponentScore === null) continue; // played games only
      // Every FCS opponent shares index 255, so bucketing by index merged games
      // against FCS West, Southeast and Midwest into ONE series row labelled
      // after whichever was seen last — a record for a team that doesn't exist.
      // The games still count in your season record; they just don't get a
      // head-to-head series of their own. See shared/fcsPool.ts.
      if (isFcsPool(g.opponentTeamIndex)) continue;
      const key = g.opponentTeamIndex !== null ? `i${g.opponentTeamIndex}` : `n:${g.opponent}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { opponentTeamIndex: g.opponentTeamIndex, opponentName: g.opponent, isRival: false, rivalryName: null, games: [] };
        buckets.set(key, bucket);
      }
      bucket.opponentName = g.opponent; // keep the most recently seen name
      if (g.isRivalryGame) bucket.isRival = true;
      if (g.rivalryName) bucket.rivalryName = g.rivalryName;
      bucket.games.push({
        seasonYear: season.seasonYear,
        week: g.week,
        isHome: g.isHome,
        neutral: g.siteType === 'neutral',
        result: g.result,
        teamScore: g.teamScore,
        opponentScore: g.opponentScore,
        bowlName: g.bowlName,
      });
    }
  }

  const out: HeadToHeadOpponent[] = [...buckets.values()].map((b) => {
    b.games.sort((a, c) => c.seasonYear - a.seasonYear || c.week - a.week);
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let marginSum = 0;
    for (const g of b.games) {
      if (g.result === 'W') wins++;
      else if (g.result === 'L') losses++;
      else ties++;
      marginSum += g.teamScore - g.opponentScore;
    }
    const streakType = b.games[0]?.result ?? null;
    let streakCount = 0;
    for (const g of b.games) {
      if (g.result === streakType) streakCount++;
      else break;
    }
    return {
      opponentTeamIndex: b.opponentTeamIndex,
      opponentName: b.opponentName,
      isRival: b.isRival,
      rivalryName: b.rivalryName,
      wins,
      losses,
      ties,
      avgMargin: b.games.length ? marginSum / b.games.length : 0,
      streakType,
      streakCount,
      games: b.games,
    };
  });

  // Rivals first, then most-played, then alphabetical.
  out.sort(
    (a, b) =>
      Number(b.isRival) - Number(a.isRival) ||
      b.wins + b.losses + b.ties - (a.wins + a.losses + a.ties) ||
      a.opponentName.localeCompare(b.opponentName),
  );
  return out;
}
