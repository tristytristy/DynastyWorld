import { getAllLeaguePlayers } from './getLeagueRoster';
import type { DefensiveStatLine, NationalLeaderEntry, NationalStatLeaders, OffensiveStatLine } from '../shared/types';

const FCS_POOL_TEAM_INDEX = 255;
const TOP_N = 100;

/**
 * National player-stat leaderboards for the NCAA Hub Statistics page — the top
 * TOP_N players in the country per category, computed SERVER-SIDE so only ~100
 * rows per category cross IPC instead of the whole ~16k-player league roster.
 * Reuses getAllLeaguePlayers (the same league snapshot the national Players page
 * uses); each category is that season's stat-holders sorted by the category's
 * headline stat. Passing/Rushing/Receiving all draw from the one offensive stat
 * line (a player's line carries all three); Defense from the defensive line.
 */
export function getNationalStatLeaders(dynastyId: string, seasonId?: number): NationalStatLeaders | null {
  const players = getAllLeaguePlayers(dynastyId, seasonId);
  if (!players) return null;

  const withStat = players.filter(
    (p) => p.seasonStat?.season != null && p.teamIndex !== FCS_POOL_TEAM_INDEX,
  );

  const toEntry = (p: (typeof withStat)[number]): NationalLeaderEntry => {
    const stat = p.seasonStat!;
    return {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      jerseyNumber: p.jerseyNumber,
      schoolYear: p.schoolYear,
      portraitAssetName: p.portraitAssetName,
      teamName: p.teamDisplayName,
      teamIndex: p.teamIndex,
      offense: stat.category === 'offense' ? (stat.season as OffensiveStatLine) : null,
      defense: stat.category === 'defense' ? (stat.season as DefensiveStatLine) : null,
    };
  };

  const offense = withStat.filter((p) => p.seasonStat!.category === 'offense').map(toEntry);
  const defense = withStat.filter((p) => p.seasonStat!.category === 'defense').map(toEntry);

  const topBy = (list: NationalLeaderEntry[], value: (e: NationalLeaderEntry) => number) =>
    [...list]
      .filter((e) => value(e) > 0)
      .sort((a, b) => value(b) - value(a))
      .slice(0, TOP_N);

  return {
    passing: topBy(offense, (e) => e.offense?.passYards ?? 0),
    rushing: topBy(offense, (e) => e.offense?.rushYards ?? 0),
    receiving: topBy(offense, (e) => e.offense?.receivingYards ?? 0),
    defense: topBy(defense, (e) => e.defense?.tackles ?? 0),
  };
}
