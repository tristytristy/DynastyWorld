import { getRoster } from './getRoster';
import { getPlayerStats } from './getPlayerStats';
import { getTeamStats } from './getTeamStats';
import { getKickingStats } from './getKickingStats';
import { getSchedule } from './getSchedule';
import { getSeasonOverview } from './getSeasonOverview';
import { getSeasonsByDynasty } from './helpers';
import {
  confirmWinner,
  finalizeAwards,
  getTeamAwardResult,
  getTeamAwardResults,
  getTeamAwardSettings,
  saveCalculatedResult,
  selectManualWinner,
  unlockAwards,
} from './teamAwardsWrite';
import { AWARD_DEFINITIONS, getAwardDefinition } from '../teamAwards/awardDefinitions';
import { calculateAward } from '../teamAwards/awardEngine';
import { calculateSingleGameAward } from '../teamAwards/singleGame';
import { getGameLog } from './getGameLog';
import type { AwardCandidate, AwardTeamContext } from '../teamAwards/types';
import type {
  DefensiveStatLine,
  OffensiveStatLine,
  TeamAwardHistorySeason,
  TeamAwardHistoryWin,
  TeamAwardResult,
} from '../shared/types';

/** The awards a dynasty actually wants live right now — enabled in code AND not turned off via this dynasty's own settings. Disabling here never deletes a past result; it's only ever a filter over what getAllTeamAwardResults/finalize/unlock treat as "in play". */
function getEffectiveEnabledAwardIds(dynastyId: string): string[] {
  const settings = getTeamAwardSettings(dynastyId);
  return AWARD_DEFINITIONS.filter(
    (def) => def.enabled && !def.retired && !settings.disabledAwardIds.includes(def.id),
  ).map((def) => def.id);
}

function buildCandidates(dynastyId: string, seasonId: number): AwardCandidate[] {
  const roster = getRoster(dynastyId, seasonId) ?? [];
  const stats = getPlayerStats(dynastyId, seasonId) ?? [];
  const kickingStats = getKickingStats(dynastyId, seasonId) ?? [];
  const statsByPlayer = new Map(stats.map((s) => [s.playerId, s]));
  const kickingByPlayer = new Map(kickingStats.map((s) => [s.playerId, s]));

  return roster.map((player) => {
    const stat = statsByPlayer.get(player.id);
    return {
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      jerseyNumber: player.jerseyNumber,
      schoolYear: player.schoolYear,
      portraitAssetName: player.portraitAssetName,
      offense: stat?.category === 'offense' ? (stat.season as OffensiveStatLine | null) : null,
      defense: stat?.category === 'defense' ? (stat.season as DefensiveStatLine | null) : null,
      kicking: kickingByPlayer.get(player.id)?.season ?? null,
    };
  });
}

function buildTeamContext(dynastyId: string, seasonId: number): AwardTeamContext {
  const teamStats = getTeamStats(dynastyId, seasonId);
  if (!teamStats) {
    return {
      gamesPlayed: 0,
      offPassYards: 0,
      offRushYards: 0,
      passAttempts: 0,
      rushAttempts: 0,
      receptions: 0,
      passTds: 0,
      rushTds: 0,
      sacks: 0,
      defInts: 0,
      fumbleRec: 0,
      passDeflections: 0,
      takeaways: 0,
    };
  }
  return {
    gamesPlayed: teamStats.wins + teamStats.losses + teamStats.ties,
    offPassYards: teamStats.offPassYards,
    offRushYards: teamStats.offRushYards,
    passAttempts: teamStats.passAttempts,
    rushAttempts: teamStats.rushAttempts,
    receptions: teamStats.passCompletions,
    passTds: teamStats.passTds,
    rushTds: teamStats.rushTds,
    sacks: teamStats.sacks,
    defInts: teamStats.defInts,
    fumbleRec: teamStats.fumbleRec,
    passDeflections: teamStats.passDeflections,
    takeaways: teamStats.takeaways,
  };
}

function emptyResult(dynastyId: string, seasonId: number, awardDefinitionId: string): TeamAwardResult {
  return {
    awardDefinitionId,
    dynastyId,
    seasonId,
    recommendedWinnerId: null,
    selectedWinnerId: null,
    finalistIds: [],
    candidateScores: [],
    explanation: null,
    missingInputs: [],
    status: 'notCalculated',
    selectionMode: 'recommended',
    calculationVersion: '',
    calculatedAt: null,
    confirmedAt: null,
    finalizedAt: null,
  };
}

