import fs from 'fs';
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
import type {
  ForceCommitFieldChange,
  ForceCommitResult,
  RecruitInfluenceEdit,
  SaveEditResult,
} from '../shared/types';

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

// ---------------------------------------------------------------------------
// EXPERIMENTAL: Force Commit
//
// Forces a recruit who is ALREADY on the user's board to commit to the user's
// team, by writing the real committed state the offseason roster conversion
// reads — NOT just the cosmetic Recruit.RecruitStage. See the reference memory
// "recruit sign->roster mechanism": a recruit rosters only when his board entry
// (UserRecruitTarget) reaches ScholarshipStatus=Committed + CommittedWeekNumber,
// with his NIL met and the user's school the clear influence leader.
//
// SAFETY: every field written here is an edit on an EXISTING record (the board
// entry, the Recruit row, its ProspectTargetSchool slots) — never a record
// CREATION, which is the board-add path that crashes the game. Recruits not on
// the board are refused (they'd need a board row created in-game first). The
// whole write is backed up first, validated on reopen, and rolled back from the
// backup if validation fails.
// ---------------------------------------------------------------------------

async function findUserTeamIndexFromSave(franchise: OpenFranchise): Promise<number | undefined> {
  const table = getLargestTable(franchise, 'Coach');
  await table.readRecords();
  // IsUserControlled reads back as a real boolean here, so compare loosely to
  // both true and the string 'true' rather than assuming one representation.
  const user = nonEmpty(table.records).find(
    (c) => c.IsUserControlled === true || String(c.IsUserControlled) === 'true',
  );
  return user ? Number(user.TeamIndex) : undefined;
}

async function teamNameByIndex(franchise: OpenFranchise, teamIndex: number): Promise<string> {
  const table = getLargestTable(franchise, 'Team');
  await table.readRecords();
  const t = nonEmpty(table.records).find((r) => Number(r.TeamIndex) === teamIndex);
  return t ? String(t.DisplayName) : `Team ${teamIndex}`;
}

/** The board entry (UserRecruitTarget) for a recruit, matched by resolved Player id. Undefined if not on the user's board. */
async function findBoardEntryForRecruit(franchise: OpenFranchise, playerId: number): Promise<FranchiseRecord | undefined> {
  const table = getLargestTable(franchise, 'UserRecruitTarget');
  await table.readRecords();
  for (const b of nonEmpty(table.records)) {
    const rec = resolveReferenceWithTable(franchise, b, 'Recruit');
    if (!rec) continue;
    const player = resolveReferenceWithTable(franchise, rec.record, 'Player');
    if (player && Number(player.record.PresentationId) === playerId) return b;
  }
  return undefined;
}

/** Make the user's team the sole top-influence school (99), capping every other school below it to break ties; swaps the user's team into the weakest slot if it isn't already present. Logs each change. */
function setTopSchoolsUserLeader(
  franchise: OpenFranchise,
  recruit: FranchiseRecord,
  userTeamIndex: number,
  changes: ForceCommitFieldChange[],
): void {
  const list = resolveReferenceWithTable(franchise, recruit, 'TopSchoolsList');
  if (!list) return;

  const slots: { slotKey: string; entry: FranchiseRecord }[] = [];
  for (const slotKey of Object.keys(list.record.fields)) {
    const entry = resolveReferenceWithTable(franchise, list.record, slotKey);
    if (entry) slots.push({ slotKey, entry: entry.record });
  }
  if (slots.length === 0) return;

  let userSlot = slots.find((s) => Number(s.entry.TeamId) === userTeamIndex);
  if (!userSlot) {
    // Swap the user's team into the lowest-influence slot (order-independent).
    userSlot = slots.reduce((lo, s) => (Number(s.entry.TeamInfluence) < Number(lo.entry.TeamInfluence) ? s : lo), slots[0]);
    const before = String(userSlot.entry.TeamId);
    userSlot.entry.TeamId = userTeamIndex;
    changes.push({ field: `TopSchool.TeamId`, before, after: String(userSlot.entry.TeamId) });
  }

  for (const s of slots) {
    const before = String(s.entry.TeamInfluence);
    s.entry.TeamInfluence = s === userSlot ? 99 : Math.min(Number(s.entry.TeamInfluence), 60);
    if (String(s.entry.TeamInfluence) !== before) {
      changes.push({ field: `TopSchool.TeamInfluence (${s === userSlot ? 'user' : 'rival'})`, before, after: String(s.entry.TeamInfluence) });
    }
  }
}

type ArrayContainerTable = { records: FranchiseRecord[]; readRecords(): Promise<void> } | null;

