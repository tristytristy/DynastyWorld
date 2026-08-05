import { getDb, persist } from './init';
import { getCurrentSeason, getDynastyById, getSeasonById } from './helpers';
import { getRoster } from './getRoster';
import { getSchedule } from './getSchedule';
import type { MediaFraming, MediaItem, MediaItemPatch, MediaItemResolved, MediaTaggedPlayer } from '../shared/types';
import type { MediaLook } from '../shared/mediaLook';

/** Resolved display shape minus the absolute path — the media IPC layer adds the path (it owns the on-disk library location; see withPath in src/main/ipc/media.ts). */
export type MediaItemDisplay = Omit<MediaItemResolved, 'absolutePath'>;

/**
 * Media gallery metadata (schema v6). The files themselves live under
 * <userData>/media/<dynastyId>/ and are owned by the media IPC layer
 * (src/main/ipc/media.ts) — this module only ever touches the DB rows.
 * User-entered data: never written by persistExtraction, survives re-syncs
 * (same guarantee as team_award_results).
 */

interface MediaRow {
  id: number;
  season_id: number;
  file_name: string;
  media_type: string;
  game_id: number | null;
  album_id: number | null;
  description: string;
  player_ids_json: string;
  frame_x: number | null;
  frame_y: number | null;
  frame_scale: number | null;
  look_json: string | null;
  created_at: string;
}

/** The one column list every read uses, so a new column can't be added to three of four queries. */
const MEDIA_COLS =
  'id, season_id, file_name, media_type, game_id, album_id, description, player_ids_json, frame_x, frame_y, frame_scale, look_json, created_at';

function mapRow(row: MediaRow): MediaItem {
  let playerIds: number[] = [];
  try {
    const parsed = JSON.parse(row.player_ids_json);
    if (Array.isArray(parsed)) playerIds = parsed.filter((v): v is number => typeof v === 'number');
  } catch {
    // Corrupt tag data degrades to "no tags", never a crash.
  }
  return {
    id: row.id,
    seasonId: row.season_id,
    fileName: row.file_name,
    mediaType: row.media_type === 'video' ? 'video' : 'image',
    gameId: row.game_id,
    albumId: row.album_id,
    description: row.description,
    playerIds,
    // Scale is the presence flag: no scale, no saved framing.
    framing:
      row.frame_scale === null
        ? null
        : { x: row.frame_x ?? 0, y: row.frame_y ?? 0, scale: row.frame_scale },
    // Presentation only, so bad JSON degrades to "untreated" rather than taking
    // the photo down with it.
    look: parseLook(row.look_json),
    createdAt: row.created_at,
  };
}

function parseLook(raw: string | null): Partial<MediaLook> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<MediaLook>) : null;
  } catch {
    return null;
  }
}

export function listMediaItems(dynastyId: string, seasonId?: number): MediaItem[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const stmt = getDb().prepare(
    `SELECT ${MEDIA_COLS} FROM media_items WHERE dynasty_id = ? AND season_id = ? ORDER BY sort_order ASC, created_at DESC, id DESC`,
  );
  stmt.bind([dynastyId, season.id]);
  const items: MediaItem[] = [];
  while (stmt.step()) {
    items.push(mapRow(stmt.getAsObject() as unknown as MediaRow));
  }
  stmt.free();
  return items;
}

/**
 * Persist a user-chosen drag order for a season's media. `orderedIds` is the
 * full list of that season's item ids in the desired display order; each row's
 * sort_order becomes its index. Ignored ids not in the season are harmless.
 */
export function reorderMedia(dynastyId: string, seasonId: number, orderedIds: number[]): void {
  const db = getDb();
  orderedIds.forEach((mediaId, index) => {
    db.run('UPDATE media_items SET sort_order = ? WHERE id = ? AND dynasty_id = ? AND season_id = ?', [
      index,
      mediaId,
      dynastyId,
      seasonId,
    ]);
  });
  persist();
}

/**
 * Resolves display metadata (game label, tagged players' names/portraits)
 * against each item's OWN season's roster and schedule snapshots — items on a
 * player's bio span seasons, so per-season resolution is what keeps a
 * sophomore-year photo labeled with the sophomore-year game. Snapshot reads
 * are cached per season within one call.
 */
function resolveItems(dynastyId: string, items: MediaItem[]): MediaItemDisplay[] {
  const rosterBySeason = new Map<number, ReturnType<typeof getRoster>>();
  const scheduleBySeason = new Map<number, ReturnType<typeof getSchedule>>();

  return items.map((item) => {
    if (!rosterBySeason.has(item.seasonId)) {
      rosterBySeason.set(item.seasonId, getRoster(dynastyId, item.seasonId));
      scheduleBySeason.set(item.seasonId, getSchedule(dynastyId, item.seasonId));
    }
    const roster = rosterBySeason.get(item.seasonId) ?? undefined;
    const schedule = scheduleBySeason.get(item.seasonId) ?? undefined;

    let gameLabel: string | null = null;
    if (item.gameId !== null) {
      const game = schedule?.games.find((g) => g.gameId === item.gameId);
      if (game) {
        const score =
          game.teamScore !== null && game.opponentScore !== null
            ? ` ${game.result ?? ''} ${game.teamScore}-${game.opponentScore}`
            : '';
        gameLabel = `Wk ${game.week} ${game.isHome ? 'vs' : '@'} ${game.opponent}${score}`;
      }
    }

    const taggedPlayers: MediaTaggedPlayer[] = item.playerIds.map((playerId) => {
      const player = roster?.find((p) => p.id === playerId);
      return player
        ? {
            playerId,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
            portraitAssetName: player.portraitAssetName,
          }
        : { playerId, firstName: 'Player', lastName: `#${playerId}`, position: '', portraitAssetName: null };
    });

    return { ...item, gameLabel, taggedPlayers };
  });
}

