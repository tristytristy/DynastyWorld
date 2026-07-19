import { getLargestTable, nonEmpty, preloadAllInstances, resolveReferenceWithTable, type OpenFranchise } from './lib/franchise';
import { mapPlayer, type RosterPlayerData } from './extract-roster';
import { categoryFromTableName, mapLineForCategory, type PlayerStatsData } from './extract-stats';

/**
 * League-wide roster + season stats — every player on every team, not just
 * the user's. Measured on a real save before building (house rule): the full
 * 16,255-player bio read is ~65ms and the stat-table preloads ~290ms, so
 * this rides along with every sync for well under a second. The payloads are
 * stored gzipped (saveSnapshotCompressed) because sql.js holds the whole
 * database in memory — raw JSON at this scale would compound badly across a
 * long dynasty.
 *
 * Per-season league snapshots are also what make a transferring player's
 * past viewable: each season's snapshot has them on whichever team they were
 * actually on that year.
 */
export interface LeagueRosterEntry extends RosterPlayerData {
  teamIndex: number;
}

export interface LeagueSeasonStat {
  playerId: number;
  category: PlayerStatsData['category'];
  season: PlayerStatsData['season'];
}

export interface LeagueRosterData {
  players: LeagueRosterEntry[];
  /** Season stat lines for players who have a slot matching the synced season — stat-holders only, to keep the payload lean. */
  stats: LeagueSeasonStat[];
}

export async function extractLeagueRoster(
  franchise: OpenFranchise,
  expectedRelativeYear: number,
): Promise<LeagueRosterData> {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords();

  await Promise.all(
    [
      'SeasonStats[]',
      'CareerOffensiveStats',
      'CareerDefensiveStats',
      'SeasonOffensiveStats',
      'SeasonDefensiveStats',
      'CareerOffensiveKPReturnStats',
      'CareerDefensiveKPReturnStats',
      'SeasonOffensiveKPReturnStats',
      'SeasonDefensiveKPReturnStats',
    ].map((name) => preloadAllInstances(franchise, name)),
  );

  const players: LeagueRosterEntry[] = [];
  const stats: LeagueSeasonStat[] = [];

  for (const record of nonEmpty(playerTable.records)) {
    if (!String(record.LastName ?? '').trim()) continue;
    const teamIndex = Number(record.TeamIndex);
    players.push({ ...mapPlayer(record), teamIndex });

    const careerResolved = resolveReferenceWithTable(franchise, record, 'CareerStats');
    if (!careerResolved) continue;
    const category = categoryFromTableName(careerResolved.table.name);
    if (!category) continue;

    // Same exact-SEAS_YEAR-match rule as extract-stats.ts.
    const seasonRow = resolveReferenceWithTable(franchise, record, 'SeasonStats');
    if (!seasonRow) continue;
    for (const slotKey of Object.keys(seasonRow.record.fields)) {
      const resolved = resolveReferenceWithTable(franchise, seasonRow.record, slotKey);
      if (!resolved) continue;
      if (Number(resolved.record.SEAS_YEAR) === expectedRelativeYear) {
        stats.push({
          playerId: Number(record.PresentationId),
          category,
          season: mapLineForCategory(category, resolved.record),
        });
        break;
      }
    }
  }

  return { players, stats };
}
