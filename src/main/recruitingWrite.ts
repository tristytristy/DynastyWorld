import {
  getLargestTable,
  nonEmpty,
  openFranchiseFile,
  preloadAllInstances,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from '../extractors/lib/franchise';
import { getDynastyById } from '../database/helpers';
import { extractAll } from '../extractors/extract-all';
import { persistExtraction } from '../database/importExtraction';
import { backupSaveFile } from './editorWrite';
import type { RecruitInfluenceEdit, SaveEditResult } from '../shared/types';

/** Valid RecruitStage enum values (the decision funnel), verified on real saves. */
export const RECRUIT_STAGES = ['Top10', 'Top5', 'Top3', 'SoftCommitted', 'Signed'];

/**
 * Shared write wrapper for recruiting edits — mirrors editorWrite.ts's proven
 * open→mutate→save→re-extract sequence, with one addition: an automatic save-
 * file backup BEFORE any write (these edits touch recruiting tables the main
 * editor doesn't, so a fresh recovery point is made every time regardless of
 * whether the user hit the manual Backup button). A failed backup aborts the
 * write — we never mutate a save we couldn't first copy.
 */
async function withRecruitWrite(
  dynastyId: string,
  mutate: (franchise: OpenFranchise) => Promise<boolean>,
): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  const backup = backupSaveFile(dynastyId);
  if (!backup.success) {
    return { success: false, message: `Aborted — could not back up the save first: ${backup.message}` };
  }

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    const ok = await mutate(franchise);
    if (!ok) return { success: false, message: 'Recruit not found in the save file.' };

    await franchise.save(dynasty.savePath, {});

    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    return { success: true, message: 'Saved.' };
  } catch (err) {
    return {
      success: false,
      message: `Save failed (your pre-edit backup is safe: ${backup.filePath ?? 'save-backups'}). ${err instanceof Error ? err.message : ''}`.trim(),
    };
  }
}

async function findRecruitByPlayerId(
  franchise: OpenFranchise,
  playerId: number,
): Promise<FranchiseRecord | undefined> {
  const table = getLargestTable(franchise, 'Recruit');
  await table.readRecords();
  await preloadAllInstances(franchise, 'Player');
  for (const recruit of nonEmpty(table.records)) {
    const player = resolveReferenceWithTable(franchise, recruit, 'Player');
    if (player && Number(player.record.PresentationId) === playerId) return recruit;
  }
  return undefined;
}

/**
 * Writes a recruit's decision funnel: commitment stage + commit score on the
 * Recruit row, and each top school's team + interest on its ProspectTargetSchool
 * entries (matched to the recruit's TopSchoolsList slots in order). All four
 * field types were round-trip verified on a disposable save before this shipped.
 */
export async function saveRecruitInfluence(
  dynastyId: string,
  playerId: number,
  edit: RecruitInfluenceEdit,
): Promise<SaveEditResult> {
  return withRecruitWrite(dynastyId, async (franchise) => {
    await preloadAllInstances(franchise, 'ProspectTargetSchool[]');
    await preloadAllInstances(franchise, 'ProspectTargetSchool');

    const recruit = await findRecruitByPlayerId(franchise, playerId);
    if (!recruit) return false;

    if (RECRUIT_STAGES.includes(edit.stage)) recruit.RecruitStage = edit.stage;
    recruit.CommitScore = Math.max(0, Math.round(edit.commitScore));

    // Match each edit to its slot by TeamId (a recruit's top schools are distinct
    // teams) — order-independent, since the browser sorts top schools by influence
    // while the save stores them in native slot order.
    const influenceByTeam = new Map(edit.topSchools.map((s) => [s.teamIndex, s.influence]));
    const list = resolveReferenceWithTable(franchise, recruit, 'TopSchoolsList');
    if (list) {
      for (const slotKey of Object.keys(list.record.fields)) {
        const entry = resolveReferenceWithTable(franchise, list.record, slotKey);
        if (!entry) continue;
        const next = influenceByTeam.get(Number(entry.record.TeamId));
        if (next === undefined) continue;
        entry.record.TeamInfluence = Math.max(0, Math.min(99, Math.round(next)));
      }
    }
    return true;
  });
}