/** Every award's current result, including definitions that have never been calculated (returned as a synthetic 'notCalculated' row) — so the page always has one row per award to render. */
export function getAllTeamAwardResults(dynastyId: string, seasonId: number): TeamAwardResult[] {
  const existing = new Map(getTeamAwardResults(dynastyId, seasonId).map((r) => [r.awardDefinitionId, r]));
  return AWARD_DEFINITIONS.map((def) => existing.get(def.id) ?? emptyResult(dynastyId, seasonId, def.id));
}

/** True once every one of the user's own team's scheduled games this season has a real result — the real signal behind the "postseason only" calculation-timing setting, since the save exposes no explicit "season is over" flag. */
function isSeasonComplete(dynastyId: string, seasonId: number): boolean {
  const schedule = getSchedule(dynastyId, seasonId);
  if (!schedule || schedule.games.length === 0) return false;
  return schedule.games.every((game) => game.result !== null);
}

export function runTeamAwardCalculation(dynastyId: string, seasonId: number, awardDefinitionId: string): TeamAwardResult {
  const def = getAwardDefinition(awardDefinitionId);
  if (!def) throw new Error(`Unknown award "${awardDefinitionId}".`);
  if (!def.enabled) throw new Error(`Award "${def.name}" is not enabled yet: ${def.disabledReason ?? 'unavailable'}`);
  if (def.retired) throw new Error(`"${def.name}" has been retired and is no longer calculated.`);
  const settings = getTeamAwardSettings(dynastyId);
  if (settings.disabledAwardIds.includes(awardDefinitionId)) {
    throw new Error(`"${def.name}" is turned off in Team Awards settings for this dynasty.`);
  }
  if (def.calculationMode !== 'automaticWithConfirmation') {
    throw new Error(`Award "${def.name}" is manual-only and cannot be calculated.`);
  }
  if (settings.calculationTiming === 'postseasonOnly' && !isSeasonComplete(dynastyId, seasonId)) {
    throw new Error(
      `Team Awards settings are set to "Postseason Only" — this season still has unplayed games. Switch to "Allow Preliminary" in settings to calculate mid-season.`,
    );
  }
  const existing = getTeamAwardResult(dynastyId, seasonId, awardDefinitionId);
  if (existing?.status === 'finalized') {
    throw new Error(`"${def.name}" is finalized — unlock it before recalculating.`);
  }

  // Single-Game Performance runs on (player, game) pairs from the gamelog,
  // not season stat lines — its own calculation path (teamAwards/singleGame.ts).
  if (awardDefinitionId === 'singleGamePerformanceOfTheYear') {
    const gamelog = getGameLog(dynastyId, seasonId) ?? [];
    const scheduleGames = getSchedule(dynastyId, seasonId)?.games ?? [];
    const engineResult = calculateSingleGameAward(gamelog, scheduleGames, def.finalistCount);
    return saveCalculatedResult(dynastyId, seasonId, awardDefinitionId, engineResult);
  }

  const candidates = buildCandidates(dynastyId, seasonId);
  const team = buildTeamContext(dynastyId, seasonId);
  const engineResult = calculateAward(def, candidates, team);
  return saveCalculatedResult(dynastyId, seasonId, awardDefinitionId, engineResult);
}

/**
 * Re-runs every enabled, not-yet-locked-in award for a season — called after
 * a sync when the dynasty's own settings have autoRecalculate on. Only
 * touches results still in 'calculated'/'insufficientData' status; a
 * confirmed or finalized winner is a coach's decision and is never silently
 * overwritten by fresh data. Failures are swallowed per-award (logged, not
 * thrown) so one award's calculation issue never blocks the sync itself.
 */
export function autoRecalculateTeamAwards(dynastyId: string, seasonId: number): void {
  const settings = getTeamAwardSettings(dynastyId);
  if (!settings.autoRecalculate) return;

  const enabledIds = getEffectiveEnabledAwardIds(dynastyId);
  const existing = new Map(getTeamAwardResults(dynastyId, seasonId).map((r) => [r.awardDefinitionId, r]));

  for (const def of AWARD_DEFINITIONS) {
    if (!enabledIds.includes(def.id) || def.calculationMode !== 'automaticWithConfirmation') continue;
    const current = existing.get(def.id);
    if (current && current.status !== 'calculated' && current.status !== 'insufficientData') continue;
    try {
      runTeamAwardCalculation(dynastyId, seasonId, def.id);
    } catch (err) {
      console.error(`[team-awards] auto-recalculate failed for "${def.id}":`, err);
    }
  }
}

