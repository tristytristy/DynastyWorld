import {
  getLargestTable,
  preloadAllInstances,
  resolveReference,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';
import { isGamePlayed } from '../shared/gameStatus';

/** Mirrors extract-schedule's own helper: a `tableId:rowNumber` string, null for the 0:0 non-reference. */
function refString(record: FranchiseRecord, key: string): string | null {
  const ref = record.getReferenceDataByKey(key);
  if (!ref || (ref.tableId === 0 && ref.rowNumber === 0)) return null;
  return `${ref.tableId}:${ref.rowNumber}`;
}

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
  /**
   * `SeasonGame.Stadium` as `tableId:rowNumber`, and only when the game is at a
   * venue that isn't the home team's own field — the same rule and the same
   * value extract-schedule records.
   *
   * Needed HERE, not just on the user's own schedule, because it is what
   * identifies which bowl a CFP quarterfinal or semifinal is (see
   * shared/cfpBowls.ts) and the playoff bracket is leaguewide by definition —
   * most dynasties are watching a field they aren't in.
   *
   * Absent on seasons synced before this shipped.
   */
  neutralVenueId?: string | null;
  /** CFP bracket position 0-10; null for anything that isn't a playoff game. See GameData.playoffBracketSlot. */
  playoffBracketSlot?: number | null;
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
  await teamTable.readRecords(['DisplayName', 'TeamIndex', 'Stadium']);
  const gameTable = getLargestTable(franchise, 'SeasonGame');
  await gameTable.readRecords();

  // Each team's OWN stadium, so a game's Stadium can be compared against it —
  // a venue only counts as neutral when it isn't the home team's field. Same
  // rule extract-schedule applies; kept identical so both snapshots agree.
  const stadiumRefOfTeam = new Map<number, string | null>();
  for (const rec of teamTable.records) {
    if (rec.isEmpty) continue;
    stadiumRefOfTeam.set(Number(rec.TeamIndex), refString(rec, 'Stadium'));
  }
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
    // "Played" — matching against "Played" (an early version) nulled every
    // score, so every non-user team's schedule read as all-Upcoming/0-0 even
    // for fully-completed seasons.
    //
    // `!== 'Unplayed'` replaced it and was also wrong: it counted the CFP
    // bracket's `HomeScheduled`/`Unscheduled` slots as played, and those carry
    // the previous season's scores. See shared/gameStatus.ts.
    const played = isGamePlayed(String(r.GameStatus));
    const weekType = String(r.SeasonWeekType);
    const bowlResolved = weekType !== 'RegularSeason' ? resolveReferenceWithTable(franchise, r, 'BowlGame') : null;

    const gameStadium = refString(r, 'Stadium');
    const homeStadium = stadiumRefOfTeam.get(Number(home.TeamIndex)) ?? null;
    // See GameData.playoffBracketSlot — gated on IsPlayoffBowl because an
    // ordinary bowl reports slot 0, which is a real first-round position.
    const isPlayoffBowl = bowlResolved ? String(bowlResolved.record.IsPlayoffBowl) === 'true' : false;

    games.push({
      gameId,
      week: Number(r.SeasonWeek),
      weekType,
      bowlName: bowlResolved ? String(bowlResolved.record.Name) : null,
      neutralVenueId: gameStadium && gameStadium !== homeStadium ? gameStadium : null,
      playoffBracketSlot: isPlayoffBowl ? Number(bowlResolved?.record.PlayoffBracketSlot) : null,
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
