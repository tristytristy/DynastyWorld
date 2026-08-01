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

/**
 * IS THIS ID A PROSPECT?
 *
 * Recruits live in the SAME `Player` table as roster players and keep a
 * sentinel `TeamIndex` of 255 even after signing (see extract-recruits.ts), and
 * 255 is *also* the FCS/placeholder bucket (see shared/fcsPool.ts). So the team
 * index cannot answer this — measured on a real archive, 255 holds ~4,525
 * entities while the season carries ~4,100 recruits, and the two sets are not
 * the same. The only sound test is membership of the recruit pool itself, which
 * is keyed by `playerId` in the same id space as the roster.
 *
 * This exists because a prospect that reaches the player modal gets the full
 * five-destination workspace — Journey, DNA, Showcase — for someone who has
 * never played a college down, and shows ratings the Recruit Hub deliberately
 * keeps locked. Callers use this to route to the recruit view instead.
 *
 * Returns ids only: the caller is usually asking "which of these is a
 * prospect?" for a whole list, and the full pool is thousands of rows.
 */
export function getRecruitIds(dynastyId: string, seasonId?: number): number[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const recruits = getSnapshot<NationalRecruitData[]>(season.id, 'nationalRecruits');
  if (!recruits) return undefined;
  return recruits.map((r) => r.playerId);
}

/** One prospect by player id, board flag included — what the recruit modal needs to render after a routed open. */
export function getRecruitById(
  dynastyId: string,
  playerId: number,
  seasonId?: number,
): NationalRecruit | undefined {
  return getNationalRecruits(dynastyId, seasonId)?.find((r) => r.playerId === playerId);
}
