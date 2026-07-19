import { extractAll } from '../extractors/extract-all';
import { getCurrentSeason, getDynastyById, getDynastyBySavePath, getDynasties, updateDynasty } from './helpers';
import { formatBackfillSuffix, persistExtraction } from './importExtraction';
import type { DynastyMatchCandidate, ImportResult } from '../shared/types';

/**
 * Dynasties are matched by exact save-file path (UNIQUE(save_path) in
 * schema.sql), so a save renamed/moved/restored from backup between seasons
 * silently forks into a brand-new dynasty instead of adding a season to the
 * existing one — confirmed against a real case where a save advanced to
 * season 2 and re-saved under a new filename produced a second, unrelated
 * one-season dynasty. This detects that case before it happens: skips
 * straight to null (no candidate) for the common case of an already-tracked
 * exact path, since that's just a normal reimport with nothing to detect.
 */
export async function checkDynastyMatch(filePath: string): Promise<DynastyMatchCandidate | null> {
  if (getDynastyBySavePath(filePath)) return null;

  const extraction = await extractAll(filePath);
  const candidate = getDynasties().find(
    (d) => d.teamId === extraction.userTeam.teamIndex && d.savePath !== filePath,
  );
  if (!candidate) return null;

  const candidateCurrentSeason = getCurrentSeason(candidate.id);
  return {
    dynastyId: candidate.id,
    label: candidate.label,
    currentSeasonYear: candidateCurrentSeason?.seasonYear ?? extraction.league.seasonYear,
    newSeasonYear: extraction.league.seasonYear,
  };
}

/**
 * Points an existing dynasty at a new save-file path and imports it as that
 * same dynasty's next season, instead of the file creating a separate one.
 * Guarded by a team-match check so a mis-pick can never silently attach an
 * unrelated program's save to this dynasty's history, and by a save_path
 * collision check so it can't clobber a different dynasty that's already
 * tracking that exact file.
 */
export async function relinkDynasty(dynastyId: string, filePath: string): Promise<ImportResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) {
    return { success: false, message: 'That dynasty no longer exists.' };
  }

  const existingOwner = getDynastyBySavePath(filePath);
  if (existingOwner && existingOwner.id !== dynastyId) {
    return {
      success: false,
      message: `This save file is already tracked as a separate dynasty ("${existingOwner.label}"). Delete that entry first if you want to merge into this one.`,
    };
  }

  let extraction;
  try {
    extraction = await extractAll(filePath);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Failed to read save file.' };
  }

  if (extraction.userTeam.teamIndex !== dynasty.teamId) {
    return {
      success: false,
      message: `This save is for ${extraction.userTeam.displayName}, not ${dynasty.teamName ?? dynasty.label} — pick the correct file for this dynasty.`,
    };
  }

  updateDynasty(dynastyId, { savePath: filePath });
  const { backfilledSeasonYears } = persistExtraction(filePath, extraction);

  return {
    success: true,
    message: `Linked — season ${extraction.league.seasonYear} added to ${dynasty.label}.${formatBackfillSuffix(backfilledSeasonYears)}`,
    dynastyId,
  };
}
