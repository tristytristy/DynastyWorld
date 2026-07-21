import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { NationalRecruitData } from '../extractors/extract-national-recruits';
import type { NationalRecruit } from '../shared/types';

/**
 * The whole league-wide recruit pool for a season (~2,950 rows) — the national
 * Recruits browser. Read from the compressed `nationalRecruits` snapshot, then
 * merged with the user's own board snapshot (`recruits`) so each prospect knows
 * whether it's on the user's board (drives the add/remove control). Distinct
 * from getRecruits, which returns only the board.
 */
export function getNationalRecruits(dynastyId: string, seasonId?: number): NationalRecruit[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const recruits = getSnapshot<NationalRecruitData[]>(season.id, 'nationalRecruits');
  if (!recruits) return undefined;

  const board = getSnapshot<{ playerId: number }[]>(season.id, 'recruits') ?? [];
  const boardIds = new Set(board.map((r) => r.playerId));

  return recruits.map((r) => ({ ...r, onUserBoard: boardIds.has(r.playerId) }));
}