/** Resolves a team's CommittedPlayers array-container row (the incoming-class list), or null. */
async function resolveCommittedPlayers(
  franchise: OpenFranchise,
  userTeamIndex: number,
): Promise<FranchiseRecord | null> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords();
  const team = nonEmpty(teamTable.records).find((r) => Number(r.TeamIndex) === userTeamIndex);
  if (!team) return null;
  const rd = team.getReferenceDataByKey('CommittedPlayers');
  if (!rd || !rd.tableId) return null;
  const contTable = franchise.getTableById(rd.tableId) as unknown as ArrayContainerTable;
  if (!contTable) return null;
  await contTable.readRecords();
  return contTable.records[rd.rowNumber] ?? null;
}

/** True if the player (by PresentationId) is already in the team's CommittedPlayers list. */
function committedPlayersHas(franchise: OpenFranchise, cont: FranchiseRecord, playerId: number): boolean {
  for (const k of Object.keys(cont.fields)) {
    const slot = cont.getReferenceDataByKey(k);
    if (!slot || !slot.tableId) continue;
    const t = franchise.getTableById(slot.tableId) as unknown as { records: FranchiseRecord[] } | null;
    const p = t?.records?.[slot.rowNumber];
    if (p && !p.isEmpty && Number(p.PresentationId) === playerId) return true;
  }
  return false;
}

/**
 * Adds the player to the user team's CommittedPlayers list — the array the game
 * actually enrolls the incoming class from at the offseason rollover. Verified
 * (APPSTATEFORCETRANSFER): natural signs are in it; a force-sign that was NOT in
 * it got dropped. This is a reference-write into an existing empty array slot
 * (the safe edit class — same as the top-school swap — NOT record creation like
 * board-add). Returns why it couldn't add so the caller can warn.
 */
async function addToCommittedPlayers(
  franchise: OpenFranchise,
  userTeamIndex: number,
  playerId: number,
  changes: ForceCommitFieldChange[],
): Promise<{ added: boolean; already?: boolean; reason?: string }> {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords();
  const rowIndex = playerTable.records.findIndex((r) => !r.isEmpty && Number(r.PresentationId) === playerId);
  if (rowIndex < 0) return { added: false, reason: 'player row not found in the Player table' };
  const rec = playerTable.records[rowIndex];
  const playerName = `${String(rec.FirstName)} ${String(rec.LastName)}`;

  const cont = await resolveCommittedPlayers(franchise, userTeamIndex);
  if (!cont) return { added: false, reason: 'team has no readable CommittedPlayers list' };

  if (committedPlayersHas(franchise, cont, playerId)) return { added: true, already: true };

  // First empty slot (all-zero reference); no slot => the class list is full.
  const emptyKey = Object.keys(cont.fields).find((k) => /^0+$/.test(String(cont[k])));
  if (!emptyKey) return { added: false, reason: 'the incoming class list is full (no free slot)' };

  // getBinaryReferenceToRecord exists at runtime (used to build the 32-bit array-slot
  // reference) but isn't in the lib's TS types, so reach it through a cast.
  const refBuilder = playerTable as unknown as { getBinaryReferenceToRecord(index: number): string };
  cont[emptyKey] = refBuilder.getBinaryReferenceToRecord(rowIndex);
  changes.push({ field: 'Team.CommittedPlayers', before: '(not enrolled)', after: `${playerName} enrolled` });
  return { added: true };
}

/**
 * Reopens the just-saved file and confirms the write persisted: recruit Signed,
 * still on the board, and (when enrollment was possible) present in the team's
 * CommittedPlayers list. `expectEnrolled` is false when the class list was full
 * so we don't roll back the look-signed edits over an enrollment we couldn't do.
 */
async function validateForceCommit(
  savePath: string,
  playerId: number,
  userTeamIndex: number,
  expectEnrolled: boolean,
): Promise<boolean> {
  const franchise = await openFranchiseFile(savePath);
  await preloadAllInstances(franchise, 'Player');
  const recruit = await findRecruitByPlayerId(franchise, playerId);
  if (!recruit || String(recruit.RecruitStage) !== 'Signed') return false;
  const board = await findBoardEntryForRecruit(franchise, playerId);
  if (!board) return false;
  if (!expectEnrolled) return true;
  const cont = await resolveCommittedPlayers(franchise, userTeamIndex);
  return !!cont && committedPlayersHas(franchise, cont, playerId);
}

