import { getDb, persist } from './init';
import type { ProgramOverride, ProgramOverrideIdentity } from '../shared/types';

/**
 * Per-dynasty program identity and artwork (schema v15) — the user's answer to
 * a Teambuilder import that the shipped asset library has never heard of.
 *
 * User-authored data, kept out of season snapshots like player_cards and
 * media_items: a re-sync must never touch a logo somebody uploaded.
 *
 * The art FILES are owned by the IPC layer (ipc/program.ts); this module stores
 * basenames and never touches disk.
 */

interface OverrideRow {
  team_index: number;
  team_name_key: string;
  stadium_name: string | null;
  stadium_city: string | null;
  logo_file: string | null;
  helmet_file: string | null;
  jersey_file: string | null;
  polo_file: string | null;
  updated_at: string;
}

const COLS =
  'team_index, team_name_key, stadium_name, stadium_city, logo_file, helmet_file, jersey_file, polo_file, updated_at';

function mapRow(row: OverrideRow): ProgramOverride {
  return {
    teamIndex: row.team_index,
    teamNameKey: row.team_name_key,
    stadiumName: row.stadium_name,
    stadiumCity: row.stadium_city,
    // Resolved to absolute paths by the IPC layer, which is where userData lives.
    art: {
      logo: row.logo_file ? { file: row.logo_file, path: null } : null,
      helmet: row.helmet_file ? { file: row.helmet_file, path: null } : null,
      jersey: row.jersey_file ? { file: row.jersey_file, path: null } : null,
      polo: row.polo_file ? { file: row.polo_file, path: null } : null,
    },
    updatedAt: row.updated_at,
  };
}

function query(sql: string, params: (string | number)[]): ProgramOverride[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const out: ProgramOverride[] = [];
  while (stmt.step()) out.push(mapRow(stmt.getAsObject() as unknown as OverrideRow));
  stmt.free();
  return out;
}

/** Every override in a dynasty — what the renderer holds in a map for the session. */
export function listProgramOverrides(dynastyId: string): ProgramOverride[] {
  return query(`SELECT ${COLS} FROM program_overrides WHERE dynasty_id = ?`, [dynastyId]);
}

export function getProgramOverride(dynastyId: string, teamIndex: number): ProgramOverride | null {
  return (
    query(`SELECT ${COLS} FROM program_overrides WHERE dynasty_id = ? AND team_index = ?`, [
      dynastyId,
      teamIndex,
    ])[0] ?? null
  );
}

/**
 * Creates the row if this slot has never been edited. Every write goes through
 * here first so the four art setters and the identity setter don't each have to
 * carry their own upsert — and so `team_name_key` is refreshed on any edit,
 * which is what keeps name-based lookup working after a school is renamed.
 */
function ensureRow(dynastyId: string, teamIndex: number, teamNameKey: string): void {
  getDb().run(
    `INSERT INTO program_overrides (dynasty_id, team_index, team_name_key, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(dynasty_id, team_index) DO UPDATE SET
       team_name_key = excluded.team_name_key,
       updated_at = excluded.updated_at`,
    [dynastyId, teamIndex, teamNameKey, new Date().toISOString()],
  );
}

/** Stadium name and city. Empty strings are stored as null — "cleared" and "never set" are the same state. */
export function setProgramIdentity(
  dynastyId: string,
  teamIndex: number,
  teamNameKey: string,
  identity: ProgramOverrideIdentity,
): ProgramOverride | null {
  ensureRow(dynastyId, teamIndex, teamNameKey);
  getDb().run(
    'UPDATE program_overrides SET stadium_name = ?, stadium_city = ?, updated_at = ? WHERE dynasty_id = ? AND team_index = ?',
    [
      identity.stadiumName?.trim() || null,
      identity.stadiumCity?.trim() || null,
      new Date().toISOString(),
      dynastyId,
      teamIndex,
    ],
  );
  persist();
  return getProgramOverride(dynastyId, teamIndex);
}

export type ProgramArtSlot = 'logo' | 'helmet' | 'jersey' | 'polo';

const SLOT_COLUMN: Record<ProgramArtSlot, string> = {
  logo: 'logo_file',
  helmet: 'helmet_file',
  jersey: 'jersey_file',
  polo: 'polo_file',
};

/** Points one art slot at a stored file, or clears it with null. */
export function setProgramArt(
  dynastyId: string,
  teamIndex: number,
  teamNameKey: string,
  slot: ProgramArtSlot,
  file: string | null,
): ProgramOverride | null {
  ensureRow(dynastyId, teamIndex, teamNameKey);
  getDb().run(
    `UPDATE program_overrides SET ${SLOT_COLUMN[slot]} = ?, updated_at = ? WHERE dynasty_id = ? AND team_index = ?`,
    [file, new Date().toISOString(), dynastyId, teamIndex],
  );
  persist();
  return getProgramOverride(dynastyId, teamIndex);
}
