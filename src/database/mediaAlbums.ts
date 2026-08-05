import { getDb, persist } from './init';
import type { MediaAlbum } from '../shared/types';

/**
 * The names a user gives their media folders (schema v21) — see the migration
 * for why this stores a NAME only and never membership, and for why the
 * "not from a game" pile needs a sentinel rather than a NULL.
 */

/** The `game_key` standing in for the "not from a game" folder. Real ids are non-negative. */
export const UNFILED_ALBUM_KEY = -1;

interface AlbumRow {
  game_key: number;
  name: string;
  cover_media_id: number | null;
}

export function listMediaAlbums(dynastyId: string, seasonId: number): MediaAlbum[] {
  const stmt = getDb().prepare(
    'SELECT game_key, name, cover_media_id FROM media_albums WHERE dynasty_id = ? AND season_id = ?',
  );
  stmt.bind([dynastyId, seasonId]);
  const out: MediaAlbum[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as AlbumRow;
    out.push({
      gameId: row.game_key === UNFILED_ALBUM_KEY ? null : row.game_key,
      name: row.name,
      coverMediaId: row.cover_media_id,
    });
  }
  stmt.free();
  return out;
}

/**
 * Names a folder, or hands it back to the game (blank name = delete the row).
 *
 * DELETING RATHER THAN STORING '' matters: a folder with no row shows the
 * game's own label, so an empty string would be a second way to say the same
 * thing and the two would eventually disagree. Clearing the box is "undo this
 * rename", not "call it nothing".
 */
export function setMediaAlbumName(
  dynastyId: string,
  seasonId: number,
  gameId: number | null,
  name: string,
): MediaAlbum[] {
  const key = gameId ?? UNFILED_ALBUM_KEY;
  const trimmed = name.trim();
  const db = getDb();
  if (!trimmed) {
    /*
      Only drop the row when there is nothing else on it. A folder can carry a
      chosen COVER as well as a name, and "use the game's name again" must not
      silently throw the cover away too — they are two independent choices that
      happen to share a row.
    */
    db.run(
      `UPDATE media_albums SET name = '' WHERE dynasty_id = ? AND season_id = ? AND game_key = ?`,
      [dynastyId, seasonId, key],
    );
    db.run(
      'DELETE FROM media_albums WHERE dynasty_id = ? AND season_id = ? AND game_key = ? AND cover_media_id IS NULL',
      [dynastyId, seasonId, key],
    );
  } else {
    db.run(
      `INSERT INTO media_albums (dynasty_id, season_id, game_key, name, updated_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(dynasty_id, season_id, game_key) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      [dynastyId, seasonId, key, trimmed, new Date().toISOString()],
    );
  }
  persist();
  return listMediaAlbums(dynastyId, seasonId);
}

/**
 * Points a GAME folder at the photo it should show, creating the row if the
 * folder has never been touched. Null goes back to "whichever is first".
 */
export function setMediaAlbumCover(
  dynastyId: string,
  seasonId: number,
  gameId: number | null,
  mediaId: number | null,
): MediaAlbum[] {
  const key = gameId ?? UNFILED_ALBUM_KEY;
  const db = getDb();
  db.run(
    `INSERT INTO media_albums (dynasty_id, season_id, game_key, name, cover_media_id, updated_at)
     VALUES (?,?,?,'',?,?)
     ON CONFLICT(dynasty_id, season_id, game_key) DO UPDATE SET cover_media_id = excluded.cover_media_id, updated_at = excluded.updated_at`,
    [dynastyId, seasonId, key, mediaId, new Date().toISOString()],
  );
  // A row that now carries neither a name nor a cover is just clutter.
  db.run(
    "DELETE FROM media_albums WHERE dynasty_id = ? AND season_id = ? AND game_key = ? AND cover_media_id IS NULL AND name = ''",
    [dynastyId, seasonId, key],
  );
  persist();
  return listMediaAlbums(dynastyId, seasonId);
}
