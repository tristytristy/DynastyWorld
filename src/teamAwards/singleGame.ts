import { gameImpactScore } from '../shared/gameImpactScore';
import type {
  DefensiveGameLine,
  GameLogEntry,
  OffensiveGameLine,
  ScheduleGame,
} from '../shared/types';
import type { AwardEngineResult, CandidateScoreResult } from './types';

/**
 * Single-Game Performance of the Year (Phase 5) — structurally different from
 * every other automatic award: candidates are (player, game) pairs scored by
 * the shared per-game impact formula (shared/gameImpactScore.ts, the same
 * counting-stat score behind GameDetail's "Top performer" and the player
 * profile's "best game"), not season stat lines run through the generic
 * component engine. Each player is represented by their single best game so
 * winner/finalists stay distinct players — the shape TeamAwardResult and its
 * UI (PlayerChips keyed by playerId) already expect.
 *
 * Deliberately dropped per the original Phase 1 research: the spec's
 * "ranked opponent" context bonus and tiebreaker — no historical
 * opponent-rank-at-time-of-game data exists in the save, so opponent context
 * appears only descriptively in the explanation (opponent + result), never
 * as a scoring input.
 */

interface BestGame {
  playerId: number;
  entry: GameLogEntry;
  game: ScheduleGame | undefined;
  score: number;
}

function statlineSummary(entry: GameLogEntry): string {
  if (entry.category === 'offense') {
    const line = entry.line as OffensiveGameLine;
    const parts: string[] = [];
    if (line.passAttempts > 0) {
      parts.push(`${line.passCompletions}/${line.passAttempts} for ${line.passYards} yds, ${line.passTDs} TD passing`);
    }
    if (line.rushAttempts > 0) {
      parts.push(`${line.rushAttempts} carries for ${line.rushYards} yds, ${line.rushTDs} TD`);
    }
    if (line.receptions > 0) {
      parts.push(`${line.receptions} catches for ${line.receivingYards} yds, ${line.receivingTDs} TD`);
    }
    return parts.join('; ');
  }
  const line = entry.line as DefensiveGameLine;
  const parts: string[] = [`${line.tackles + line.assistedTackles} tackles`];
  if (line.tacklesForLoss > 0) parts.push(`${line.tacklesForLoss} TFL`);
  if (line.sacks > 0) parts.push(`${line.sacks} sacks`);
  if (line.interceptions > 0) parts.push(`${line.interceptions} INT`);
  if (line.forcedFumbles > 0) parts.push(`${line.forcedFumbles} FF`);
  if (line.passDeflections > 0) parts.push(`${line.passDeflections} PD`);
  return parts.join(', ');
}

function gameContext(game: ScheduleGame | undefined): string {
  if (!game) return 'an untracked game';
  const site = game.isHome ? 'vs' : '@';
  const result =
    game.result && game.teamScore !== null && game.opponentScore !== null
      ? ` (${game.result} ${game.teamScore}-${game.opponentScore})`
      : '';
  return `Week ${game.week} ${site} ${game.opponent}${result}`;
}

export function calculateSingleGameAward(
  entries: GameLogEntry[],
  games: ScheduleGame[],
  finalistCount: number,
): AwardEngineResult {
  const gamesById = new Map(games.map((g) => [g.gameId, g]));

  // Best single game per player — only games that actually happened (a
  // schedule row with a result) and produced positive impact count.
  const bestByPlayer = new Map<number, BestGame>();
  for (const entry of entries) {
    const game = gamesById.get(entry.gameId);
    if (!game || game.result === null) continue;
    const score = gameImpactScore(entry);
    if (score <= 0) continue;
    const current = bestByPlayer.get(entry.playerId);
    if (!current || score > current.score) {
      bestByPlayer.set(entry.playerId, { playerId: entry.playerId, entry, game, score });
    }
  }

  const ranked = [...bestByPlayer.values()].sort((a, b) => b.score - a.score || a.playerId - b.playerId);

  if (ranked.length === 0) {
    return {
      recommendedWinnerId: null,
      finalistIds: [],
      candidateScores: [],
      explanation: null,
      missingInputs: ['No played games with recorded player stats yet this season.'],
      insufficientData: true,
    };
  }

  const topScore = ranked[0].score;
  const candidateScores: CandidateScoreResult[] = ranked.map((best) => ({
    playerId: best.playerId,
    rawScore: Math.round(best.score * 10) / 10,
    normalizedScore: Math.round((best.score / topScore) * 1000) / 10,
    positionPercentile: null,
    eligibilityPassed: true,
    eligibilityReasons: [],
    components: [
      {
        key: 'singleGameImpact',
        label: 'Single-Game Impact',
        rawValue: Math.round(best.score * 10) / 10,
        normalizedValue: Math.round((best.score / topScore) * 1000) / 10,
        weight: 1,
        weightedScore: Math.round((best.score / topScore) * 1000) / 10,
      },
    ],
    missingInputs: [],
  }));

  const winner = ranked[0];
  return {
    recommendedWinnerId: winner.playerId,
    finalistIds: ranked.slice(0, finalistCount).map((b) => b.playerId),
    candidateScores,
    explanation: `${gameContext(winner.game)}: ${statlineSummary(winner.entry)}.`,
    missingInputs: [],
    insufficientData: false,
  };
}
