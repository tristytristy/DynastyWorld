import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { NcaaRecordsData } from '../extractors/extract-ncaa-records';

/**
 * The NCAA-wide record book (national career/season/single-game records) for a
 * season, read from the compressed `ncaaRecords` snapshot. Leaguewide, current
 * state — the game ships real FBS all-time records (e.g. Case Keenum's career
 * passing yards) that then update as the dynasty produces new record-holders.
 */
export function getNcaaRecords(dynastyId: string, seasonId?: number): NcaaRecordsData | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  return getSnapshot<NcaaRecordsData>(season.id, 'ncaaRecords') ?? undefined;
}
