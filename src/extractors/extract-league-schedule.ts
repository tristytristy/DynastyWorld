import { getLargestTable, preloadAllInstances, resolveReference, resolveReferenceWithTable, type OpenFranchise } from './lib/franchise';

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
  /*
    BowlGame must be loaded before its reference can resolve, and this extractor
    runs BEFORE extract-schedule (which does its own preload) — so every
    postseason row shipped with bowlName null and the league Schedule view fell
    back to printing the raw week bucket, e.g. "BowlSeason3" for a CFP
    Semifinal. resolveReferenceWithTable to match extract-schedule exactly.
  */
  await preloadAllInstances(franchise, 'BowlGame');

  const games: LeagueGameData[] = [];
  gameTable.records.forEach((r, gameId) => {
    if (r.isEmpty) return;
    if (Number(r.SeasonYear) !== expectedRelativeYear) return;
    const home = resolveReference(franchise, r, 'HomeTeam');
    const away = resolveReference(franchise, r, 'AwayTeam');
    if (!home || !away) return;

    // GameStatus is the winner enum ("HomeWon"/"AwayWon"), never the literal
    // "Played" — the only non-played value is "Unplayed". Matching against
    // "Played" (the previous check) nulled every score, so every non-user
    // team's schedule read as all-Upcoming/0-0 even for fully-completed
    // seasons; this mirrors extract-schedule.ts's own proven `!== 'Unplayed'`
    // convention (which is why the user's OWN schedule always worked).
    const played = String(r.GameStatus) !== 'Unplayed';
    const weekType = String(r.SeasonWeekType);
    const bowlResolved = weekType !== 'RegularSeason' ? resolveReferenceWithTable(franchise, r, 'BowlGame') : null;

    games.push({
      gameId,
      week: Number(r.SeasonWeek),
      weekType,
      bowlName: bowlResolved ? String(bowlResolved.record.Name) : null,
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
