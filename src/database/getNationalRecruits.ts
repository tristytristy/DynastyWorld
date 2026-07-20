import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import type { NationalRecruitData } from '../extractors/extract-national-recruits';
import type { NationalRecruit } from '../shared/types';

/**
 * The whole league-wide recruit pool for a season (~2,950 rows) — the national
 * Recruits browser under NCAA Hub. Read straight from the compressed
 * `nationalRecruits` snapshot; the stored shape already matches the renderer
 * type, so this is a pass-through with light null-guarding. Distinct from
 * getRecruits (the user's own 35-slot board).
 */
export function getNationalRecruits(dynastyId: string, seasonId?: number): NationalRecruit[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const recruits = getSnapshot<NationalRecruitData[]>(season.id, 'nationalRecruits');
  if (!recruits) return undefined;
  return recruits;
}
