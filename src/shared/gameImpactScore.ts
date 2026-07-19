import type { DefensiveGameLine, GameLogEntry, OffensiveGameLine, ScheduleGame } from './types';

/**
 * Real, counting-stat-only production score for picking a "best"/"top
 * performer" game — deliberately not the save's own gameRating field, which
 * this app treats as unreliable/not meaningful to surface (see the Player
 * Profile and Game Detail pages' game logs, which show result/score
 * instead). Same point-value shape used for Team Awards' position-adjusted
 * season scoring, applied per-game.
 */
export function gameImpactScore(entry: GameLogEntry): number {
  if (entry.category === 'offense') {
    const line = entry.line as OffensiveGameLine;
    return (
      line.passYards / 25 +
      line.passTDs * 6 -
      line.passInts * 4 +
      line.rushYards / 10 +
      line.rushTDs * 6 +
      line.receivingYards / 10 +
      line.receivingTDs * 6
    );
  }
  const line = entry.line as DefensiveGameLine;
  return (
    line.tackles * 1.0 +
    line.assistedTackles * 0.5 +
    line.tacklesForLoss * 2.0 +
    line.sacks * 4.0 +
    line.interceptions * 5.0 +
    line.forcedFumbles * 4.0 +
    line.passDeflections * 1.5
  );
}

/** "W 38-14" / "L 22-28" — null when the game hasn't been played or no schedule row was found. */
export function gameResultLine(game: ScheduleGame | undefined): string | null {
  if (!game || game.result === null || game.teamScore === null || game.opponentScore === null) return null;
  return `${game.result} ${game.teamScore}-${game.opponentScore}`;
}
