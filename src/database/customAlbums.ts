import { getDb, persist } from './init';
import type { CustomAlbum } from '../shared/types';

/**
 * Albums the user made (schema v22) — see the migration for why these are a
 * separate table from the game folders' name overrides in `media_albums`.
 *
 * User-authored, like manual_seasons and custom_rivals: a re-sync must never
 * disturb an album somebody built.
 */

interface AlbumRow {
  id: number;
  name: string;
  cover_media_id: number | null;
}

function mapRow(row: AlbumRow): CustomAlbum {
  return { id: row.id, name: row.name, coverMediaId: row.cover_media_id };
}

export function listCustomAlbums(dynastyId: string, seasonId: number): CustomAlbum[] {
  const stmt = getDb().prepare(
    'SELECT id, name, cover_media_id FROM custom_albums WHERE dynasty_id = ? AND season_id = ? ORDER BY name COLLATE NOCASE ASC',
  );
  stmt.bind([dynastyId, seasonId]);
  const out: CustomAlbum[] = [];
  while (stmt.step()) out.push(mapRow(stmt.getAsObject() as unknown as AlbumRow));
  stmt.free();
  return out;
}

/** Creates the album and returns the season's albums, so a caller refreshes in one round trip. */
export function createCustomAlbum(dynastyId: string, seasonId: number, name: string): CustomAlbum[] {
  const trimmed = name.trim();
  // An unnamed album is indistinguishable from every other unnamed album on a
  // shelf whose whole job is to be scanned.
  if (!trimmed) return listCustomAlbums(dynastyId, seasonId);
  const now = new Date().toISOString();
  getDb().run(
    'INSERT INTO custom_albums (dynasty_id, season_id, name, cover_media_id, created_at, updated_at) VALUES (?,?,?,NULL,?,?)',
    [dynastyId, seasonId, trimmed, now, now],
  );
  persist();
  return listCustomAlbums(dynastyId, seasonId);
}

export function renameCustomAlbum(dynastyId: string, seasonId: number, albumId: number, name: string): CustomAlbum[] {
  const trimmed = name.trim();
  if (trimmed) {
    getDb().run('UPDATE custom_albums SET name = ?, updated_at = ? WHERE dynasty_id = ? AND id = ?', [
      trimmed,
      new Date().toISOString(),
      dynastyId,
      albumId,
    ]);
    persist();
  }
  return listCustomAlbums(dynastyId, seasonId);
}

/**
 * Deletes the album and RELEASES its photographs — they return to the unfiled
 * pile rather than going with it.
 *
 * Deleting a container must never delete its contents when the contents are
 * files the user imported: an album is a way of arranging photographs, and
 * throwing one away is a filing decision, not a decision about the pictures.
 * The nulling happens FIRST so there is no window where a row points at an
 * album that has gone.
 */
export function removeCustomAlbum(dynastyId: string, seasonId: number, albumId: number): CustomAlbum[] {
  const db = getDb();
  db.run('UPDATE media_items SET album_id = NULL WHERE dynasty_id = ? AND album_id = ?', [dynastyId, albumId]);
  db.run('DELETE FROM custom_albums WHERE dynasty_id = ? AND id = ?', [dynastyId, albumId]);
  persist();
  return listCustomAlbums(dynastyId, seasonId);
}

/** Points an album at the photo it should show. Null goes back to "whichever is first". */
export function setCustomAlbumCover(
  dynastyId: string,
  seasonId: number,
  albumId: number,
  mediaId: number | null,
): CustomAlbum[] {
  getDb().run('UPDATE custom_albums SET cover_media_id = ?, updated_at = ? WHERE dynasty_id = ? AND id = ?', [
    mediaId,
    new Date().toISOString(),
    dynastyId,
    albumId,
  ]);
  persist();
  return listCustomAlbums(dynastyId, seasonId);
}
