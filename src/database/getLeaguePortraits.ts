import { getSnapshot } from './helpers';
import type { LeaguePortraitData } from '../extractors/extract-league-portraits';

/**
 * Server-side join helper, not its own IPC endpoint — every leaguewide-
 * sourced query (awards, honors) that references a `playerId` from a team
 * other than the user's own can attach a real portrait via this map instead
 * of leaving it null, since the underlying `Player` record has one same as
 * any roster player.
 */
export function getLeaguePortraitMap(seasonId: number): Map<number, string | null> {
  const rows = getSnapshot<LeaguePortraitData[]>(seasonId, 'leaguePortraits') ?? [];
  return new Map(rows.map((r) => [r.playerId, r.portraitAssetName]));
}
