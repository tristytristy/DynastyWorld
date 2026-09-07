import crypto from 'crypto';
import type { BindParams, SqlValue } from 'sql.js';
import { compactDatabase, getDatabaseFileBytes, getDb, getDbEpoch, getReusableSpaceBytes, persist } from './init';
import { findUserTeamIndex, pickPrimaryUserCoach, type CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';
import type { SeasonOverviewCoach } from '../shared/types';

// ---- Low-level primitives -------------------------------------------------

function run(sql: string, params: BindParams = []): void {
  getDb().run(sql, params);
  persist();
}

function get<T>(sql: string, params: BindParams = []): T | undefined {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.getAsObject() as T) : undefined;
  stmt.free();
  return row;
}

function all<T>(sql: string, params: BindParams = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

/** Builds a `col = ?, col2 = ?` clause from the defined keys of a patch object. */
function buildSetClause(
  patch: Record<string, SqlValue | undefined>,
): { clause: string; values: SqlValue[] } {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
  return {
    clause: keys.map((k) => `${k} = ?`).join(', '),
    values: keys.map((k) => patch[k]!),
  };
}

// ---- Dynasties --------------------------------------------------------------

interface DynastyRow {
  id: string;
  save_path: string;
  label: string;
  team_id: number | null;
  team_name: string | null;
  team_color_primary: string | null;
  team_color_secondary: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  is_active: number;
  neutral_mode: number;
}

export interface Dynasty {
  id: string;
  savePath: string;
  label: string;
  teamId: number | null;
  teamName: string | null;
  teamColorPrimary: string | null;
  teamColorSecondary: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  isActive: boolean;
  /** Neutral observer ("commissioner") mode — the Net covers the nation with no home-team bias. See schema_v26. */
  neutralMode: boolean;
}

function mapDynasty(row: DynastyRow): Dynasty {
  return {
    id: row.id,
    savePath: row.save_path,
    label: row.label,
    teamId: row.team_id,
    teamName: row.team_name,
    teamColorPrimary: row.team_color_primary,
    teamColorSecondary: row.team_color_secondary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    notes: row.notes,
    isActive: row.is_active === 1,
    neutralMode: row.neutral_mode === 1,
  };
}

/** Flip neutral observer mode for one dynasty — see schema_v26_neutral_mode.sql. */
export function setDynastyNeutralMode(dynastyId: string, neutral: boolean): void {
  run('UPDATE dynasties SET neutral_mode = ? WHERE id = ?', [neutral ? 1 : 0, dynastyId]);
}

export interface CreateDynastyInput {
  savePath: string;
  label: string;
  teamId?: number;
  teamName?: string;
  teamColorPrimary?: string;
  teamColorSecondary?: string;
}

export function createDynasty(input: CreateDynastyInput): Dynasty {
  const id = crypto.createHash('sha1').update(input.savePath).digest('hex').slice(0, 16);
  const now = new Date().toISOString();
  run(
    `INSERT INTO dynasties
       (id, save_path, label, team_id, team_name, team_color_primary, team_color_secondary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.savePath,
      input.label,
      input.teamId ?? null,
      input.teamName ?? null,
      input.teamColorPrimary ?? null,
      input.teamColorSecondary ?? null,
      now,
      now,
    ],
  );
  return getDynastyById(id)!;
}

export function getDynasties(): Dynasty[] {
  return all<DynastyRow>('SELECT * FROM dynasties ORDER BY created_at DESC').map(mapDynasty);
}

export function getDynastyById(id: string): Dynasty | undefined {
  const row = get<DynastyRow>('SELECT * FROM dynasties WHERE id = ?', [id]);
  return row ? mapDynasty(row) : undefined;
}

export function getDynastyBySavePath(savePath: string): Dynasty | undefined {
  const row = get<DynastyRow>('SELECT * FROM dynasties WHERE save_path = ?', [savePath]);
  return row ? mapDynasty(row) : undefined;
}

export interface UpdateDynastyInput {
  label?: string;
  notes?: string | null;
  isActive?: boolean;
  teamColorPrimary?: string;
  teamColorSecondary?: string;
  savePath?: string;
  teamId?: number;
  teamName?: string;
}

export function updateDynasty(id: string, patch: UpdateDynastyInput): void {
  const { clause, values } = buildSetClause({
    label: patch.label,
    notes: patch.notes,
    is_active: patch.isActive === undefined ? undefined : patch.isActive ? 1 : 0,
    team_color_primary: patch.teamColorPrimary,
    team_color_secondary: patch.teamColorSecondary,
    save_path: patch.savePath,
    team_id: patch.teamId,
    team_name: patch.teamName,
  });
  if (!clause) return;
  run(`UPDATE dynasties SET ${clause}, updated_at = ? WHERE id = ?`, [
    ...values,
    new Date().toISOString(),
    id,
  ]);
}

/**
 * Deletes a dynasty and everything under it, and gives the disk space back.
 *
 * The row delete alone already cascades correctly to seasons, snapshots,
 * players, notes, media rows and the rest (foreign keys are enabled at open —
 * verified). What it does NOT do is shrink the file: SQLite keeps the emptied
 * pages for reuse, so before this, deleting a dynasty freed exactly zero bytes
 * as far as the user could tell. `sweepOrphanedData` is belt-and-braces for
 * anything a past build (or an out-of-app edit) left stranded, and
 * `compactDatabase` is what actually returns the space.
 */
export function deleteDynasty(id: string): void {
  // Belt-and-braces: persist() already leaves enforcement on, but a cascade
  // that silently no-ops is exactly the failure that stranded 137 MB before,
  // so the one operation that depends on it asserts for itself.
  getDb().run('PRAGMA foreign_keys = ON;');
  run('DELETE FROM dynasties WHERE id = ?', [id]);
  invalidateSnapshotCache();
  sweepOrphanedData();
  compactDatabase();
}

/** Rows whose owning dynasty no longer exists. Returns how many were removed. */
function sweepOrphanedData(): number {
  const db = getDb();
  let removed = 0;
  // Seasons first: their own cascade clears snapshots, games, awards, rankings
  // and the rest, so the per-dynasty tables below are all that's left.
  const orphanTables: [string, string][] = [
    ['seasons', 'dynasty_id'],
    ['players', 'dynasty_id'],
    ['coaches', 'dynasty_id'],
    ['recruits', 'dynasty_id'],
    ['championships', 'dynasty_id'],
    ['program_milestones', 'dynasty_id'],
    ['player_career_stats', 'dynasty_id'],
    ['player_notes', 'dynasty_id'],
    ['player_cards', 'dynasty_id'],
    ['media_items', 'dynasty_id'],
    ['team_award_results', 'dynasty_id'],
    ['team_award_settings', 'dynasty_id'],
  ];
  for (const [table, column] of orphanTables) {
    try {
      db.run(`DELETE FROM ${table} WHERE ${column} NOT IN (SELECT id FROM dynasties)`);
      removed += db.getRowsModified();
    } catch {
      // A table that doesn't exist in this schema version is not an error here.
    }
  }
  if (removed > 0) persist();
  return removed;
}

/**
 * What "Clear cache" would reclaim: snapshot payloads stranded by dynasties
 * that no longer exist, plus pages SQLite has already freed but not returned.
 *
 * Both terms are measured exactly, and both UNDER-state the real total (they
 * ignore per-row overhead outside the payload text), so the number shown to the
 * user is never a promise the cleanup fails to keep.
 */
export function getDeletedDynastyCacheBytes(): number {
  let orphanPayload = 0;
  try {
    orphanPayload = Number(
      get<{ b: number }>(
        `SELECT COALESCE(SUM(LENGTH(payload)), 0) AS b FROM season_snapshots
          WHERE season_id IN (SELECT id FROM seasons WHERE dynasty_id NOT IN (SELECT id FROM dynasties))`,
      )?.b ?? 0,
    );
  } catch {
    orphanPayload = 0;
  }
  return orphanPayload + getReusableSpaceBytes();
}

/** Removes stranded data and compacts the file. Returns bytes actually freed. */
export function clearDeletedDynastyCache(): number {
  const before = getDatabaseFileBytes();
  sweepOrphanedData();
  compactDatabase();
  return Math.max(0, before - getDatabaseFileBytes());
}

// ---- Seasons ------------------------------------------------------------

interface SeasonRow {
  id: number;
  dynasty_id: string;
  season_year: number;
  extracted_at: string;
  is_current: number;
  user_team_id: number | null;
  user_coach_id: number | null;
  final_record_wins: number | null;
  final_record_losses: number | null;
  final_record_ties: number | null;
  conference_record_wins: number | null;
  conference_record_losses: number | null;
  final_ranking_ap: number | null;
  final_ranking_coaches: number | null;
  final_ranking_cfp: number | null;
  bowl_game_name: string | null;
  bowl_result: string | null;
  conference_championship: number | null;
  national_championship: number | null;
  has_full_data: number;
  synced_week_type: string | null;
  synced_offseason_stage: number | null;
  finalized: number;
}

export interface Season {
  id: number;
  dynastyId: string;
  seasonYear: number;
  extractedAt: string;
  isCurrent: boolean;
  userTeamId: number | null;
  /** The user coach's stable Coach.PresentationId for this season — the identity anchor for tracking a coaching journey across schools/saves. Null for history-only seasons and coaches with no real id. See docs/coach-movement-research.md. */
  userCoachId: number | null;
  finalRecordWins: number | null;
  finalRecordLosses: number | null;
  finalRecordTies: number | null;
  conferenceRecordWins: number | null;
  conferenceRecordLosses: number | null;
  finalRankingAp: number | null;
  finalRankingCoaches: number | null;
  finalRankingCfp: number | null;
  bowlGameName: string | null;
  bowlResult: string | null;
  conferenceChampionship: boolean;
  nationalChampionship: boolean;
  /** False for a lightweight, backfilled "history-only" season (see schema_v4_season_history_only.sql) — no roster/schedule/stats/teams snapshot exists, only 'yearSummary'. */
  hasFullData: boolean;
  /** The calendar phase this season was last written at (SeasonInfo.CurrentWeekType); null until first written under phase-aware sync. See shared/syncPhase.ts. */
  syncedWeekType: string | null;
  /** OffSeason stage (1–9) at the last write, 0/null outside the offseason. */
  syncedOffseasonStage: number | null;
  /** True once captured at End of Season Recap (OffSeason stage 1) — locks the season against later dirty-offseason overwrites. */
  finalized: boolean;
}

function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    dynastyId: row.dynasty_id,
    seasonYear: row.season_year,
    extractedAt: row.extracted_at,
    isCurrent: row.is_current === 1,
    userTeamId: row.user_team_id,
    userCoachId: row.user_coach_id,
    finalRecordWins: row.final_record_wins,
    finalRecordLosses: row.final_record_losses,
    finalRecordTies: row.final_record_ties,
    conferenceRecordWins: row.conference_record_wins,
    conferenceRecordLosses: row.conference_record_losses,
    finalRankingAp: row.final_ranking_ap,
    finalRankingCoaches: row.final_ranking_coaches,
    finalRankingCfp: row.final_ranking_cfp,
    bowlGameName: row.bowl_game_name,
    bowlResult: row.bowl_result,
    conferenceChampionship: row.conference_championship === 1,
    nationalChampionship: row.national_championship === 1,
    hasFullData: row.has_full_data === 1,
    syncedWeekType: row.synced_week_type,
    syncedOffseasonStage: row.synced_offseason_stage,
    finalized: row.finalized === 1,
  };
}

/**
 * Records the calendar phase a season was just written at, and finalizes it once
 * captured at End of Season Recap (see shared/syncPhase.ts). `finalized` is
 * sticky — once true it stays true, so a later dirty-offseason sync can't un-lock
 * a season it also refuses to overwrite.
 */
export function updateSeasonPhase(
  seasonId: number,
  weekType: string,
  offseasonStage: number,
  finalize: boolean,
): void {
  run(
    'UPDATE seasons SET synced_week_type = ?, synced_offseason_stage = ?, finalized = CASE WHEN finalized = 1 THEN 1 ELSE ? END WHERE id = ?',
    [weekType, offseasonStage, finalize ? 1 : 0, seasonId],
  );
}

/**
 * Creates a season and, if flagged current, demotes any previously-current
 * season. userTeamId is set once at creation and never revised on a
 * same-year reimport — a real team change always means the save's own
 * season year has moved on too, so there's never a case where an existing
 * season's team needs correcting after the fact. userTeamId is null for a
 * backfilled "history-only" season (hasFullData=false) — which team the
 * user's coach was on that year genuinely isn't known without a coaches
 * snapshot, and every per-season query already treats a null userTeamId as
 * "nothing to show for this season" (see getCoaches.ts et al.), which is the
 * correct behavior here too.
 */
export function createSeason(
  dynastyId: string,
  seasonYear: number,
  userTeamId: number | null,
  userCoachId: number | null = null,
  isCurrent = true,
  hasFullData = true,
): Season {
  if (isCurrent) {
    run('UPDATE seasons SET is_current = 0 WHERE dynasty_id = ?', [dynastyId]);
  }
  run(
    'INSERT INTO seasons (dynasty_id, season_year, extracted_at, is_current, user_team_id, user_coach_id, has_full_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [dynastyId, seasonYear, new Date().toISOString(), isCurrent ? 1 : 0, userTeamId, userCoachId, hasFullData ? 1 : 0],
  );
  const row = get<SeasonRow>(
    'SELECT * FROM seasons WHERE dynasty_id = ? AND season_year = ?',
    [dynastyId, seasonYear],
  );
  return mapSeason(row!);
}

/**
 * PROMOTES A BACKFILLED HISTORY-ONLY SEASON TO A REAL ONE.
 *
 * Backfill creates a thin row for every past year the save knows about
 * (`createSeason(..., isCurrent=false, hasFullData=false)`), carrying a
 * `yearSummary` snapshot and nothing else. That was fine while such a year
 * could never be synced afterwards — but it can: import a save at 2028 and
 * 2026/2027 are backfilled, then load a 2027 save and `persistExtraction`
 * finds the existing row and writes twenty real snapshots into it.
 *
 * Nothing upgraded the row to match, and `has_full_data` had no UPDATE anywhere
 * in the codebase, so the season kept every value backfill gave it. The label
 * was the least of it: `user_team_id` stayed NULL, and NINE read paths bail out
 * on exactly that — Schedule, Standings, Rankings, Awards, Coaches, Recruits,
 * Season Overview, NCAA Hub and History all return undefined or skip the year.
 * The result was a season holding a full capture that every page refused to
 * open, permanently, with no way back.
 *
 * So this repairs the whole row rather than the flag: the team and coach the
 * capture is actually for, the current-season marker (the year being synced IS
 * the current one), and a fresh timestamp, because it has just been captured
 * for real.
 *
 * Called ONLY where the full snapshots are genuinely written — never on a
 * blocked write, which would advertise data that isn't there.
 */
export function upgradeSeasonToFull(
  seasonId: number,
  dynastyId: string,
  userTeamId: number,
  userCoachId: number | null,
): void {
  // Same demotion createSeason does for a new current season — without it the
  // dynasty would briefly have two, or none.
  run('UPDATE seasons SET is_current = 0 WHERE dynasty_id = ?', [dynastyId]);
  run(
    `UPDATE seasons
        SET has_full_data = 1,
            is_current = 1,
            user_team_id = ?,
            user_coach_id = COALESCE(?, user_coach_id),
            extracted_at = ?
      WHERE id = ?`,
    [userTeamId, userCoachId, new Date().toISOString(), seasonId],
  );
}

export function getSeasonsByDynasty(dynastyId: string): Season[] {
  return all<SeasonRow>('SELECT * FROM seasons WHERE dynasty_id = ? ORDER BY season_year DESC', [
    dynastyId,
  ]).map(mapSeason);
}

/**
 * The team the user coached that season, resolved from the season's own teams
 * snapshot via user_team_id — name + colors. Null for a history-only season (no
 * teams snapshot / null user_team_id) or if the team can't be found. This is the
 * per-season identity used for coach-journey theming and season labels: a
 * previous season resolves to the previous school, not the dynasty's current one.
 */
export function resolveSeasonTeam(
  season: Season,
): { displayName: string; primaryColorHex: string; secondaryColorHex: string } | null {
  if (season.userTeamId === null) return null;
  const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
  const team = teams.find((t) => t.teamIndex === season.userTeamId);
  if (!team) return null;
  return {
    displayName: team.displayName,
    primaryColorHex: team.primaryColorHex,
    secondaryColorHex: team.secondaryColorHex,
  };
}

/**
 * The head coach of a given team for a season, from that season's coaches
 * snapshot — for the "who coaches this program" line on any team's overview
 * (user or non-user). Prefers the HeadCoach row; falls back to the
 * user-controlled coach if a team has no resolved HeadCoach. Null when there's
 * no coaches snapshot (history-only season) or no staff for the team.
 */
export function resolveSeasonHeadCoach(season: Season, teamIndex: number): SeasonOverviewCoach | null {
  const coaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
  const staff = coaches.filter((c) => c.teamIndex === teamIndex);
  const hc = staff.find((c) => c.position === 'HeadCoach') ?? staff.find((c) => c.isUserControlled) ?? null;
  if (!hc) return null;
  return {
    firstName: hc.firstName,
    lastName: hc.lastName,
    position: hc.position,
    presentationId: hc.presentationId,
    isUserControlled: hc.isUserControlled,
    portraitAssetName: hc.portraitAssetName,
  };
}

/**
 * One-time backfill for seasons imported before user_team_id existed
 * (schema_v3_season_team.sql adds the column with no default, so every
 * pre-existing row starts NULL). Derives the historically-correct team for
 * each from that season's own already-stored 'coaches' snapshot — the exact
 * same isUserControlled+HeadCoach signal the extractor itself uses (see
 * findUserTeamIndex in extract-coaches.ts) — rather than guessing from the
 * dynasty's current team_id, which wouldn't be correct for any dynasty that
 * already changed schools before this fix shipped. Falls back to the
 * dynasty's current team only if a season's coaches snapshot is somehow
 * missing/unreadable. Called once at startup after migrations apply;
 * cheap no-op once every row has a value.
 */
export function backfillMissingSeasonTeamIds(): void {
  const rows = all<SeasonRow>('SELECT * FROM seasons WHERE user_team_id IS NULL', []);
  for (const row of rows) {
    const coaches = getSnapshot<CoachData[]>(row.id, 'coaches') ?? [];
    const derivedTeamId = findUserTeamIndex(coaches);
    const fallbackTeamId = getDynastyById(row.dynasty_id)?.teamId ?? null;
    const resolvedTeamId = derivedTeamId ?? fallbackTeamId;
    if (resolvedTeamId === null || resolvedTeamId === undefined) continue;
    run('UPDATE seasons SET user_team_id = ? WHERE id = ?', [resolvedTeamId, row.id]);
  }

  // user_coach_id (schema v8) — same idea, derived from each full-data season's
  // own coaches snapshot (the user-controlled coach's stable PresentationId).
  // History-only seasons have no coaches snapshot, so they stay NULL. A coach
  // with no real id (generated coordinators carry 0) also stays NULL.
  const coachRows = all<SeasonRow>('SELECT * FROM seasons WHERE user_coach_id IS NULL AND has_full_data = 1', []);
  for (const row of coachRows) {
    const coaches = getSnapshot<CoachData[]>(row.id, 'coaches') ?? [];
    const userCoach = pickPrimaryUserCoach(coaches, row.user_team_id ?? undefined);
    const coachId = userCoach && userCoach.presentationId ? userCoach.presentationId : null;
    if (coachId === null) continue;
    run('UPDATE seasons SET user_coach_id = ? WHERE id = ?', [coachId, row.id]);
  }
}

export function getSeasonById(id: number): Season | undefined {
  const row = get<SeasonRow>('SELECT * FROM seasons WHERE id = ?', [id]);
  return row ? mapSeason(row) : undefined;
}

export function getCurrentSeason(dynastyId: string): Season | undefined {
  const row = get<SeasonRow>('SELECT * FROM seasons WHERE dynasty_id = ? AND is_current = 1', [
    dynastyId,
  ]);
  return row ? mapSeason(row) : undefined;
}

export function getSeasonByYear(dynastyId: string, seasonYear: number): Season | undefined {
  const row = get<SeasonRow>('SELECT * FROM seasons WHERE dynasty_id = ? AND season_year = ?', [
    dynastyId,
    seasonYear,
  ]);
  return row ? mapSeason(row) : undefined;
}

// ---- Season snapshots -----------------------------------------------------

export function saveSnapshot(
  seasonId: number,
  name: string,
  payload: unknown,
  extractionVersion = '1',
): void {
  run(
    `INSERT INTO season_snapshots (season_id, name, payload, extracted_at, extraction_version)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(season_id, name) DO UPDATE SET
       payload = excluded.payload,
       extracted_at = excluded.extracted_at,
       extraction_version = excluded.extraction_version`,
    [seasonId, name, JSON.stringify(payload), new Date().toISOString(), extractionVersion],
  );
  invalidateSnapshotCache();
}

/**
 * Compressed variant for league-scale snapshots (16k+ player payloads).
 * sql.js keeps the whole database in memory and rewrites the full file on
 * every persist, so multi-MB raw JSON per season would compound badly across
 * a long dynasty — gzip+base64 keeps league snapshots to a few hundred KB
 * each (~8-10x smaller) with no schema change. The `gz:` marker lets
 * getSnapshot() transparently decompress, so readers don't care which way a
 * snapshot was written.
 */
const GZIP_MARKER = 'gz:';

export function saveSnapshotCompressed(
  seasonId: number,
  name: string,
  payload: unknown,
  extractionVersion = '1',
): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require('zlib') as typeof import('zlib');
  const compressed = GZIP_MARKER + zlib.gzipSync(JSON.stringify(payload)).toString('base64');
  run(
    `INSERT INTO season_snapshots (season_id, name, payload, extracted_at, extraction_version)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(season_id, name) DO UPDATE SET
       payload = excluded.payload,
       extracted_at = excluded.extracted_at,
       extraction_version = excluded.extraction_version`,
    [seasonId, name, compressed, new Date().toISOString(), extractionVersion],
  );
  invalidateSnapshotCache();
}

/**
 * Parsed snapshots, kept between reads.
 *
 * WHY (measured 2026-07-30). Every `getSnapshot` was a fresh gunzip + JSON.parse
 * of a whole league-scale blob, on the MAIN process's only thread — so a second
 * read of the same snapshot cost exactly as much as the first, and blocked
 * everything else while it ran. One played season's `gamelog` measures 16.5 MB
 * parsed and 721 ms; the player modal read it twice per open, and `leagueRoster`
 * is read once per season on top of that. Opening two players in a row paid the
 * whole bill twice for bytes that had not changed.
 *
 * BOUNDED, because these are large. Least-recently-used eviction over a budget
 * charged in DECOMPRESSED JSON length — the string actually handed to
 * `JSON.parse`, not the `gz:` blob sitting in the row. That distinction is the
 * whole safety of this: league snapshots are stored gzipped and expand by
 * roughly an order of magnitude, so charging the stored size would let a
 * nominally-8 MB cache pin hundreds of megabytes of live objects.
 *
 * THE BUDGET WAS SIZED BY MEASUREMENT, not taste. One season's working set for
 * the player modal is the `gamelog` (16.5 MB of JSON) plus that season's
 * `leagueRoster` and a handful of small snapshots. At 24 MB the two biggest
 * evicted each other on every open and the second player cost as much as the
 * first — 190 ms, with `getPlayerDevelopment` back at its full 64 ms. At 48 MB
 * they coexist and the second player opens in 47 ms. Anything larger buys
 * nothing for one season and only raises the ceiling on a dynasty with several.
 *
 * CORRECTNESS IS THE INVARIANT, not the hit rate. Every write path clears the
 * whole cache (see `invalidateSnapshotCache`) — a re-sync, an import, a restore
 * or a dynasty delete drops everything rather than trying to reason about which
 * entries a mutation touched. Being wrong here means showing last week's roster,
 * which is far worse than re-parsing a blob.
 */
const SNAPSHOT_CACHE_BUDGET_BYTES = 48 * 1024 * 1024;
const snapshotCache = new Map<string, { payload: unknown; bytes: number }>();
let snapshotCacheBytes = 0;
let snapshotCacheEpoch = getDbEpoch();

/**
 * Drops every cached snapshot. Called from every path that writes one — deleting
 * the lot is the only version of this that can't be subtly wrong, and the cost of
 * being wrong (serving a stale roster after a sync) is much higher than the cost
 * of re-parsing.
 */
export function invalidateSnapshotCache(): void {
  snapshotCache.clear();
  snapshotCacheBytes = 0;
}

export function getSnapshot<T = unknown>(seasonId: number, name: string): T | undefined {
  // A new database handle (first open, restore from backup, archive swap) means
  // every key now refers to a different file's rows.
  const epoch = getDbEpoch();
  if (epoch !== snapshotCacheEpoch) {
    invalidateSnapshotCache();
    snapshotCacheEpoch = epoch;
  }

  const key = `${seasonId}:${name}`;
  const cached = snapshotCache.get(key);
  if (cached) {
    // Re-insert to mark as most-recently-used — Map keeps insertion order, which
    // is what makes the first key the LRU victim below.
    snapshotCache.delete(key);
    snapshotCache.set(key, cached);
    return cached.payload as T;
  }

  const row = get<{ payload: string }>(
    'SELECT payload FROM season_snapshots WHERE season_id = ? AND name = ?',
    [seasonId, name],
  );
  if (!row) return undefined;

  let json: string;
  if (row.payload.startsWith(GZIP_MARKER)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zlib = require('zlib') as typeof import('zlib');
    json = zlib.gunzipSync(Buffer.from(row.payload.slice(GZIP_MARKER.length), 'base64')).toString('utf8');
  } else {
    json = row.payload;
  }
  const parsed = JSON.parse(json) as T;

  const bytes = json.length;
  if (bytes <= SNAPSHOT_CACHE_BUDGET_BYTES) {
    snapshotCache.set(key, { payload: parsed, bytes });
    snapshotCacheBytes += bytes;
    while (snapshotCacheBytes > SNAPSHOT_CACHE_BUDGET_BYTES && snapshotCache.size > 1) {
      const oldest = snapshotCache.keys().next().value as string;
      snapshotCacheBytes -= snapshotCache.get(oldest)?.bytes ?? 0;
      snapshotCache.delete(oldest);
    }
  }
  return parsed;
}

// ---- Ranking history --------------------------------------------------------

interface RankingHistoryRow {
  id: number;
  season_id: number;
  week: number;
  media_poll_rank: number | null;
  coaches_poll_rank: number | null;
  cfp_rank: number | null;
  wins: number | null;
  losses: number | null;
  recorded_at: string;
}

export interface RankingSnapshot {
  week: number;
  mediaPollRank: number | null;
  coachesPollRank: number | null;
  cfpRank: number | null;
  wins: number | null;
  losses: number | null;
  recordedAt: string;
}

function mapRankingSnapshot(row: RankingHistoryRow): RankingSnapshot {
  return {
    week: row.week,
    mediaPollRank: row.media_poll_rank,
    coachesPollRank: row.coaches_poll_rank,
    cfpRank: row.cfp_rank,
    wins: row.wins,
    losses: row.losses,
    recordedAt: row.recorded_at,
  };
}

export interface RecordRankingSnapshotInput {
  week: number;
  mediaPollRank: number;
  coachesPollRank: number;
  cfpRank: number;
  wins: number;
  losses: number;
}

/**
 * Upserts this import's rank snapshot for one (season, week) pair — re-importing
 * the same week corrects that week's numbers instead of duplicating a row;
 * advancing to a new week (or importing for the first time) adds a new one. This
 * is the only way a real week-by-week trend gets built, since the save itself
 * never stores more than the current/last-week/start-of-season 3 data points.
 */
export function recordRankingSnapshot(seasonId: number, input: RecordRankingSnapshotInput): void {
  run(
    `INSERT INTO ranking_history
       (season_id, week, media_poll_rank, coaches_poll_rank, cfp_rank, wins, losses, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(season_id, week) DO UPDATE SET
       media_poll_rank = excluded.media_poll_rank,
       coaches_poll_rank = excluded.coaches_poll_rank,
       cfp_rank = excluded.cfp_rank,
       wins = excluded.wins,
       losses = excluded.losses,
       recorded_at = excluded.recorded_at`,
    [
      seasonId,
      input.week,
      input.mediaPollRank,
      input.coachesPollRank,
      input.cfpRank,
      input.wins,
      input.losses,
      new Date().toISOString(),
    ],
  );
}

export function getRankingHistory(seasonId: number): RankingSnapshot[] {
  return all<RankingHistoryRow>('SELECT * FROM ranking_history WHERE season_id = ? ORDER BY week ASC', [
    seasonId,
  ]).map(mapRankingSnapshot);
}
