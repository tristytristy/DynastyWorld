import { getDb, persist } from './init';
import type { PlayerNote } from '../shared/types';

/**
 * Freeform per-player notes (schema v7). User-entered data kept out of season
 * snapshots (a re-sync never touches it). Scoped by (dynastyId, playerId) so a
 * note follows the player across every season, not a single snapshot. playerId
 * is the same opaque roster/player id (PresentationId) used everywhere else.
 */

interface NoteRow {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: NoteRow): PlayerNote {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = 'id, title, body, created_at, updated_at';

/** All of a player's notes, most-recently-updated first. */
export function listPlayerNotes(dynastyId: string, playerId: number): PlayerNote[] {
  const stmt = getDb().prepare(
    `SELECT ${SELECT_COLS} FROM player_notes WHERE dynasty_id = ? AND player_id = ? ORDER BY updated_at DESC, id DESC`,
  );
  stmt.bind([dynastyId, playerId]);
  const notes: PlayerNote[] = [];
  while (stmt.step()) {
    notes.push(mapRow(stmt.getAsObject() as unknown as NoteRow));
  }
  stmt.free();
  return notes;
}

export function createPlayerNote(dynastyId: string, playerId: number, title: string, body: string): PlayerNote {
  const now = new Date().toISOString();
  const db = getDb();
  db.run('INSERT INTO player_notes (dynasty_id, player_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    dynastyId,
    playerId,
    title,
    body,
    now,
    now,
  ]);
  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();
  persist();
  return { id, title, body, createdAt: now, updatedAt: now };
}

/** Updates title + body, bumps updated_at, and returns the fresh row (null if the id is gone). */
export function updatePlayerNote(id: number, title: string, body: string): PlayerNote | null {
  const now = new Date().toISOString();
  const db = getDb();
  db.run('UPDATE player_notes SET title = ?, body = ?, updated_at = ? WHERE id = ?', [title, body, now, id]);
  persist();

  const stmt = db.prepare(`SELECT ${SELECT_COLS} FROM player_notes WHERE id = ?`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const note = mapRow(stmt.getAsObject() as unknown as NoteRow);
  stmt.free();
  return note;
}

export function deletePlayerNote(id: number): void {
  getDb().run('DELETE FROM player_notes WHERE id = ?', [id]);
  persist();
}

/**
 * Distinct note titles the user has used anywhere in this dynasty, most-recent
 * first — powers the title field's recall/auto-fill so recurring note kinds
 * ("Injury history", "Position change", "Recruiting notes") come back with one
 * keystroke instead of being retyped per player.
 */
export function listNoteTitleSuggestions(dynastyId: string): string[] {
  const stmt = getDb().prepare(
    "SELECT title, MAX(updated_at) AS mu FROM player_notes WHERE dynasty_id = ? AND TRIM(title) <> '' GROUP BY title ORDER BY mu DESC LIMIT 50",
  );
  stmt.bind([dynastyId]);
  const titles: string[] = [];
  while (stmt.step()) {
    titles.push(String((stmt.getAsObject() as { title: string }).title));
  }
  stmt.free();
  return titles;
}
