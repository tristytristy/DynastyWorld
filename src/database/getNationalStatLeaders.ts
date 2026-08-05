import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getAllLeaguePlayers } from './getLeagueRoster';
import type { DefensiveStatLine, NationalLeaderEntry, NationalStatLeaders, OffensiveStatLine } from '../shared/types';

const TOP_N = 100;

/**
 * National player-stat leaderboards for the NCAA Hub Statistics page and the
 * Overview panel.
 *
 * EACH LIST IS THE UNION OF THE TOP TOP_N BY EVERY STAT ITS TABLE CAN SORT BY,
 * not the top TOP_N by one headline stat. That distinction was a real and badly
 * wrong bug (user-reported 2026-08-04, measured against the game's own leaders):
 * the defensive list used to be the top 100 by TACKLES alone, and the UI then
 * re-sorted that same 100 to answer "who leads in sacks" and "who leads in
 * interceptions". Since the pass rushers who lead the country in sacks do not
 * accumulate tackles, they were never in the pool at all — the entire defensive
 * line was invisible.
 *
 * How wrong, on a real 2026 league of 3,724 defenders (the pool was 100 of
 * them, 2.7%):
 *
 *   sacks         app said 5.5   truth 23    (Clev Lubin, RE — not in the pool)
 *   TFL           app said 14    truth 42
 *   interceptions app said 4     truth 8
 *   forced fum.   app said 4     truth 5
 *
 * Only tackles — the stat the list was sorted by — was right.
 *
 * Ordered by each category's primary stat as before, so a caller that takes the
 * order as given still gets a correct primary leaderboard; callers that re-sort
 * now have the real leaders present to find.
 *
 * NOT unioned on rate stats (completion %, yards per carry). A rate over a tiny
 * sample tops any leaderboard — 1-for-1 passing is 100% — so they need a
 * qualifying threshold rather than inclusion here. A genuine rate leader with
 * real volume is already in the pool via attempts and yards.
 */
export function getNationalStatLeaders(dynastyId: string, seasonId?: number): NationalStatLeaders | null {
  const players = getAllLeaguePlayers(dynastyId, seasonId);
  if (!players) return null;

  const withStat = players.filter(
    (p) => p.seasonStat?.season != null && p.teamIndex !== FCS_POOL_TEAM_INDEX,
  );

  const toEntry = (p: (typeof withStat)[number]): NationalLeaderEntry => {
    const stat = p.seasonStat!;
    return {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      schoolYear: p.schoolYear,
      portraitAssetName: p.portraitAssetName,
      teamName: p.teamDisplayName,
      teamIndex: p.teamIndex,
      offense: stat.category === 'offense' ? (stat.season as OffensiveStatLine) : null,
      defense: stat.category === 'defense' ? (stat.season as DefensiveStatLine) : null,
    };
  };

  const offense = withStat.filter((p) => p.seasonStat!.category === 'offense').map(toEntry);
  const defense = withStat.filter((p) => p.seasonStat!.category === 'defense').map(toEntry);

  /**
   * The top TOP_N by each stat, merged and de-duplicated, then ordered by the
   * FIRST stat given — which is the category's headline and the order callers
   * that don't re-sort will render.
   */
  const topByAny = (
    list: NationalLeaderEntry[],
    stats: ((entry: NationalLeaderEntry) => number)[],
  ): NationalLeaderEntry[] => {
    const kept = new Map<number, NationalLeaderEntry>();
    for (const value of stats) {
      const ranked = list
        .filter((entry) => value(entry) > 0)
        .sort((a, b) => value(b) - value(a))
        .slice(0, TOP_N);
      for (const entry of ranked) kept.set(entry.playerId, entry);
    }
    const primary = stats[0];
    return [...kept.values()].sort((a, b) => primary(b) - primary(a));
  };

  const off = (pick: (line: OffensiveStatLine) => number) => (entry: NationalLeaderEntry) =>
    entry.offense ? pick(entry.offense) : 0;
  const def = (pick: (line: DefensiveStatLine) => number) => (entry: NationalLeaderEntry) =>
    entry.defense ? pick(entry.defense) : 0;

  return {
    // Column sets mirror lib/statColumns.ts — every sortable counting stat.
    passing: topByAny(offense, [
      off((l) => l.passYards),
      off((l) => l.passTDs),
      off((l) => l.passCompletions),
      off((l) => l.passAttempts),
      off((l) => l.passInts),
      off((l) => l.passLongest),
    ]),
    rushing: topByAny(offense, [
      off((l) => l.rushYards),
      off((l) => l.rushTDs),
      off((l) => l.rushAttempts),
      off((l) => l.rushLongest),
    ]),
    receiving: topByAny(offense, [
      off((l) => l.receivingYards),
      off((l) => l.receivingTDs),
      off((l) => l.receptions),
      off((l) => l.receivingLongest),
    ]),
    defense: topByAny(defense, [
      def((l) => l.tackles),
      def((l) => l.sacks),
      def((l) => l.tacklesForLoss),
      def((l) => l.interceptions),
      def((l) => l.passDeflections),
      def((l) => l.forcedFumbles),
      def((l) => l.fumbleRecoveries),
      def((l) => l.assistedTackles),
      def((l) => l.interceptionReturnYards),
    ]),
  };
}
