import { getDb, persist } from './init';
import { TEAM_AWARDS_VERSION } from '../teamAwards/calculationVersions';
import type { AwardEngineResult } from '../teamAwards/types';
import type { TeamAwardResult, TeamAwardSettings, TeamAwardStatus } from '../shared/types';

/**
 * First renderer-writable local-SQLite module in this app — every other
 * write path (editorWrite.ts) writes to the .DYNASTY save file itself and
 * re-extracts. These tables live outside season_snapshots (see
 * schema_v5_team_awards.sql) so a confirmed winner is structurally immune to
 * saveSnapshot()'s per-(season,name) overwrite on re-import, not just by
 * convention.
 */

function run(sql: string, params: (string | number | null)[] = []): void {
  getDb().run(sql, params);
  persist();
}

function get<T>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? (stmt.getAsObject() as T) : undefined;
  stmt.free();
  return row;
}

function all<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

interface TeamAwardResultRow {
  dynasty_id: string;
  season_id: number;
  award_definition_id: string;
  recommended_winner_id: number | null;
  selected_winner_id: number | null;
  finalist_ids_json: string;
  candidate_scores_json: string;
  explanation_json: string | null;
  missing_inputs_json: string;
  status: string;
  selection_mode: string;
  calculation_version: string;
  calculated_at: string | null;
  confirmed_at: string | null;
  finalized_at: string | null;
}

function mapResult(row: TeamAwardResultRow): TeamAwardResult {
  return {
    awardDefinitionId: row.award_definition_id,
    dynastyId: row.dynasty_id,
    seasonId: row.season_id,
    recommendedWinnerId: row.recommended_winner_id,
    selectedWinnerId: row.selected_winner_id,
    finalistIds: JSON.parse(row.finalist_ids_json),
    candidateScores: JSON.parse(row.candidate_scores_json),
    explanation: row.explanation_json ? (JSON.parse(row.explanation_json) as string) : null,
    missingInputs: JSON.parse(row.missing_inputs_json),
    status: row.status as TeamAwardStatus,
    selectionMode: row.selection_mode as TeamAwardResult['selectionMode'],
    calculationVersion: row.calculation_version,
    calculatedAt: row.calculated_at,
    confirmedAt: row.confirmed_at,
    finalizedAt: row.finalized_at,
  };
}

export function getTeamAwardResults(dynastyId: string, seasonId: number): TeamAwardResult[] {
  return all<TeamAwardResultRow>(
    'SELECT * FROM team_award_results WHERE dynasty_id = ? AND season_id = ?',
    [dynastyId, seasonId],
  ).map(mapResult);
}

export function getTeamAwardResult(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
): TeamAwardResult | undefined {
  const row = get<TeamAwardResultRow>(
    'SELECT * FROM team_award_results WHERE dynasty_id = ? AND season_id = ? AND award_definition_id = ?',
    [dynastyId, seasonId, awardDefinitionId],
  );
  return row ? mapResult(row) : undefined;
}

/**
 * Saves a fresh calculation. Preserves the user's confirmed/selected winner
 * when the existing row is already 'confirmed' — a re-run only refreshes the
 * recommendation and candidate scores, never the confirmed selection itself
 * (finalized rows are rejected before this is ever called — see the IPC
 * handler). This is what makes the "recommendation changed, your confirmed
 * winner was preserved" notice possible: the UI compares recommendedWinnerId
 * against selectedWinnerId itself.
 */
export function saveCalculatedResult(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
  engineResult: AwardEngineResult,
): TeamAwardResult {
  const existing = getTeamAwardResult(dynastyId, seasonId, awardDefinitionId);
  const now = new Date().toISOString();
  const preserveConfirmed = existing?.status === 'confirmed';
  const status: TeamAwardStatus = preserveConfirmed
    ? 'confirmed'
    : engineResult.insufficientData
      ? 'insufficientData'
      : 'calculated';

  run(
    `INSERT INTO team_award_results
       (dynasty_id, season_id, award_definition_id, recommended_winner_id, selected_winner_id,
        finalist_ids_json, candidate_scores_json, explanation_json, missing_inputs_json,
        status, selection_mode, calculation_version, calculated_at, confirmed_at, finalized_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dynasty_id, season_id, award_definition_id) DO UPDATE SET
       recommended_winner_id = excluded.recommended_winner_id,
       selected_winner_id = CASE WHEN team_award_results.status = 'confirmed' THEN team_award_results.selected_winner_id ELSE excluded.selected_winner_id END,
       finalist_ids_json = excluded.finalist_ids_json,
       candidate_scores_json = excluded.candidate_scores_json,
       explanation_json = excluded.explanation_json,
       missing_inputs_json = excluded.missing_inputs_json,
       status = excluded.status,
       calculation_version = excluded.calculation_version,
       calculated_at = excluded.calculated_at,
       updated_at = excluded.updated_at`,
    [
      dynastyId,
      seasonId,
      awardDefinitionId,
      engineResult.recommendedWinnerId,
      existing?.selectedWinnerId ?? null,
      JSON.stringify(engineResult.finalistIds),
      JSON.stringify(engineResult.candidateScores),
      engineResult.explanation ? JSON.stringify(engineResult.explanation) : null,
      JSON.stringify(engineResult.missingInputs),
      status,
      existing?.selectionMode ?? 'recommended',
      TEAM_AWARDS_VERSION,
      now,
      existing?.confirmedAt ?? null,
      existing?.finalizedAt ?? null,
      now,
    ],
  );

  return getTeamAwardResult(dynastyId, seasonId, awardDefinitionId)!;
}

