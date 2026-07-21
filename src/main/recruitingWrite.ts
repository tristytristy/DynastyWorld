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

/** Reopens the just-saved file and confirms the commit actually persisted on disk. */
async function validateForceCommit(savePath: string, playerId: number): Promise<boolean> {
  const franchise = await openFranchiseFile(savePath);
  await preloadAllInstances(franchise, 'Player');
  const recruit = await findRecruitByPlayerId(franchise, playerId);
  if (!recruit || String(recruit.RecruitStage) !== 'HardCommitted') return false;
  const board = await findBoardEntryForRecruit(franchise, playerId);
  return !!board;
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

    // Replicate the NATURAL hard-commit state, verified on a real mid-season save
    // (APPMASTERMID): a recruit the game has hard-committed is RecruitStage=
    // HardCommitted with the board entry still ScholarshipStatus=Offered and
    // CommittedWeekNumber=0 — NOT Signed/Committed. The game promotes hard-commits
    // to Signed and rosters them at Signing Day. Forcing Signed/Committed mid-cycle
    // (as the first version did) put the recruit in a state no natural recruit has,
    // which is why it never rostered. So here we only: ensure a scholarship is
    // offered, meet the NIL, mark the recruit HardCommitted with a strong commit
    // score, and make the user's team the clear leader — then the game's own
    // Signing Day processing signs and rosters him like any other hard-commit.

    // Match the natural commit state EXACTLY. Verified at portal/signing week
    // (APPMASTERPORTALW1): every naturally-signed board recruit keeps
    // ScholarshipStatus=Offered and CommittedWeekNumber=0 — the ONLY fields that
    // differed on the stuck force-sign (Tim Addington) were Committed + week 10.
    // So force those two back to the natural values (this also repairs a recruit
    // stuck in the old state on a re-force).
    set(board, 'ScholarshipStatus', 'Offered');
    set(board, 'CommittedWeekNumber', 0);
    // Meet the recruit's NIL so affordability isn't the blocker.
    const nilExpectation = Number(board.NILExpectation);
    set(board, 'CurrentNILOffer', Math.max(0, Math.min(1023, Math.max(Number(board.CurrentNILOffer), nilExpectation))));

    // Recruit row: hard-commit with a strong commit score (kept within the
    // natural range). The game promotes HardCommitted -> Signed at Signing Day,
    // so a recruit forced during the season lands in the natural signed state.
    set(recruit, 'RecruitStage', 'HardCommitted');
    set(recruit, 'CommitScore', Math.max(Number(recruit.CommitScore), 400));

    // Top schools: make the user's team the clear, sole influence leader.
    setTopSchoolsUserLeader(franchise, recruit, userTeamIndex, changes);

    await franchise.save(dynasty.savePath, {});

    const validated = await validateForceCommit(dynasty.savePath, playerId);
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

    return {
      success: true,
      message: `Hard-committed to ${destinationTeamName}. Sim through Signing Day — the game should sign & roster him like any natural hard-commit.`,
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
