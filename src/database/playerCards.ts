import { getDb, persist } from './init';
import { ALL_CARD_LAYERS, DEFAULT_CARD_SCRIM } from '../shared/types';
import type {
  CardLayers,
  CardScrim,
  CardStatSource,
  PlayerCardInput,
  PlayerCardRecord,
  RosterPlayer,
} from '../shared/types';

/**
 * Saved player trading cards (schema v12). User-authored data kept out of season
 * snapshots, so a re-sync never touches a card.
 *
 * Two invariants live here rather than in the schema:
 *
 *  - **At most one default per (dynasty, player).** Promoting a card demotes its
 *    siblings in the same statement pair. See `setDefaultCard`.
 *  - **A player with any cards always has a default.** Deleting the default
 *    promotes the next one, so the hover preview can never be left with a set of
 *    cards and no answer to "which one".
 *
 * The main process owns the photo FILES (ipc/card.ts); this module only stores
 * the basename, and never touches disk.
 */

interface CardRow {
  id: number;
  player_id: number;
  season_year: number | null;
  team_name: string | null;
  player_json: string;
  stats_json: string;
  layers_json: string;
  stat_source_json: string | null;
  scrim_json: string | null;
  photo_file: string | null;
  photo_x: number;
  photo_y: number;
  photo_scale: number;
  favorite: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  'id, player_id, season_year, team_name, player_json, stats_json, layers_json, stat_source_json, scrim_json, photo_file, photo_x, photo_y, photo_scale, favorite, is_default, created_at, updated_at';

/** Parses a frozen JSON column, falling back to `fallback` rather than throwing — a card with one unreadable field is still a card. */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** A minimal stand-in so a row with a corrupt player_json still renders as *something* instead of taking the page down. */
const UNKNOWN_PLAYER: RosterPlayer = {
  id: 0,
  firstName: '',
  lastName: 'Unknown',
  portraitAssetName: null,
  position: '',
  jerseyNumber: 0,
  schoolYear: '',
  overallRating: 0,
  archetype: '',
  developmentTrait: '',
  heightInches: 0,
  weightPounds: 0,
  hometown: '',
  homeState: '',
  redshirtStatus: '',
  isCaptain: false,
};

function mapRow(row: CardRow): PlayerCardRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonYear: row.season_year,
    teamName: row.team_name,
    player: parseJson<RosterPlayer>(row.player_json, UNKNOWN_PLAYER),
    stats: parseJson<{ label: string; value: string }[]>(row.stats_json, []),
    // Merged over the all-on default rather than read whole: v13's column
    // defaults to '{}', and a card that predates it must draw with everything
    // showing, exactly as it always did.
    layers: { ...ALL_CARD_LAYERS, ...parseJson<Partial<CardLayers>>(row.layers_json, {}) },
    statSource: row.stat_source_json
      ? parseJson<CardStatSource | null>(row.stat_source_json, null)
      : null,
    photoFile: row.photo_file,
    // Resolved by the IPC layer, which is where userData lives.
    photoPath: null,
    photoTransform: { x: row.photo_x, y: row.photo_y, scale: row.photo_scale },
    // NULL means the card predates the setting, so it reads back the CURRENT
    // default rather than a number frozen at migration time — which is what
    // lets the default be retuned later for every untouched card at once.
    scrim: row.scrim_json
      ? parseJson<CardScrim>(row.scrim_json, DEFAULT_CARD_SCRIM)
      : DEFAULT_CARD_SCRIM,
    favorite: row.favorite === 1,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function queryCards(sql: string, params: (string | number)[]): PlayerCardRecord[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const cards: PlayerCardRecord[] = [];
  while (stmt.step()) {
    cards.push(mapRow(stmt.getAsObject() as unknown as CardRow));
  }
  stmt.free();
  return cards;
}

/** One card by id, or null. */
export function getPlayerCard(id: number): PlayerCardRecord | null {
  return queryCards(`SELECT ${SELECT_COLS} FROM player_cards WHERE id = ?`, [id])[0] ?? null;
}

/** Every card for one player, the default first and then oldest-made first. */
export function listPlayerCards(dynastyId: string, playerId: number): PlayerCardRecord[] {
  return queryCards(
    `SELECT ${SELECT_COLS} FROM player_cards WHERE dynasty_id = ? AND player_id = ? ORDER BY is_default DESC, id ASC`,
    [dynastyId, playerId],
  );
}

/**
 * Every FAVOURITED card in the dynasty — the card book, exactly. Ordered by
 * season, then by the player's own name, so a page reads as a set rather than in
 * the order the cards happened to be made.
 */
export function listFavoriteCards(dynastyId: string): PlayerCardRecord[] {
  return queryCards(
    `SELECT ${SELECT_COLS} FROM player_cards WHERE dynasty_id = ? AND favorite = 1 ORDER BY season_year ASC, id ASC`,
    [dynastyId],
  );
}

/** Creates a card. The player's FIRST card is automatically their default — there is nothing else it could be. */
export function createPlayerCard(
  dynastyId: string,
  playerId: number,
  input: PlayerCardInput,
): PlayerCardRecord {
  const now = new Date().toISOString();
  const db = getDb();
  const existing = listPlayerCards(dynastyId, playerId);
  db.run(
    `INSERT INTO player_cards
       (dynasty_id, player_id, season_year, team_name, player_json, stats_json, layers_json, stat_source_json,
        scrim_json, photo_file, photo_x, photo_y, photo_scale, favorite, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      dynastyId,
      playerId,
      input.seasonYear,
      input.teamName,
      JSON.stringify(input.player),
      JSON.stringify(input.stats),
      JSON.stringify(input.layers ?? ALL_CARD_LAYERS),
      input.statSource ? JSON.stringify(input.statSource) : null,
      JSON.stringify(input.scrim ?? DEFAULT_CARD_SCRIM),
      input.photoFile,
      input.photoTransform.x,
      input.photoTransform.y,
      input.photoTransform.scale,
      existing.length === 0 ? 1 : 0,
      now,
      now,
    ],
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() AS id');
  idStmt.step();
  const { id } = idStmt.getAsObject() as { id: number };
  idStmt.free();
  persist();
  return getPlayerCard(id) as PlayerCardRecord;
}

/**
 * Rewrites a card's EDITABLE content — the stat line and where it came from, the
 * layers, the photo and its framing.
 *
 * IDENTITY IS WRITE-ONCE. `season_year`, `team_name` and `player_json` are set
 * at create and never again, which is the whole of the "a card locks its year
 * and profile" rule (user direction, 2026-07-30) — enforced here rather than
 * left to the editor to remember, because the failure it prevents is silent.
 * Before this, `update` re-froze all three from whatever the app happened to be
 * showing, so opening a 2026 freshman card two seasons later and nudging the
 * zoom quietly reprinted it as a 2028 senior. Nothing in the UI would have said
 * so; the card just stopped being the card you made.
 *
 * Deliberately does NOT touch `favorite` or `is_default` either: those are flags
 * the user sets directly and an autosave of the card's artwork must not quietly
 * un-star it.
 */
export function updatePlayerCard(id: number, input: PlayerCardInput): PlayerCardRecord | null {
  const now = new Date().toISOString();
  getDb().run(
    `UPDATE player_cards
        SET stats_json = ?, layers_json = ?, stat_source_json = ?, scrim_json = ?,
            photo_file = ?, photo_x = ?, photo_y = ?, photo_scale = ?, updated_at = ?
      WHERE id = ?`,
    [
      JSON.stringify(input.stats),
      JSON.stringify(input.layers ?? ALL_CARD_LAYERS),
      input.statSource ? JSON.stringify(input.statSource) : null,
      JSON.stringify(input.scrim ?? DEFAULT_CARD_SCRIM),
      input.photoFile,
      input.photoTransform.x,
      input.photoTransform.y,
      input.photoTransform.scale,
      now,
      id,
    ],
  );
  persist();
  return getPlayerCard(id);
}

/** Stars / un-stars a card. The card book is the set of starred cards. */
export function setPlayerCardFavorite(id: number, favorite: boolean): PlayerCardRecord | null {
  getDb().run('UPDATE player_cards SET favorite = ?, updated_at = ? WHERE id = ?', [
    favorite ? 1 : 0,
    new Date().toISOString(),
    id,
  ]);
  persist();
  return getPlayerCard(id);
}

/** Makes this card the player's default, demoting the rest in the same breath. */
export function setDefaultPlayerCard(
  dynastyId: string,
  playerId: number,
  id: number,
): PlayerCardRecord[] {
  const db = getDb();
  db.run('UPDATE player_cards SET is_default = 0 WHERE dynasty_id = ? AND player_id = ?', [
    dynastyId,
    playerId,
  ]);
  db.run('UPDATE player_cards SET is_default = 1, updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    id,
  ]);
  persist();
  return listPlayerCards(dynastyId, playerId);
}

/**
 * Deletes a card and returns what's left for that player. Promotes the oldest
 * survivor if the default was the one that went, so "the player's card" always
 * resolves. Returns the deleted row's photo basename so the caller can bin the
 * file — the DB doesn't own disk.
 */
export function deletePlayerCard(id: number): {
  photoFile: string | null;
  remaining: PlayerCardRecord[];
} {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT dynasty_id, player_id, photo_file, is_default FROM player_cards WHERE id = ?',
  );
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return { photoFile: null, remaining: [] };
  }
  const row = stmt.getAsObject() as unknown as {
    dynasty_id: string;
    player_id: number;
    photo_file: string | null;
    is_default: number;
  };
  stmt.free();

  db.run('DELETE FROM player_cards WHERE id = ?', [id]);
  persist();

  let remaining = listPlayerCards(row.dynasty_id, row.player_id);
  if (row.is_default === 1 && remaining.length > 0) {
    remaining = setDefaultPlayerCard(row.dynasty_id, row.player_id, remaining[0].id);
  }
  return { photoFile: row.photo_file, remaining };
}

/**
 * Which of these players have a saved card, as a set of player ids. One query
 * for a whole roster, so a list can mark its carded players without asking per
 * row.
 */
export function listCardedPlayerIds(dynastyId: string): number[] {
  const stmt = getDb().prepare('SELECT DISTINCT player_id FROM player_cards WHERE dynasty_id = ?');
  stmt.bind([dynastyId]);
  const ids: number[] = [];
  while (stmt.step()) {
    ids.push(Number((stmt.getAsObject() as { player_id: number }).player_id));
  }
  stmt.free();
  return ids;
}
