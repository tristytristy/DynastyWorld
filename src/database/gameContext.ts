import { getDb, persist } from './init';
import type { GameContext } from '../shared/types';

/**
 * Point-in-time opponent context — what each team's rank and record actually
 * were around the time a game was played, rather than what they are today.
 *
 * See schema_v11_game_context.sql for why this can't be derived from the save:
 * it only ever holds current values, so the state has to be captured while it's
 * still true and then never rewritten.
 */

interface GameContextRow {
  game_id: number;
  home_media_rank: number | null;
  home_cfp_rank: number | null;
  home_wins: number | null;
  home_losses: number | null;
  away_media_rank: number | null;
  away_cfp_rank: number | null;
  away_wins: number | null;
  away_losses: number | null;
  captured_week: number | null;
  locked: number;
  captured_after_play: number;
}

/** The shape captureGameContext needs about one game and its two teams. */
export interface GameContextInput {
  gameId: number;
  /** SeasonGame.SeasonWeek — compared against the save's CurrentWeek to decide if this game is happening NOW. */
  week: number;
  played: boolean;
  home: TeamState | null;
  away: TeamState | null;
}

export interface TeamState {
  mediaPollRank: number;
  cfpRank: number;
  wins: number;
  losses: number;
}

/** A rank of 0 means unranked in the save — stored as null so the UI never prints "#0". */
function rankOrNull(rank: number | undefined): number | null {
  return rank && rank > 0 ? rank : null;
}

/**
 * Records this sync's state for every game that isn't already locked.
 *
 * Three cases, decided by the game's week against the save's CurrentWeek:
 *
 * - **This week's games** — capture NOW and lock, whether or not they read as
 *   played. Both halves of that are verified (see shared/resultsHold.ts): at
 *   CurrentWeek=W the save has already simulated week W's non-user games, but
 *   polls and records have NOT rolled forward, so what's in the save right now
 *   IS the state going into these games. Waiting for a later sync would mean
 *   locking the previous week's poll for every game except the user's own.
 * - **Future games** — capture but don't lock, so the value keeps tracking the
 *   poll as it moves week to week and ends up current at kickoff.
 * - **Past games** — the poll has already rolled. Lock whatever pre-game value
 *   we hold; if we hold none, store today's and flag it as approximate.
 *
 * A locked row is never touched again.
 *
 * @param seasonLive false in preseason/offseason, where CurrentWeek reads 0 and
 *   the "this week's games" rule would otherwise mistake ancient week-0 games
 *   for live ones.
 */
export function captureGameContext(
  seasonId: number,
  games: GameContextInput[],
  currentWeek: number,
  seasonLive: boolean,
): void {
  const db = getDb();

  const lockedIds = new Set<number>();
  const seenIds = new Set<number>();
  const existing = db.exec(`SELECT game_id, locked FROM game_context WHERE season_id = ${seasonId}`);
  for (const row of existing[0]?.values ?? []) {
    const id = Number(row[0]);
    seenIds.add(id);
    if (Number(row[1]) === 1) lockedIds.add(id);
  }

  const stmt = db.prepare(
    `INSERT INTO game_context (
       season_id, game_id,
       home_media_rank, home_cfp_rank, home_wins, home_losses,
       away_media_rank, away_cfp_rank, away_wins, away_losses,
       captured_week, locked, captured_after_play
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(season_id, game_id) DO UPDATE SET
       home_media_rank = excluded.home_media_rank,
       home_cfp_rank = excluded.home_cfp_rank,
       home_wins = excluded.home_wins,
       home_losses = excluded.home_losses,
       away_media_rank = excluded.away_media_rank,
       away_cfp_rank = excluded.away_cfp_rank,
       away_wins = excluded.away_wins,
       away_losses = excluded.away_losses,
       captured_week = excluded.captured_week,
       locked = excluded.locked`,
  );

  let wrote = 0;
  const lockStmt = db.prepare('UPDATE game_context SET locked = 1 WHERE season_id = ? AND game_id = ?');

  for (const game of games) {
    // Immutable once locked — this is the whole point of the feature.
    if (lockedIds.has(game.gameId)) continue;
    if (!game.home && !game.away) continue;

    const hasPriorCapture = seenIds.has(game.gameId);
    const isThisWeek = seasonLive && game.week === currentWeek;

    // A PAST game we already have a pre-game capture for: lock what we stored
    // and write nothing new.
    //
    // Overwriting here would be the subtle way to lose the very thing this
    // feature exists for. Sync at week W (game upcoming) then again at W+1 and
    // the W+1 poll already reflects the RESULT — beat a #7 and they may have
    // dropped to #15, so a fresh write would record #15 as "their rank when we
    // played them". Keeping the last pre-game observation means a game's own
    // outcome can never contaminate its own before-picture.
    if (!isThisWeek && game.played && hasPriorCapture) {
      lockStmt.run([seasonId, game.gameId]);
      wrote++;
      continue;
    }

    // Only a PAST game seen for the first time is genuinely approximate. A
    // current-week game reads as played (the engine pre-simulates the week) but
    // the poll hasn't moved yet, so capturing it now is exact.
    const capturedAfterPlay = !isThisWeek && game.played && !hasPriorCapture;

    stmt.run([
      seasonId,
      game.gameId,
      rankOrNull(game.home?.mediaPollRank),
      rankOrNull(game.home?.cfpRank),
      game.home?.wins ?? null,
      game.home?.losses ?? null,
      rankOrNull(game.away?.mediaPollRank),
      rankOrNull(game.away?.cfpRank),
      game.away?.wins ?? null,
      game.away?.losses ?? null,
      currentWeek,
      // This week's games lock immediately — the poll won't get any closer to
      // kickoff than it already is. Future games stay open so they keep
      // tracking the poll.
      isThisWeek || game.played ? 1 : 0,
      capturedAfterPlay ? 1 : 0,
    ]);
    wrote++;
  }
  stmt.free();
  lockStmt.free();
  if (wrote > 0) persist();
}

function mapRow(row: GameContextRow): GameContext {
  return {
    homeMediaRank: row.home_media_rank,
    homeCfpRank: row.home_cfp_rank,
    homeRecord: row.home_wins !== null ? { wins: row.home_wins, losses: row.home_losses ?? 0 } : null,
    awayMediaRank: row.away_media_rank,
    awayCfpRank: row.away_cfp_rank,
    awayRecord: row.away_wins !== null ? { wins: row.away_wins, losses: row.away_losses ?? 0 } : null,
    capturedWeek: row.captured_week,
    locked: row.locked === 1,
    /** True = "state when tracking began", NOT "state at kickoff". */
    approximate: row.captured_after_play === 1,
  };
}

/** Every captured game for a season, keyed by gameId — one query per page render. */
export function getSeasonGameContext(seasonId: number): Map<number, GameContext> {
  const out = new Map<number, GameContext>();
  try {
    const result = getDb().exec(`SELECT * FROM game_context WHERE season_id = ${seasonId}`);
    if (!result.length) return out;
    const cols = result[0].columns;
    for (const values of result[0].values) {
      const row = Object.fromEntries(cols.map((c, i) => [c, values[i]])) as unknown as GameContextRow;
      out.set(Number(row.game_id), mapRow(row));
    }
  } catch {
    // Table absent (a database older than migration 11) — callers fall back to
    // live values, which is exactly the pre-feature behaviour.
  }
  return out;
}
