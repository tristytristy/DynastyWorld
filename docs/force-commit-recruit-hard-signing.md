# Force Commit — sending a recruit to the next season

How Dynasty Hub forces a boarded recruit to actually join your roster the
following season.

## The short version

The game builds next year's roster from a hidden **"committed players" list**
on your team (`Team.CommittedPlayers`). When a recruit signs for real, the game
quietly drops them onto that list.

Force Commit does the same thing by hand:

1. It marks the recruit as **signed to your school** (scholarship offered, NIL
   met, your program the clear influence leader) so it reads as signed in-game.
2. It **adds the player to that committed list itself** — the list the game
   actually enrolls the incoming class from at the offseason rollover.

Come the offseason, the game enrolls them like any other signee and they show
up on your roster next season. The save is backed up first, and the write is
re-checked on reopen (and rolled back if it didn't stick), so nothing breaks.

## Why it works (and why it's safe)

Every write is an **edit to an existing record or an empty array slot** — the
board entry (`UserRecruitTarget`), the `Recruit` row, its top-school slots, and
one free `CommittedPlayers` slot. It never **creates** a record.

Creating recruit/board rows from outside the game corrupts the save (a known
crash), which is why recruits that aren't already on your board are refused —
you have to add them to your board inside College Football 27 first.

## The code

From `src/main/recruitingWrite.ts`.

### 1. The two-step write

Inside `forceCommitRecruit`: make it *look* signed, then make it *actually*
roster.

```ts
// ---- 1) Make it LOOK signed (recruiting UI) ----
// Natural-signed board recruits keep ScholarshipStatus=Offered and
// CommittedWeekNumber=0. Force those, meet NIL, mark Signed, make the
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
// offseason rollover; a force-sign that never lands in that list gets dropped.
const enroll = await addToCommittedPlayers(franchise, userTeamIndex, playerId, changes);

await franchise.save(dynasty.savePath, {});
```

### 2. The rostering helper

Writes the player into the team's `CommittedPlayers` array (the list the game
enrolls from).

```ts
async function addToCommittedPlayers(franchise, userTeamIndex, playerId, changes) {
  const playerTable = getLargestTable(franchise, 'Player');
  await playerTable.readRecords();
  const rowIndex = playerTable.records.findIndex((r) => !r.isEmpty && Number(r.PresentationId) === playerId);
  if (rowIndex < 0) return { added: false, reason: 'player row not found' };

  const cont = await resolveCommittedPlayers(franchise, userTeamIndex); // Team.CommittedPlayers array row
  if (!cont) return { added: false, reason: 'no readable CommittedPlayers list' };
  if (committedPlayersHas(franchise, cont, playerId)) return { added: true, already: true };

  // First empty slot (all-zero reference); no slot => class list is full.
  const emptyKey = Object.keys(cont.fields).find((k) => /^0+$/.test(String(cont[k])));
  if (!emptyKey) return { added: false, reason: 'incoming class list is full' };

  // Build the 32-bit array-slot reference to the player row and drop it in the slot.
  const refBuilder = playerTable; // getBinaryReferenceToRecord isn't in the lib types, so cast at runtime
  cont[emptyKey] = refBuilder.getBinaryReferenceToRecord(rowIndex);
  return { added: true };
}
```

### 3. Back up, save, validate, roll back

```ts
const validated = await validateForceCommit(dynasty.savePath, playerId, userTeamIndex, enroll.added);
if (!validated) {
  fs.copyFileSync(backup.filePath, dynasty.savePath); // roll back, never leave a half-applied write
  return { success: false, code: 'VALIDATION_FAILED', /* ... */ };
}
```

`validateForceCommit` reopens the just-saved file and confirms the recruit is
`Signed`, still on the board, and (when enrollment was possible) present in the
team's `CommittedPlayers` list. If any of that fails, the untouched pre-edit
backup is copied back over the save.

## Golden rule for using it

Run Force Commit with **College Football 27 fully closed**, then reload the save
in-game afterward. If the game is running while the app writes, its autosave can
overwrite the change or show stale info. Close the game, force the commit, then
open the game and load the save.
