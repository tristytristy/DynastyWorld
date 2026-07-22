import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReferenceWithTable,
  type OpenFranchise,
} from './lib/franchise';
import { AWARD_DISPLAY_ORDER } from '../shared/awardOrder';

/**
 * One of the ~22 leaguewide "single winner" season awards (Heisman, Best QB,
 * etc.) — sourced from `PlayerAward` (Period="Season", one confirmed row per
 * type leaguewide, verified directly before relying on it), specifically so
 * a real resolved `playerId` is available for the player-profile-modal
 * click-through. The two coach awards (`BEST_HC`/`BEST_AC`, no player to
 * link to at all) come from a separate, year-scoped source — see
 * extract-league-history.ts's doc comment for why the flat
 * `LeagueHistoryAward` table this used to read directly is unsafe for a
 * multi-season save (extract-all.ts merges the current year's coach awards
 * in from there instead).
 */
export interface LeagueAwardData {
  awardType: string;
  playerId: number | null;
  firstName: string;
  lastName: string;
  teamDisplayName: string;
  position: string;
}

/**
 * The user's own team's weekly Player-of-the-Week ledger. Season-level
 * marquee wins are already covered by `LeagueAwardData`; All-American/
 * Conference tiers come from `LeagueAllAmericanData` instead — this is
 * deliberately weekly-only.
 */
export interface PlayerAwardData {
  playerId: number;
  awardType: string;
  /** The week the honor was earned (PeriodIndex). */
  week: number;
}

/**
 * One Heisman Trophy race entry — `rank === 0` is the actual winner (also
 * present in `LeagueAwardData` under `HEISMAN`; kept here too since the
 * ranking table is the only source for the finalists behind them).
 */
export interface HeismanRankingData {
  rank: number;
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  teamDisplayName: string;
}

/**
 * A leaguewide All-American/All-Conference selection — unlike
 * `PlayerAwardData`, NOT scoped to the user's team, since browsing the full
 * honors roster (every conference, every team) was explicitly requested.
 * Self-contained (name/position/team/conference all resolved here) rather
 * than joined against a roster snapshot at query time, since only the
 * user's own team's roster is ever persisted.
 */
export interface LeagueAllAmericanData {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  teamDisplayName: string;
  conferenceName: string | null;
  /** One of the 10 real `ALL_AM_*` variants — see awardFormat.ts's formatAllAmerican. */
  awardType: string;
}

export interface AwardsData {
  leagueAwards: LeagueAwardData[];
  weeklyHonors: PlayerAwardData[];
  heismanRanking: HeismanRankingData[];
  leagueAllAmericans: LeagueAllAmericanData[];
}

/** Reads the up-to-5-slot Heisman ranking array off the singleton `Awards` record — rank 0 is the winner, the rest are finalists. */
async function extractHeismanRanking(franchise: OpenFranchise): Promise<HeismanRankingData[]> {
  const awardsTable = getLargestTable(franchise, 'Awards');
  await awardsTable.readRecords();
  const awardsRow = nonEmpty(awardsTable.records)[0];
  if (!awardsRow) return [];

  // 'HeismanRanking' resolves to a row in the array table "HeismanAwardRanking[]"
  // (literal brackets in the name — the same gotcha as SeasonStats[]/GameStats[]/
  // Rivalry[] elsewhere in this project), a different table from
  // "HeismanAwardRanking" (the per-candidate record itself). Both need preloading.
  await Promise.all([
    preloadAllInstances(franchise, 'HeismanAwardRanking[]'),
    preloadAllInstances(franchise, 'HeismanAwardRanking'),
  ]);

  const rankingRow = resolveReferenceWithTable(franchise, awardsRow, 'HeismanRanking');
  if (!rankingRow) return [];

  const results: HeismanRankingData[] = [];
  for (const slotKey of Object.keys(rankingRow.record.fields)) {
    const slot = resolveReferenceWithTable(franchise, rankingRow.record, slotKey);
    if (!slot) continue;
    const player = resolveReferenceWithTable(franchise, slot.record, 'Player');
    const team = resolveReferenceWithTable(franchise, slot.record, 'Team');
    if (!player || !team) continue;
    results.push({
      rank: Number(slot.record.CurrentRank),
      playerId: Number(player.record.PresentationId),
      firstName: String(player.record.FirstName),
      lastName: String(player.record.LastName),
      position: String(player.record.Position),
      teamDisplayName: String(team.record.DisplayName),
    });
  }
  return results.sort((a, b) => a.rank - b.rank);
}

function isAllAmericanType(awardType: string): boolean {
  return awardType.startsWith('ALL_AM_');
}

const MARQUEE_PLAYER_TYPES = new Set(AWARD_DISPLAY_ORDER.filter((type) => type !== 'BEST_HC' && type !== 'BEST_AC'));