export async function forceCommitRecruit(dynastyId: string, playerId: number): Promise<ForceCommitResult> {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return { success: false, message: 'Dynasty not found.' };

  const backup = backupSaveFile(dynastyId);
  if (!backup.success || !backup.filePath) {
    return { success: false, message: `Aborted — could not back up the save first: ${backup.message}` };
  }

  try {
    const franchise = await openFranchiseFile(dynasty.savePath);
    await preloadAllInstances(franchise, 'ProspectTargetSchool[]');
    await preloadAllInstances(franchise, 'ProspectTargetSchool');
    await preloadAllInstances(franchise, 'Player');

    const userTeamIndex = await findUserTeamIndexFromSave(franchise);
    if (userTeamIndex === undefined) {
      return { success: false, code: 'NO_USER_TEAM', message: 'Could not identify your user-controlled team in the save.' };
    }
    const destinationTeamName = await teamNameByIndex(franchise, userTeamIndex);

    const recruit = await findRecruitByPlayerId(franchise, playerId);
    if (!recruit) return { success: false, code: 'NOT_FOUND', message: 'Recruit not found in the save file.' };

    // No "already signed" block: re-forcing is allowed so a recruit stuck in the
    // old Signed state (or committed elsewhere) can be moved to the natural
    // hard-commit state for the user's team.

    const board = await findBoardEntryForRecruit(franchise, playerId);
    if (!board) {
      return {
        success: false,
        code: 'NOT_ON_BOARD',
        message:
          "This recruit isn't on your recruiting board. Add him to your board inside College Football 27 first — creating a board entry from outside the game corrupts the save (a known crash).",
      };
    }

    const changes: ForceCommitFieldChange[] = [];
    const set = (rec: FranchiseRecord, field: string, value: string | number): void => {
      const before = String(rec[field]);
      rec[field] = value;
      changes.push({ field, before, after: String(rec[field]) });
    };

    // ---- 1) Make it LOOK signed (recruiting UI) ----
    // Natural-signed board recruits keep ScholarshipStatus=Offered and
    // CommittedWeekNumber=0 (verified at signing week — the only fields that
    // differed on the stuck force-sign were Committed + week 10). Force those to
    // the natural values (also repairs a recruit stuck in the old state), meet
    // NIL, mark the recruit Signed with a strong commit score, and make the
    // user's team the sole influence leader.
    set(board, 'ScholarshipStatus', 'Offered');
    set(board, 'CommittedWeekNumber', 0);
    const nilExpectation = Number(board.NILExpectation);
    set(board, 'CurrentNILOffer', Math.max(0, Math.min(1023, Math.max(Number(board.CurrentNILOffer), nilExpectation))));
    set(recruit, 'RecruitStage', 'Signed');
    set(recruit, 'CommitScore', Math.max(Number(recruit.CommitScore), 400));
    setTopSchoolsUserLeader(franchise, recruit, userTeamIndex, changes);

    // ---- 2) Make it ACTUALLY roster (the real mechanism) ----
    // The game enrolls the incoming class from Team.CommittedPlayers at the
    // offseason rollover; a force-sign that never lands in that list gets dropped
    // (verified — natural signs were in it, the force-sign wasn't). Add him — a
    // safe reference-write into an existing empty array slot, not record creation.
    const enroll = await addToCommittedPlayers(franchise, userTeamIndex, playerId, changes);

    await franchise.save(dynasty.savePath, {});

    const validated = await validateForceCommit(dynasty.savePath, playerId, userTeamIndex, enroll.added);
    if (!validated) {
      // Roll back to the untouched pre-edit backup — never leave a half-applied write.
      fs.copyFileSync(backup.filePath, dynasty.savePath);
      return {
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'The write did not verify on reopen — your pre-edit save was automatically restored. No changes were kept.',
        changedFields: changes,
        validated: false,
      };
    }

    const extraction = await extractAll(dynasty.savePath);
    persistExtraction(dynasty.savePath, extraction);

    const enrollNote = enroll.added
      ? enroll.already
        ? 'He was already in your incoming class.'
        : 'Enrolled in your incoming class — this is the part that actually rosters him.'
      : `WARNING: could not enroll him (${enroll.reason}) — he'll read as signed but may not roster.`;
    return {
      success: true,
      message: `Signed to ${destinationTeamName}. ${enrollNote} Sim to next season and check the roster.`,
      destinationTeamName,
      changedFields: changes,
      validated: true,
    };
  } catch (err) {
    // On any mid-write error the on-disk file may be untouched (save writes at
    // the end), but restore from backup regardless so the user is never worse off.
    try {
      fs.copyFileSync(backup.filePath, dynasty.savePath);
    } catch {
      /* backup file itself is still safe on disk for manual restore */
    }
    return {
      success: false,
      message: `Force Commit failed (your pre-edit backup is safe: ${backup.filePath}). ${err instanceof Error ? err.message : ''}`.trim(),
    };
  }
}
