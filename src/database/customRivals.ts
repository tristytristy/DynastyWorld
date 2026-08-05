import { getDb, persist } from './init';
import type { CustomRival, CustomRivalInput } from '../shared/types';

/**
 * Rivalries the user declared (schema v20) — see the migration for why they are
 * keyed by the MATCHUP rather than by whoever created them, and for why none of
 * this is ever written back to the save.
 *
 * User-authored data, kept out of season snapshots like player_cards, media and
 * program_overrides: a re-sync must never disturb a rivalry someone named.
 *
 * The logo FILES are owned by the IPC layer (ipc/rivals.ts); this module stores
 * basenames and never touches disk.
 */

interface RivalRow {
  id: number;
  team_index: number;
  team_name: string;
  team_name_key: string;
  opponent_team_index: number;
  opponent_name: string;
  opponent_name_key: string;
  pair_key: string;
  rivalry_name: string;
  logo_file: string | null;
  updated_at: string;
}

const COLS =
  'id, team_index, team_name, team_name_key, opponent_team_index, opponent_name, opponent_name_key, pair_key, rivalry_name, logo_file, updated_at';

function mapRow(row: RivalRow): CustomRival {
  return {
    id: row.id,
    teamIndex: row.team_index,
    teamName: row.team_name,
    teamNameKey: row.team_name_key,
    opponentTeamIndex: row.opponent_team_index,
    opponentName: row.opponent_name,
    opponentNameKey: row.opponent_name_key,
    pairKey: row.pair_key,
    rivalryName: row.rivalry_name,
    // Resolved to an absolute path by the IPC layer, which is where userData lives.
    logo: row.logo_file ? { file: row.logo_file, path: null } : null,
    updatedAt: row.updated_at,
  };
}

function query(sql: string, params: (string | number)[]): CustomRival[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const out: CustomRival[] = [];
  while (stmt.step()) out.push(mapRow(stmt.getAsObject() as unknown as RivalRow));
  stmt.free();
  return out;
}

/** Every custom rivalry in the dynasty — what the renderer's registry is built from. */
export function listCustomRivals(dynastyId: string): CustomRival[] {
  return query(
    `SELECT ${COLS} FROM custom_rivals WHERE dynasty_id = ? ORDER BY rivalry_name COLLATE NOCASE ASC`,
    [dynastyId],
  );
}

function findByPair(dynastyId: string, pairKey: string): CustomRival | null {
  return query(`SELECT ${COLS} FROM custom_rivals WHERE dynasty_id = ? AND pair_key = ?`, [dynastyId, pairKey])[0] ?? null;
}

/**
 * Creates the rivalry, or renames the one that already covers this matchup.
 *
 * UPSERT ON THE PAIR rather than insert-and-fail, because from the user's side
 * "add UCLA vs Oregon" when UCLA vs Oregon already exists is a rename, not an
 * error — and a UNIQUE violation surfacing as a failed save would be the app
 * refusing an edit it understood perfectly well.
 *
 * The logo is deliberately NOT touched here: art is picked in its own step, and
 * renaming a rivalry must not silently drop the image on it.
 */
export function saveCustomRival(dynastyId: string, input: CustomRivalInput): CustomRival | null {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = findByPair(dynastyId, input.pairKey);
  if (existing) {
    db.run(
      `UPDATE custom_rivals SET team_index = ?, team_name = ?, team_name_key = ?, opponent_team_index = ?,
         opponent_name = ?, opponent_name_key = ?, rivalry_name = ?, updated_at = ?
       WHERE dynasty_id = ? AND pair_key = ?`,
      [
        input.teamIndex,
        input.teamName,
        input.teamNameKey,
        input.opponentTeamIndex,
        input.opponentName,
        input.opponentNameKey,
        input.rivalryName,
        now,
        dynastyId,
        input.pairKey,
      ],
    );
  } else {
    db.run(
      `INSERT INTO custom_rivals (dynasty_id, team_index, team_name, team_name_key, opponent_team_index,
         opponent_name, opponent_name_key, pair_key, rivalry_name, logo_file, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?)`,
      [
        dynastyId,
        input.teamIndex,
        input.teamName,
        input.teamNameKey,
        input.opponentTeamIndex,
        input.opponentName,
        input.opponentNameKey,
        input.pairKey,
        input.rivalryName,
        now,
        now,
      ],
    );
  }
  persist();
  return findByPair(dynastyId, input.pairKey);
}

/** Points a rivalry at an uploaded logo, or clears it (null). */
export function setCustomRivalLogo(dynastyId: string, pairKey: string, file: string | null): CustomRival | null {
  getDb().run('UPDATE custom_rivals SET logo_file = ?, updated_at = ? WHERE dynasty_id = ? AND pair_key = ?', [
    file,
    new Date().toISOString(),
    dynastyId,
    pairKey,
  ]);
  persist();
  return findByPair(dynastyId, pairKey);
}

/** The row for one matchup — the IPC layer reads it to find the logo file it has to delete. */
export function getCustomRival(dynastyId: string, pairKey: string): CustomRival | null {
  return findByPair(dynastyId, pairKey);
}

export function removeCustomRival(dynastyId: string, pairKey: string): void {
  getDb().run('DELETE FROM custom_rivals WHERE dynasty_id = ? AND pair_key = ?', [dynastyId, pairKey]);
  persist();
}