/** Confirms a winner for an automatic award — either the recommendation itself, or an override (a different finalist, or any other eligible roster player). */
export function confirmWinner(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
  winnerId: number,
): TeamAwardResult {
  const existing = getTeamAwardResult(dynastyId, seasonId, awardDefinitionId);
  const now = new Date().toISOString();
  const selectionMode = existing?.recommendedWinnerId === winnerId ? 'recommended' : 'manuallyChanged';

  run(
    `UPDATE team_award_results
     SET selected_winner_id = ?, status = 'confirmed', selection_mode = ?, confirmed_at = ?, updated_at = ?
     WHERE dynasty_id = ? AND season_id = ? AND award_definition_id = ?`,
    [winnerId, selectionMode, now, now, dynastyId, seasonId, awardDefinitionId],
  );

  return getTeamAwardResult(dynastyId, seasonId, awardDefinitionId)!;
}

/** Manual-only awards (e.g. Newcomer of the Year) skip calculation entirely — a direct pick from the roster becomes the confirmed winner. */
export function selectManualWinner(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
  winnerId: number,
): TeamAwardResult {
  const now = new Date().toISOString();
  run(
    `INSERT INTO team_award_results
       (dynasty_id, season_id, award_definition_id, recommended_winner_id, selected_winner_id,
        finalist_ids_json, candidate_scores_json, explanation_json, missing_inputs_json,
        status, selection_mode, calculation_version, calculated_at, confirmed_at, finalized_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, '[]', '[]', NULL, '[]', 'confirmed', 'manual', ?, NULL, ?, NULL, ?)
     ON CONFLICT(dynasty_id, season_id, award_definition_id) DO UPDATE SET
       selected_winner_id = excluded.selected_winner_id,
       status = 'confirmed',
       selection_mode = 'manual',
       confirmed_at = excluded.confirmed_at,
       updated_at = excluded.updated_at`,
    [dynastyId, seasonId, awardDefinitionId, winnerId, TEAM_AWARDS_VERSION, now, now],
  );
  return getTeamAwardResult(dynastyId, seasonId, awardDefinitionId)!;
}

/** Bulk-transitions every confirmed, enabled award to finalized — awards not yet confirmed are left untouched (the caller decides whether that blocks finalizing entirely). */
export function finalizeAwards(dynastyId: string, seasonId: number, awardDefinitionIds: string[]): void {
  const now = new Date().toISOString();
  for (const id of awardDefinitionIds) {
    run(
      `UPDATE team_award_results
       SET status = 'finalized', finalized_at = ?, updated_at = ?
       WHERE dynasty_id = ? AND season_id = ? AND award_definition_id = ? AND status = 'confirmed'`,
      [now, now, dynastyId, seasonId, id],
    );
  }
}

export function unlockAwards(dynastyId: string, seasonId: number, awardDefinitionIds: string[]): void {
  const now = new Date().toISOString();
  for (const id of awardDefinitionIds) {
    run(
      `UPDATE team_award_results
       SET status = 'confirmed', finalized_at = NULL, updated_at = ?
       WHERE dynasty_id = ? AND season_id = ? AND award_definition_id = ? AND status = 'finalized'`,
      [now, dynastyId, seasonId, id],
    );
  }
}

interface TeamAwardSettingsRow {
  dynasty_id: string;
  freshman_eligibility: string;
  newcomer_eligibility: string;
  calculation_timing: string;
  auto_recalculate: number;
  disabled_award_ids_json: string;
}

const DEFAULT_SETTINGS: TeamAwardSettings = {
  freshmanEligibility: 'trueOnly',
  newcomerEligibility: 'transfersOnly',
  calculationTiming: 'postseasonOnly',
  autoRecalculate: true,
  disabledAwardIds: [],
};

export function getTeamAwardSettings(dynastyId: string): TeamAwardSettings {
  const row = get<TeamAwardSettingsRow>('SELECT * FROM team_award_settings WHERE dynasty_id = ?', [dynastyId]);
  if (!row) return DEFAULT_SETTINGS;
  return {
    freshmanEligibility: row.freshman_eligibility as TeamAwardSettings['freshmanEligibility'],
    newcomerEligibility: row.newcomer_eligibility as TeamAwardSettings['newcomerEligibility'],
    calculationTiming: row.calculation_timing as TeamAwardSettings['calculationTiming'],
    autoRecalculate: row.auto_recalculate === 1,
    disabledAwardIds: JSON.parse(row.disabled_award_ids_json),
  };
}

export function saveTeamAwardSettings(dynastyId: string, settings: TeamAwardSettings): TeamAwardSettings {
  const now = new Date().toISOString();
  run(
    `INSERT INTO team_award_settings
       (dynasty_id, freshman_eligibility, newcomer_eligibility, calculation_timing, auto_recalculate, disabled_award_ids_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dynasty_id) DO UPDATE SET
       freshman_eligibility = excluded.freshman_eligibility,
       newcomer_eligibility = excluded.newcomer_eligibility,
       calculation_timing = excluded.calculation_timing,
       auto_recalculate = excluded.auto_recalculate,
       disabled_award_ids_json = excluded.disabled_award_ids_json,
       updated_at = excluded.updated_at`,
    [
      dynastyId,
      settings.freshmanEligibility,
      settings.newcomerEligibility,
      settings.calculationTiming,
      settings.autoRecalculate ? 1 : 0,
      JSON.stringify(settings.disabledAwardIds),
      now,
    ],
  );
  return getTeamAwardSettings(dynastyId);
}