/** Every media item this player is tagged in, across all of the dynasty's seasons, newest first — powers the Media tab on player bios. */
export function listMediaForPlayer(dynastyId: string, playerId: number): MediaItemDisplay[] {
  const stmt = getDb().prepare(
    `SELECT ${MEDIA_COLS} FROM media_items WHERE dynasty_id = ? ORDER BY created_at DESC, id DESC`,
  );
  stmt.bind([dynastyId]);
  const items: MediaItem[] = [];
  while (stmt.step()) {
    const item = mapRow(stmt.getAsObject() as unknown as MediaRow);
    if (item.playerIds.includes(playerId)) items.push(item);
  }
  stmt.free();
  return resolveItems(dynastyId, items);
}

/** Every media item linked to one game — powers the media section on the Game info page. Undefined seasonId resolves to the current season, the same convention as every other season-scoped query. */
export function listMediaForGame(dynastyId: string, seasonId: number | undefined, gameId: number): MediaItemDisplay[] {
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return [];
  const stmt = getDb().prepare(
    `SELECT ${MEDIA_COLS} FROM media_items WHERE dynasty_id = ? AND season_id = ? AND game_id = ? ORDER BY created_at DESC, id DESC`,
  );
  stmt.bind([dynastyId, season.id, gameId]);
  const items: MediaItem[] = [];
  while (stmt.step()) {
    items.push(mapRow(stmt.getAsObject() as unknown as MediaRow));
  }
  stmt.free();
  return resolveItems(dynastyId, items);
}

export function addMediaItem(
  dynastyId: string,
  seasonId: number,
  fileName: string,
  mediaType: 'image' | 'video',
): MediaItem | undefined {
  const season = getSeasonById(seasonId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const createdAt = new Date().toISOString();
  const db = getDb();
  // New uploads sort to the front (lowest order), preserving newest-first.
  db.run(
    `INSERT INTO media_items (dynasty_id, season_id, file_name, media_type, description, player_ids_json, created_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM media_items WHERE dynasty_id = ? AND season_id = ?))`,
    [dynastyId, seasonId, fileName, mediaType, '', '[]', createdAt, dynastyId, seasonId],
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();
  persist();
  return {
    id,
    seasonId,
    fileName,
    mediaType,
    gameId: null,
    albumId: null,
    description: '',
    playerIds: [],
    framing: null,
    look: null,
    createdAt,
  };
}

/**
 * A PHOTO IS FILED UNDER A GAME **OR** A CUSTOM ALBUM, never both — see
 * schema_v22. Writing both columns on every update is what enforces it: passing
 * a game clears the album and passing an album clears the game, so there is no
 * path through this function that leaves a row in two places at once.
 */
export function updateMediaItem(id: number, patch: MediaItemPatch): void {
  getDb().run('UPDATE media_items SET game_id = ?, album_id = ?, description = ?, player_ids_json = ? WHERE id = ?', [
    patch.gameId ?? null,
    // Exclusive by construction: a game means no album, an album means no game.
    patch.gameId === null ? patch.albumId ?? null : null,
    patch.description,
    JSON.stringify(patch.playerIds),
    id,
  ]);
  persist();
}

/**
 * Saves how a photo is framed, or clears it with null.
 *
 * Deliberately its own call rather than a field on `MediaItemPatch`: that patch
 * is the details FORM (game, description, tags), submitted as a unit, and
 * framing is set by dragging a photo in the viewer. Folding them together would
 * mean either the form silently rewriting a framing the user set elsewhere, or
 * the viewer having to send a whole patch it doesn't own.
 */
export function setMediaFraming(id: number, framing: MediaFraming | null): void {
  getDb().run('UPDATE media_items SET frame_x = ?, frame_y = ?, frame_scale = ? WHERE id = ?', [
    framing?.x ?? null,
    framing?.y ?? null,
    framing?.scale ?? null,
    id,
  ]);
  persist();
}

/**
 * Saves (or clears) a photo's look — its own call for the same reason framing
 * is: this is a live control surface, not the details form, and the two must
 * not overwrite each other.
 *
 * Null clears the column, which is what an untreated photo stores. See
 * schema_v16 for why one JSON column rather than a column per knob.
 */
export function setMediaLook(id: number, look: MediaLook | null): void {
  getDb().run('UPDATE media_items SET look_json = ? WHERE id = ?', [look ? JSON.stringify(look) : null, id]);
  persist();
}

/** Deletes the row and returns what the IPC layer needs to unlink the file; null if the row didn't exist. */
export function deleteMediaItem(id: number): { dynastyId: string; fileName: string } | null {
  const stmt = getDb().prepare('SELECT dynasty_id, file_name FROM media_items WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as { dynasty_id: string; file_name: string };
  stmt.free();
  getDb().run('DELETE FROM media_items WHERE id = ?', [id]);
  persist();
  return { dynastyId: row.dynasty_id, fileName: row.file_name };
}