/**
 * @param currentSeasonIndex `league.seasonYear - league.baseCalendarYear` — the
 *   0-based index of the season being synced. Season-period awards (marquee +
 *   All-American) accumulate in `PlayerAward` across seasons, one row per award
 *   per year keyed by `PeriodIndex` = that season index (confirmed against a
 *   3-completed-year save — the John Mackey Award had rows at PeriodIndex 0/1/2,
 *   one per year). Reading the whole table unscoped stamped EVERY year still in
 *   the table onto the season being synced, so the same award showed multiple
 *   winners and a player's freshman honors reappeared every later year. Scoping
 *   to `currentSeasonIndex` fixes that: each sync captures only its own year,
 *   producing a clean per-year snapshot no matter how much stale data the table
 *   holds at sync time. Because the game PRUNES older years' award detail from
 *   the table over time (verified: a season whose live snapshot held ~1,500
 *   All-Americans was down to ~500 rows two years later), a past year canNOT be
 *   faithfully re-derived from a later save — the only complete capture is the
 *   sync taken while that season is current, which this scoping guarantees.
 *   Since a year's postseason rows are only written when that season actually
 *   finishes, scoping also stops awards from appearing before they're handed
 *   out in-game (preseason `_PRE` watch-list rows are filtered separately at
 *   display time — see getAwards.ts). Same year-scoping fix
 *   extract-league-history.ts already applied to the flat LeagueHistoryAward
 *   table for the coach awards.
 */
export async function extractAwards(
  franchise: OpenFranchise,
  userTeamIndex: number,
  currentSeasonIndex: number,
): Promise<AwardsData> {
  const playerAwardTable = getLargestTable(franchise, 'PlayerAward');
  await playerAwardTable.readRecords();
  await preloadAllInstances(franchise, 'Player');
  await preloadAllInstances(franchise, 'Team');
  await preloadAllInstances(franchise, 'Conference');

  const leagueAwards: LeagueAwardData[] = [];
  const weeklyHonors: PlayerAwardData[] = [];
  const leagueAllAmericans: LeagueAllAmericanData[] = [];

  for (const r of nonEmpty(playerAwardTable.records)) {
    const awardType = String(r.AwardType);
    const team = resolveReferenceWithTable(franchise, r, 'Team');
    if (!team) continue;

    // Season-period rows are the accumulating per-year award history (marquee +
    // All-American, both confirmed Season-only). Scope to the season being
    // synced so past years' winners never leak into this season's snapshot.
    if (String(r.Period) === 'Season') {
      if (Number(r.PeriodIndex) !== currentSeasonIndex) continue;

      if (isAllAmericanType(awardType)) {
        // Leaguewide, not team-scoped — the honors roster browser needs every
        // conference's selections, not just the user's team's. Team-scoped
        // counts are derived from this same list at query time by filtering
        // on teamDisplayName, rather than duplicating entries here.
        const player = resolveReferenceWithTable(franchise, r, 'Player');
        if (!player) continue;
        const conference = resolveReferenceWithTable(franchise, r, 'Conference');
        leagueAllAmericans.push({
          playerId: Number(player.record.PresentationId),
          firstName: String(player.record.FirstName),
          lastName: String(player.record.LastName),
          position: String(player.record.Position),
          teamDisplayName: String(team.record.DisplayName),
          conferenceName: conference ? String(conference.record.Name) : null,
          awardType,
        });
        continue;
      }

      if (MARQUEE_PLAYER_TYPES.has(awardType)) {
        const player = resolveReferenceWithTable(franchise, r, 'Player');
        if (!player) continue;
        leagueAwards.push({
          awardType,
          playerId: Number(player.record.PresentationId),
          firstName: String(player.record.FirstName),
          lastName: String(player.record.LastName),
          teamDisplayName: String(team.record.DisplayName),
          position: String(player.record.Position),
        });
      }
      // Other Season-period awards (Heisman — handled via the ranking table —
      // and BEST_DEF_1, deliberately excluded) are intentionally not surfaced
      // here; never fall through to the weekly ledger below.
      continue;
    }

    // Game-period rows are weekly Player-of-the-Week honors — scoped to the
    // user's own team, same convention as roster/stats/gamelog. (PeriodIndex
    // here is the WEEK, not a season index.)
    if (Number(team.record.TeamIndex) !== userTeamIndex) continue;
    const player = resolveReferenceWithTable(franchise, r, 'Player');
    if (!player) continue;
    weeklyHonors.push({
      playerId: Number(player.record.PresentationId),
      awardType,
      week: Number(r.PeriodIndex),
    });
  }

  const heismanRanking = await extractHeismanRanking(franchise);

  return { leagueAwards, weeklyHonors, heismanRanking, leagueAllAmericans };
}
