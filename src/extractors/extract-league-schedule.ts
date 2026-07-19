import { getLargestTable, resolveReference, type OpenFranchise } from './lib/franchise';

/**
 * Every game in the league for the synced season — compact rows keyed by
 * team index on both sides, so any team's schedule can be reconstructed from
 * one pass (league browse expansion, 2026-07-20). Rides the same SeasonGame
 * read extract-schedule already performs (table records are cached on the
 * franchise object), so the added cost is one in-memory iteration.
 */
export interface LeagueGameData {
  gameId: number;
  week: number;
  weekType: string;
  bowlName: string | null;
  homeTeamIndex: number;
  awayTeamIndex: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
}

export async function extractLeagueSchedule(
  franchise: OpenFranchise,
  expectedRelativeYear: number,
): Promise<LeagueGameData[]> {
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords(['DisplayName', 'TeamIndex']);
  const gameTable = getLargestTable(franchise, 'SeasonGame');
  await gameTable.readRecords();

  const games: LeagueGameData[] = [];
  gameTable.records.forEach((r, gameId) => {
    if (r.isEmpty) return;
    if (Number(r.SeasonYear) !== expectedRelativeYear) return;
    const home = resolveReference(franchise, r, 'HomeTeam');
    const away = resolveReference(franchise, r, 'AwayTeam');
    if (!home || !away) return;

    const played = String(r.GameStatus) === 'Played';
    const weekType = String(r.SeasonWeekType);
    const bowlResolved = weekType !== 'RegularSeason' ? resolveReference(franchise, r, 'BowlGame') : null;

    games.push({
      gameId,
      week: Number(r.SeasonWeek),
      weekType,
      bowlName: bowlResolved ? String(bowlResolved.Name) : null,
      homeTeamIndex: Number(home.TeamIndex),
      awayTeamIndex: Number(away.TeamIndex),
      homeTeamName: String(home.DisplayName),
      awayTeamName: String(away.DisplayName),
      homeScore: played ? Number(r.HomeScore) : null,
      awayScore: played ? Number(r.AwayScore) : null,
    });
  });

  return games;
}
