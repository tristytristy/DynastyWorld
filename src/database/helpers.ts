import crypto from 'crypto';
import type { BindParams, SqlValue } from 'sql.js';
import { getDb, persist } from './init';
import { findUserTeamIndex, type CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';

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
  };
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

export function deleteDynasty(id: string): void {
  run('DELETE FROM dynasties WHERE id = ?', [id]);
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
  };
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
    const userCoach = coaches.find((c) => c.isUserControlled);
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
}

export function getSnapshot<T = unknown>(seasonId: number, name: string): T | undefined {
  const row = get<{ payload: string }>(
    'SELECT payload FROM season_snapshots WHERE season_id = ? AND name = ?',
    [seasonId, name],
  );
  if (!row) return undefined;
  if (row.payload.startsWith(GZIP_MARKER)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zlib = require('zlib') as typeof import('zlib');
    return JSON.parse(zlib.gunzipSync(Buffer.from(row.payload.slice(GZIP_MARKER.length), 'base64')).toString('utf8')) as T;
  }
  return JSON.parse(row.payload) as T;
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
