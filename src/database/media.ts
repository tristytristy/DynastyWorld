import { getDb, persist } from './init';
import { getCurrentSeason, getDynastyById, getSeasonById } from './helpers';
import { getRoster } from './getRoster';
import { getSchedule } from './getSchedule';
import type { MediaItem, MediaItemPatch, MediaItemResolved, MediaTaggedPlayer } from '../shared/types';

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
  description: string;
  player_ids_json: string;
  created_at: string;
}

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
    description: row.description,
    playerIds,
    createdAt: row.created_at,
  };
}

export function listMediaItems(dynastyId: string, seasonId?: number): MediaItem[] | undefined {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return undefined;
  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return undefined;

  const stmt = getDb().prepare(
    'SELECT id, season_id, file_name, media_type, game_id, description, player_ids_json, created_at FROM media_items WHERE dynasty_id = ? AND season_id = ? ORDER BY created_at DESC, id DESC',
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
    'SELECT id, season_id, file_name, media_type, game_id, description, player_ids_json, created_at FROM media_items WHERE dynasty_id = ? ORDER BY created_at DESC, id DESC',
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
    'SELECT id, season_id, file_name, media_type, game_id, description, player_ids_json, created_at FROM media_items WHERE dynasty_id = ? AND season_id = ? AND game_id = ? ORDER BY created_at DESC, id DESC',
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
  db.run(
    'INSERT INTO media_items (dynasty_id, season_id, file_name, media_type, description, player_ids_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [dynastyId, seasonId, fileName, mediaType, '', '[]', createdAt],
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
    description: '',
    playerIds: [],
    createdAt,
  };
}

export function updateMediaItem(id: number, patch: MediaItemPatch): void {
  getDb().run('UPDATE media_items SET game_id = ?, description = ?, player_ids_json = ? WHERE id = ?', [
    patch.gameId ?? null,
    patch.description,
    JSON.stringify(patch.playerIds),
    id,
  ]);
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
