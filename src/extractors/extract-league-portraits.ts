import { getLargestTable, nonEmpty, type OpenFranchise } from './lib/franchise';

/**
 * Every player leaguewide has a real portrait — the same GenericHeadAssetName
 * field extract-roster.ts already reads for the user's own team, confirmed
 * directly against a real save. This is a separate, lightweight leaguewide
 * pass (playerId + portrait only, no other bio/stat fields) specifically so
 * leaguewide-sourced players (Heisman/Annual Award winners, All-America/
 * Conference selections, any other team's roster) can show a real photo
 * instead of always falling back to initials or a team logo, without
 * extracting full stats/bio data for the ~16,000 players this app has no
 * other reason to track individually.
 */
export interface LeaguePortraitData {
  playerId: number;
  portraitAssetName: string | null;
}

export async function extractLeaguePortraits(franchise: OpenFranchise): Promise<LeaguePortraitData[]> {
  const table = getLargestTable(franchise, 'Player');
  await table.readRecords(['PresentationId', 'LastName', 'GenericHeadAssetName']);
  return nonEmpty(table.records)
    .filter((r) => r.LastName)
    .map((r) => ({
      playerId: Number(r.PresentationId),
      portraitAssetName: String(r.GenericHeadAssetName || '').trim() || null,
    }));
}
