import { getDb, persist } from './init';
import { coachSeasons, eligiblePlayers, snapshotFor } from './hallOfLegends';
import { getCoachLeaderboards } from './getCoachLeaderboards';

/**
 * KEEPS THE LEGEND POOL STOCKED FROM THE LEADERBOARDS, WITHOUT EVER OVERRULING
 * THE USER.
 *
 * The top three in each statistical category are added to the pool for you, and
 * leave again when someone overtakes them. That is a convenience, not an
 * opinion — so it is bounded by one rule: **the automation only ever owns what
 * nobody has touched.**
 *
 *   - Rows added here are marked `source = 'auto'` and are the only ones it may
 *     remove.
 *   - Anything the user added is `'manual'` and is never evicted, however far
 *     the player slips down a board.
 *   - Assigning an auto row to a formation slot PROMOTES it to manual. Putting
 *     someone in your starting eleven is an endorsement, and it would be absurd
 *     for the app to pull him out from under a slot he occupies because his
 *     receptions dropped to sixth.
 *
 * TOP THREE OF EVERY BOARD, across all fourteen — narrow per board, but broad
 * across them, so a return specialist gets in on his own merits rather than
 * losing to yardage totals he can never post. Overlap collapses it further in
 * practice: the same quarterback leads passing yards, touchdowns and completion
 * percentage, and counts once.
 *
 * Was five per board, which filled a three-season pool to 41 — enough that the
 * shortlist stopped being short. Lowering it evicts the auto entries that no
 * longer qualify on the next reconcile; anything the user added or slotted is
 * untouched, which is the whole point of the source column.
 *
 * Idempotent, and silent when nothing changed: it computes the desired set,
 * diffs it against what is stored, and returns without writing if they match.
 * That is what makes it safe to call on a read.
 */

const AUTO_TOP_N = 3;

export interface LegendAutoFillResult {
  added: number;
  removed: number;
  /** True when the pool already matched — no write happened. */
  unchanged: boolean;
}

interface StoredAuto {
  playerId: number;
  tier: string | null;
}

function storedAutoEntries(dynastyId: string, coachId: number): StoredAuto[] {
  const stmt = getDb().prepare(
    "SELECT player_id, tier FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND source = 'auto'",
  );
  stmt.bind([dynastyId, coachId]);
  const out: StoredAuto[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { player_id: number; tier: string | null };
    out.push({ playerId: Number(row.player_id), tier: row.tier ?? null });
  }
  stmt.free();
  return out;
}

function manualPlayerIds(dynastyId: string, coachId: number): Set<number> {
  const stmt = getDb().prepare(
    "SELECT player_id FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND source = 'manual'",
  );
  stmt.bind([dynastyId, coachId]);
  const out = new Set<number>();
  while (stmt.step()) out.add(Number((stmt.getAsObject() as { player_id: number }).player_id));
  stmt.free();
  return out;
}

export function reconcileAutoLegends(dynastyId: string, coachId: number): LegendAutoFillResult {
  const boards = getCoachLeaderboards(dynastyId);
  if (!boards) return { added: 0, removed: 0, unchanged: true };

  const wanted = new Set<number>();
  for (const board of boards.boards) {
    for (const row of board.rows.slice(0, AUTO_TOP_N)) wanted.add(row.playerId);
  }

  const manual = manualPlayerIds(dynastyId, coachId);
  const stored = storedAutoEntries(dynastyId, coachId);
  const storedIds = new Set(stored.map((s) => s.playerId));

  /*
    An auto row that has since been given a slot is treated as the user's. It is
    promoted here rather than merely skipped, so it leaves the automation's
    ledger permanently and cannot be reclaimed by a later run.
  */
  const promote = stored.filter((s) => s.tier !== null).map((s) => s.playerId);

  const toAdd = [...wanted].filter((id) => !storedIds.has(id) && !manual.has(id));
  const toRemove = stored
    .filter((s) => s.tier === null && !wanted.has(s.playerId))
    .map((s) => s.playerId);

  if (toAdd.length === 0 && toRemove.length === 0 && promote.length === 0) {
    return { added: 0, removed: 0, unchanged: true };
  }

  const db = getDb();

  for (const playerId of promote) {
    db.run("UPDATE coach_legends SET source = 'manual' WHERE dynasty_id = ? AND coach_id = ? AND player_id = ?", [
      dynastyId,
      coachId,
      playerId,
    ]);
  }

  if (toAdd.length > 0) {
    // Resolved once: the eligible list is the same expensive fold the Hall uses,
    // and it also enforces the one hard rule — only players this coach coached.
    const eligible = new Map(eligiblePlayers(dynastyId, coachId).map((p) => [p.playerId, p]));
    const seasons = coachSeasons(dynastyId, coachId);
    const last = seasons[seasons.length - 1];
    const now = new Date().toISOString();

    for (const playerId of toAdd) {
      const player = eligible.get(playerId);
      if (!player) continue;
      db.run(
        `INSERT INTO coach_legends
           (dynasty_id, coach_id, player_id, added_at, added_from_season_id, added_from_team_index, snapshot_json, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'auto')
         ON CONFLICT(dynasty_id, coach_id, player_id) DO NOTHING`,
        [dynastyId, coachId, playerId, now, last?.seasonId ?? null, player.teamIndex, JSON.stringify(snapshotFor(player))],
      );
    }
  }

  for (const playerId of toRemove) {
    db.run(
      "DELETE FROM coach_legends WHERE dynasty_id = ? AND coach_id = ? AND player_id = ? AND source = 'auto' AND tier IS NULL",
      [dynastyId, coachId, playerId],
    );
  }

  persist();
  return { added: toAdd.length, removed: toRemove.length, unchanged: false };
}
