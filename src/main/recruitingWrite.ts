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

    // Each edit is keyed by the team CURRENTLY in the slot (originalTeamIndex) —
    // order-independent (the browser sorts by influence; the save stores native
    // slot order) and swap-safe: writing a different teamIndex changes which
    // school is in that slot (e.g. dropping a rival in for the user's team).
    const editByOriginalTeam = new Map(edit.topSchools.map((s) => [s.originalTeamIndex, s]));
    const list = resolveReferenceWithTable(franchise, recruit, 'TopSchoolsList');
    if (list) {
      for (const slotKey of Object.keys(list.record.fields)) {
        const entry = resolveReferenceWithTable(franchise, list.record, slotKey);
        if (!entry) continue;
        const target = editByOriginalTeam.get(Number(entry.record.TeamId));
        if (!target) continue;
        entry.record.TeamId = target.teamIndex;
        entry.record.TeamInfluence = Math.max(0, Math.min(99, Math.round(target.influence)));
      }
    }
    return true;
  });
}

const BOARD_TABLES = ['Team', 'RecruitingBoard', 'RecruitTarget[]', 'UserRecruitTarget', 'Recruit', 'Player'];

/**
 * The madden-franchise table methods needed to add a record — beyond our
 * lightweight FranchiseTable boundary type. `nextRecordToUse` is the head of
 * the empty-record chain; `setNextRecordToUse` allocates a row out of it (the
 * step that actually marks a populated empty row non-empty); getBinary... builds
 * a reference string to a row. Verified against madden-franchise's .d.ts.
 */
interface AllocatableTable {
  header: { nextRecordToUse: number };
  records: FranchiseRecord[];
  getBinaryReferenceToRecord(index: number): string;
  setNextRecordToUse(index: number, resetEmptyRecordMap: boolean): void;
}
function asAllocatable(table: unknown): AllocatableTable {
  return table as unknown as AllocatableTable;
}

/** Resolves the user team's board slot container (Team.RecruitingBoard.Recruits, a fixed 35-slot array of UserRecruitTarget refs). */
function loadBoardSlots(
  franchise: OpenFranchise,
  teamIndex: number,
): { slotsRow: FranchiseRecord; slotKeys: string[] } | null {
  const teamTable = getLargestTable(franchise, 'Team');
  const team = nonEmpty(teamTable.records).find((r) => Number(r.TeamIndex) === teamIndex);
  if (!team) return null;
  const board = resolveReferenceWithTable(franchise, team, 'RecruitingBoard');
  if (!board) return null;
  const slots = resolveReferenceWithTable(franchise, board.record, 'Recruits');
  if (!slots) return null;
  return { slotsRow: slots.record, slotKeys: Object.keys(slots.record.fields) };
}

/** The Player.PresentationId a board slot's UserRecruitTarget points at, or null for an empty slot. */
function slotPlayerId(franchise: OpenFranchise, slotsRow: FranchiseRecord, slotKey: string): number | null {
  const urt = resolveReferenceWithTable(franchise, slotsRow, slotKey);
  if (!urt) return null;
  const recruit = resolveReferenceWithTable(franchise, urt.record, 'Recruit');
  const player = recruit ? resolveReferenceWithTable(franchise, recruit.record, 'Player') : null;
  return player ? Number(player.record.PresentationId) : null;
}

/** Removes a prospect from the user's board by clearing its slot. Verified round-trip safe. */
export async function removeRecruitFromBoard(dynastyId: string, playerId: number): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty || dynasty.teamId === null) return { success: false, message: 'No user team on this dynasty.' };
  const teamIndex = dynasty.teamId;

  return withRecruitWrite(dynastyId, async (franchise) => {
    await Promise.all(BOARD_TABLES.map((t) => preloadAllInstances(franchise, t)));
    const board = loadBoardSlots(franchise, teamIndex);
    if (!board) return false;

    let targetKey: string | null = null;
    let emptyRaw: string | null = null;
    for (const k of board.slotKeys) {
      const pid = slotPlayerId(franchise, board.slotsRow, k);
      if (pid === null) {
        if (emptyRaw === null) emptyRaw = String(board.slotsRow[k]); // an empty slot's raw value
      } else if (pid === playerId) {
        targetKey = k;
      }
    }
    if (!targetKey) return false; // not on the board
    board.slotsRow[targetKey] = emptyRaw ?? '0'.repeat(32);
    return true;
  });
}

/**
 * Adds a prospect to the user's board — fills an empty board slot with a fresh
 * UserRecruitTarget pointing at the recruit. Uses the "advanced" empty-record
 * allocation (populate `nextRecordToUse`, then `setNextRecordToUse` to take it
 * out of the empty chain) — verified round-trip safe, but the one op worth a
 * one-time in-game confirm. Idempotent (no-op if already on the board); errors
 * if the board is full (35).
 */
export async function addRecruitToBoard(dynastyId: string, playerId: number): Promise<SaveEditResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty || dynasty.teamId === null) return { success: false, message: 'No user team on this dynasty.' };
  const teamIndex = dynasty.teamId;

  return withRecruitWrite(dynastyId, async (franchise) => {
    await Promise.all(BOARD_TABLES.map((t) => preloadAllInstances(franchise, t)));
    await Promise.all(['ProspectTargetSchool[]', 'ProspectTargetSchool'].map((t) => preloadAllInstances(franchise, t)));

    const recruit = await findRecruitByPlayerId(franchise, playerId);
    if (!recruit) return false;
    const board = loadBoardSlots(franchise, teamIndex);
    if (!board) return false;

    let emptyKey: string | null = null;
    for (const k of board.slotKeys) {
      const pid = slotPlayerId(franchise, board.slotsRow, k);
      if (pid === playerId) return true; // already on board — idempotent
      if (pid === null && !emptyKey) emptyKey = k;
    }
    if (!emptyKey) throw new Error('Your recruiting board is full (35). Remove a prospect first.');

    const recruitTable = asAllocatable(getLargestTable(franchise, 'Recruit'));
    const recruitRow = recruitTable.records.indexOf(recruit);
    const urtTable = asAllocatable(getLargestTable(franchise, 'UserRecruitTarget'));
    const urtRow = urtTable.header.nextRecordToUse;
    const nextEmpty = urtTable.records.findIndex((r, i) => i > urtRow && r.isEmpty);
    if (urtRow === undefined || nextEmpty < 0) throw new Error('No free recruiting-target slot in the save.');

    const urt = urtTable.records[urtRow];
    urt.Recruit = recruitTable.getBinaryReferenceToRecord(recruitRow);
    urt.ScholarshipStatus = 'None';
    urt.CurrentNILOffer = 0;
    urt.SendTheHouse = false;
    urt.ContactFriendsAndFamily = false;
    urt.ContactHighSchoolCoaches = false;
    urt.SearchSocialMedia = false;
    urt.VisitRecruitsSchool = false;
    urt.IsFavorite = false;
    urt.CommittedWeekNumber = 0;

    // Allocate the row out of the empty-record chain, then point the board slot at it.
    urtTable.setNextRecordToUse(nextEmpty, true);
    board.slotsRow[emptyKey] = urtTable.getBinaryReferenceToRecord(urtRow);
    return true;
  });
}