/**
 * Confirmed/finalized winners across every full-data season in the dynasty
 * archive — the "season history" view. Joins each season's own real team
 * name (not the dynasty's current one) via getSeasonOverview, so a coach's
 * award history stays attached to whichever school it was actually won at,
 * even after a later coaching change — same principle as the History page's
 * per-season team resolution. Player identity is resolved here (against that
 * exact season's own roster) rather than left to the renderer, since a
 * winner from an old season is never on the *current* roster.
 */
export function getTeamAwardHistory(dynastyId: string): TeamAwardHistorySeason[] {
  const seasons = getSeasonsByDynasty(dynastyId).filter((s) => s.hasFullData);
  const history: TeamAwardHistorySeason[] = [];

  for (const season of seasons) {
    const overview = getSeasonOverview(dynastyId, season.id);
    if (!overview) continue;
    const results = getTeamAwardResults(dynastyId, season.id).filter(
      (r) => r.status === 'confirmed' || r.status === 'finalized',
    );
    if (results.length === 0) continue;

    const roster = getRoster(dynastyId, season.id) ?? [];
    const rosterById = new Map(roster.map((p) => [p.id, p]));

    const wins = results
      .map((result): TeamAwardHistoryWin | null => {
        const def = getAwardDefinition(result.awardDefinitionId);
        const winnerId = result.selectedWinnerId ?? result.recommendedWinnerId;
        if (!def || winnerId === null) return null;
        const player = rosterById.get(winnerId);
        if (!player) return null;
        return {
          awardDefinitionId: def.id,
          awardName: def.shortName ?? def.name,
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          position: player.position,
          portraitAssetName: player.portraitAssetName,
        };
      })
      .filter((win): win is TeamAwardHistoryWin => win !== null);

    if (wins.length === 0) continue;
    history.push({ seasonId: season.id, seasonYear: season.seasonYear, teamName: overview.teamName, wins });
  }

  return history.sort((a, b) => b.seasonYear - a.seasonYear);
}

export function confirmTeamAwardWinner(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
  winnerId: number,
): TeamAwardResult {
  const def = getAwardDefinition(awardDefinitionId);
  if (!def) throw new Error(`Unknown award "${awardDefinitionId}".`);
  const existing = getTeamAwardResult(dynastyId, seasonId, awardDefinitionId);
  if (existing?.status === 'finalized') {
    throw new Error(`"${def.name}" is finalized — unlock it before changing the winner.`);
  }
  return confirmWinner(dynastyId, seasonId, awardDefinitionId, winnerId);
}

export function selectManualTeamAwardWinner(
  dynastyId: string,
  seasonId: number,
  awardDefinitionId: string,
  winnerId: number,
): TeamAwardResult {
  const def = getAwardDefinition(awardDefinitionId);
  if (!def) throw new Error(`Unknown award "${awardDefinitionId}".`);
  if (def.calculationMode !== 'manual') throw new Error(`Award "${def.name}" is not a manual-selection award.`);
  const existing = getTeamAwardResult(dynastyId, seasonId, awardDefinitionId);
  if (existing?.status === 'finalized') {
    throw new Error(`"${def.name}" is finalized — unlock it before changing the winner.`);
  }
  return selectManualWinner(dynastyId, seasonId, awardDefinitionId, winnerId);
}

/** Finalizing requires every award still "in play" for this dynasty (enabled in code, not turned off via settings) to already be confirmed — matches the spec's "Finalize Team Awards" gating. */
export function finalizeTeamAwards(dynastyId: string, seasonId: number): TeamAwardResult[] {
  const enabledIds = getEffectiveEnabledAwardIds(dynastyId);
  const results = getAllTeamAwardResults(dynastyId, seasonId).filter((r) => enabledIds.includes(r.awardDefinitionId));
  const unconfirmed = results.filter((r) => r.status !== 'confirmed');
  if (unconfirmed.length > 0) {
    throw new Error(`${unconfirmed.length} enabled award(s) are not confirmed yet — confirm every award before finalizing.`);
  }
  finalizeAwards(dynastyId, seasonId, enabledIds);
  return getAllTeamAwardResults(dynastyId, seasonId);
}

export function unlockTeamAwards(dynastyId: string, seasonId: number): TeamAwardResult[] {
  const enabledIds = getEffectiveEnabledAwardIds(dynastyId);
  unlockAwards(dynastyId, seasonId, enabledIds);
  return getAllTeamAwardResults(dynastyId, seasonId);
}
