import {
  getLargestTable,
  nonEmpty,
  preloadAllInstances,
  resolveReference,
  resolveReferenceWithTable,
  type FranchiseRecord,
  type OpenFranchise,
} from './lib/franchise';
import { isGamePlayed } from '../shared/gameStatus';

/**
 * Team-level per-game box score. Field names mirror the game's own generic
 * "TeamStats" schema (also used for season/career team totals elsewhere in
 * the save) — only the per-game-relevant fields are pulled here; cumulative
 * fields that schema also carries (WINS, BOWLSMADE, etc.) don't apply to a
 * single game and are left out. POSSESSIONTIME is in seconds — confirmed by
 * summing both teams' possession time for a real game and getting exactly
 * 3600 (60:00), not just plausible-looking.
 */
export interface TeamStatLine {
  totalYards: number;
  passYards: number;
  rushYards: number;
  firstDowns: number;
  thirdDownConversions: number;
  thirdDownAttempts: number;
  fourthDownConversions: number;
  fourthDownAttempts: number;
  turnovers: number;
  takeaways: number;
  sacks: number;
  sacksAllowed: number;
  penalties: number;
  penaltyYards: number;
  possessionTimeSeconds: number;
  punts: number;
  puntYards: number;
}

export interface GameData {
  /** Row index into the (largest/real) SeasonGame table — stable within one import, used to link box scores and game logs back to this game. */
  gameId: number;
  week: number;
  status: string;
  homeTeamIndex: number | null;
  awayTeamIndex: number | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  /**
   * [Q1, Q2, Q3, Q4] — REGULATION ONLY.
   *
   * This used to say overtime was "folded into Q4 by the game itself". It
   * isn't, and that was the whole bug: on an overtime game the four quarters
   * sum to regulation and the box score's own rows then failed to reach the
   * final score. Measured on two real OT games — 7/3/7/7 with a final of 39,
   * and 3/7/10/11 with a final of 37 — where the missing 15 and 6 sit in
   * `HomeScoreOT`. Q1–Q4 plus OT hits the final exactly, both times.
   */
  homeQuarterScores: number[];
  awayQuarterScores: number[];
  /**
   * Overtime points, TOTAL across every extra period — the save keeps one
   * number per side (`HomeScoreOT`/`AwayScoreOT`), not a period-by-period
   * breakdown, so a double-overtime game can be shown as "went to overtime and
   * these points came from it" but not split into OT1 and OT2. `ScoringSummaries`
   * would be the place to recover the periods and it is a null reference on
   * every game checked.
   */
  homeScoreOvertime: number;
  awayScoreOvertime: number;
  /** The game's own flag, rather than inferring overtime from the arithmetic. */
  isOvertimeGame: boolean;
  dayOfWeek: string;
  /**
   * Renamed from the save's own "BroadcastNetwork" field, which is misleading — the
   * field only ever holds "Streaming" / "National" / "TBD" in either save file tested,
   * never an actual channel name (ESPN, FOX, etc). There is no real network-name data
   * anywhere in the save; this is a broadcast-scope/tier classification, not a channel.
   */
  broadcastScope: string;
  /** Minutes since midnight, e.g. 720 = 12:00 PM. 0 if not yet scheduled. */
  kickoffMinutes: number;
  /**
   * Calendar month/day, 0 if the game hasn't been scheduled to a real date
   * yet (true for an entire preseason save — verified 0/934 games leaguewide
   * have a date before this season starts). Assumed 1-indexed (August = 8)
   * matching normal calendar convention — unverified, since no save with
   * real dates was available to check the indexing against.
   */
  gameMonth: number;
  gameDay: number;
  /** null until the game has been played (HomeTeamStatCache/AwayTeamStatCache are unset pre-game). */
  homeTeamStats: TeamStatLine | null;
  awayTeamStats: TeamStatLine | null;
  /** SeasonWeekType != "RegularSeason" — bowl, playoff round, or national championship. */
  isBowlGame: boolean;
  isNationalChampionship: boolean;
  /**
   * Resolved via the BowlGame reference's "Name" field — this is the *display*
   * name, and it can be a rotating sponsor rebrand (e.g. "Xbox Bowl" for what's
   * actually the Bahamas Bowl this season) rather than the bowl's stable
   * identity. Null if unresolvable or not a bowl game.
   */
  bowlName: string | null;
  /**
   * The BowlGame reference's "AssetName" field — the stable underlying bowl
   * identity (e.g. "Bahamas_Bowl"), unaffected by sponsor rebrands, meant for
   * asset/logo matching rather than display. Empty/blank for the CFP bracket
   * placeholder entries (First Round/Quarterfinal/Semifinal/National
   * Championship all resolve with a blank AssetName — verified directly, not
   * assumed) — those come back as null here rather than an empty string.
   */
  bowlAssetName: string | null;
  /**
   * The CFP bracket position this game occupies, from the BowlGame record's
   * `PlayoffBracketSlot` — the save's own numbering of the eleven playoff games:
   *
   *   0-3   first round      4-7   quarterfinals
   *   8-9   semifinals        10   national championship
   *
   * This is the bracket's wiring, and it is exact: first-round slot N feeds
   * quarterfinal slot N+4; quarterfinals 4 and 7 feed semifinal 8; 5 and 6 feed
   * semifinal 9; both semifinals feed 10. Verified against every actual matchup
   * across two full postseasons.
   *
   * ROW ORDER IS NOT SLOT ORDER — the first-round BowlGame rows 7/8/9/10 carry
   * slots 3/2/1/0. Always read the field; never infer position from the order
   * games come back in.
   *
   * Null for anything that isn't a playoff game (the record's `IsPlayoffBowl`
   * is false), since a traditional bowl reports slot 0 and 0 is a real
   * first-round position. Absent on seasons synced before this shipped, where
   * the bracket is reconstructed from CFP seeds instead.
   */
  playoffBracketSlot?: number | null;
  /**
   * True for bowl/playoff games, real season-opening neutral-site games (IsKickoffGame),
   * and recurring neutral rivalries (e.g. Army-Navy) listed in ScheduleNeutralStadium.
   * Specific venue/city is NOT available anywhere in the save — the Stadium reference on
   * both SeasonGame and BowlGame points to table IDs that don't exist among any of the
   * ~2,269 tables in either save file tested (confirmed by direct scan, not assumed), so
   * only the neutral/home/away distinction can be shown, never a venue name.
   */
  isNeutralSite: boolean;
  /**
   * The save's `SeasonGame.Stadium` reference as a raw `tableId:rowNumber`
   * string, and ONLY when it differs from the home team's own stadium — i.e.
   * when this game is at a specific venue that isn't anybody's home field.
   *
   * The reference itself points outside the save (tables 16433+, the same
   * catalogue as the AD goals and rivalry trophies), so the venue's NAME can't
   * be read here. The id is stable across saves though — verified identical in
   * three unrelated files — so the renderer resolves it against a bundled
   * lookup (lib/neutralVenues.ts).
   *
   * Absent on seasons synced before this shipped.
   */
  neutralVenueId?: string | null;
}

const FIELDS = [
  'HomeTeam',
  'AwayTeam',
  'SeasonYear',
  'SeasonWeek',
  'SeasonWeekType',
  'GameStatus',
  'HomeScore',
  'AwayScore',
  'HomeScoreQuarter1',
  'HomeScoreQuarter2',
  'HomeScoreQuarter3',
  'HomeScoreQuarter4',
  'AwayScoreQuarter1',
  'AwayScoreQuarter2',
  'AwayScoreQuarter3',
  'AwayScoreQuarter4',
  'HomeScoreOT',
  'AwayScoreOT',
  'IsOvertimeGame',
  'DayOfWeek',
  'BroadcastNetwork',
  'TimeOfDay',
  'GameDateMonth',
  'GameDateDay',
  'HomeTeamStatCache',
  'AwayTeamStatCache',
  'BowlGame',
  'IsKickoffGame',
  /*
    Was MISSING, and silently, from the day `neutralVenueId` shipped: this list
    is an explicit allow-list, so `Stadium` was never loaded and
    getReferenceDataByKey returned null for every game in the league. The venue
    id was therefore ALWAYS null, and nothing looked broken because
    lib/neutralVenues.ts falls back to conference name for championships and to
    bowl asset name for bowls — which between them cover every case that has a
    venue worth naming EXCEPT the one with no fallback: a CFP quarterfinal or
    semifinal, whose BowlGame AssetName is blank. That absence is most of why
    the playoff bowls looked unrecoverable from the save.
  */
  'Stadium',
];

function mapTeamStatLine(r: FranchiseRecord): TeamStatLine {
  return {
    totalYards: Number(r.TOTALYARDS),
    passYards: Number(r.OFFPASSYARDS),
    rushYards: Number(r.OFFRUSHYARDS),
    firstDowns: Number(r.FIRSTDOWNS),
    thirdDownConversions: Number(r.THIRDDOWNCONV),
    thirdDownAttempts: Number(r.THIRDDOWNS),
    fourthDownConversions: Number(r.FOURTHDOWNCONV),
    fourthDownAttempts: Number(r.FOURTHDOWNS),
    turnovers: Number(r.GIVEAWAYS),
    takeaways: Number(r.TAKEAWAYS),
    sacks: Number(r.SACKS),
    sacksAllowed: Number(r.SACKSALLOWED),
    penalties: Number(r.PENALTIES),
    penaltyYards: Number(r.PENALTYYARDS),
    possessionTimeSeconds: Number(r.POSSESSIONTIME),
    punts: Number(r.PUNTS),
    puntYards: Number(r.PUNTYARDS),
  };
}

function resolveTeamStats(
  franchise: OpenFranchise,
  record: FranchiseRecord,
  key: string,
): TeamStatLine | null {
  const resolved = resolveReferenceWithTable(franchise, record, key);
  return resolved ? mapTeamStatLine(resolved.record) : null;
}

/**
 * Recurring neutral-site rivalries (e.g. Army-Navy) configured independently of any one
 * season, keyed by unordered team-index pair. Separate mechanism from bowl games and
 * IsKickoffGame — verified real season-opener neutral games (Clemson-Georgia, LSU-Iowa,
 * etc.) do NOT appear in this table, so all three signals are needed, not just one.
 */
async function buildNeutralSitePairs(franchise: OpenFranchise): Promise<Set<string>> {
  const table = getLargestTable(franchise, 'ScheduleNeutralStadium');
  await table.readRecords();

  const pairs = new Set<string>();
  for (const r of nonEmpty(table.records)) {
    if (String(r.IsEnabled) !== 'true') continue;
    const t1 = resolveReference(franchise, r, 'Team1');
    const t2 = resolveReference(franchise, r, 'Team2');
    if (!t1 || !t2) continue;
    pairs.add([Number(t1.TeamIndex), Number(t2.TeamIndex)].sort((a, b) => a - b).join('-'));
  }
  return pairs;
}

/**
 * SeasonGame is NOT scoped to the current season — it's a flat table that can
 * transiently hold a mix of the just-finished season's leftover bowl games
 * and the new season's not-yet-generated (or partially-generated) games right
 * at a season boundary (confirmed directly: a real save synced the moment it
 * entered a fresh preseason had 43 non-empty SeasonGame records, ALL of them
 * the prior season's completed bowl games, none for the new season). Each
 * record's own `SeasonYear` field is the fix — a 0-based relative index (0 =
 * the dynasty's first tracked season), the same convention as player
 * SeasonStats' SEAS_YEAR slots elsewhere in this codebase. Converting to an
 * absolute calendar year is `baseCalendarYear + SeasonYear`, already verified
 * exact in extract-league.ts's own doc comment (2026+3=2029, 2026+1=2027) —
 * so the caller passes the *expected* relative index for the season actually
 * being synced (`league.seasonYear - league.baseCalendarYear`) and only
 * matching games are kept. A season with no games yet (fresh preseason,
 * nothing generated) correctly comes back empty rather than borrowing the
 * prior season's leftovers.
 */
/** A reference field as a stable `tableId:rowNumber` string, or null when unset. */
function refString(record: FranchiseRecord, key: string): string | null {
  const ref = record.getReferenceDataByKey(key);
  if (!ref || (ref.tableId === 0 && ref.rowNumber === 0)) return null;
  return `${ref.tableId}:${ref.rowNumber}`;
}

export async function extractSchedule(franchise: OpenFranchise, expectedRelativeYear: number): Promise<GameData[]> {
  // HomeTeam/AwayTeam are references into the Team table — its records must be
  // loaded first, since reference resolution looks up targetTable.records[row].
  const teamTable = getLargestTable(franchise, 'Team');
  await teamTable.readRecords(['DisplayName', 'TeamIndex', 'Stadium']);

  /*
    Each team's OWN stadium reference, so a game's Stadium can be compared
    against it. Measured on a full-season save: 46 games leaguewide carry a
    Stadium reference and every one of them differs from the home team's —
    neutral-site kickoff games, Army-Navy, bowls, and the five conference
    championships played at a fixed venue. Comparing rather than just checking
    for presence costs nothing and keeps the signal honest if EA ever starts
    stamping the home stadium on ordinary games.
  */
  const stadiumRefOfTeam = new Map<number, string | null>();
  for (const rec of teamTable.records) {
    if (rec.isEmpty) continue;
    stadiumRefOfTeam.set(Number(rec.TeamIndex), refString(rec, 'Stadium'));
  }

  const gameTable = getLargestTable(franchise, 'SeasonGame');
  await gameTable.readRecords(FIELDS);

  await preloadAllInstances(franchise, 'TeamStats');
  await preloadAllInstances(franchise, 'BowlGame');
  const neutralSitePairs = await buildNeutralSitePairs(franchise);

  const games: GameData[] = [];
  gameTable.records.forEach((r, gameId) => {
    if (r.isEmpty) return;
    if (Number(r.SeasonYear) !== expectedRelativeYear) return;
    const home = resolveReference(franchise, r, 'HomeTeam');
    const away = resolveReference(franchise, r, 'AwayTeam');

    const weekType = String(r.SeasonWeekType);
    const isBowlGame = weekType !== 'RegularSeason';
    const isNationalChampionship = weekType === 'NationalChampionship';

    const bowlResolved = resolveReferenceWithTable(franchise, r, 'BowlGame');
    const bowlName = bowlResolved ? String(bowlResolved.record.Name) : null;
    const bowlAssetNameRaw = bowlResolved ? String(bowlResolved.record.AssetName) : '';
    const bowlAssetName = bowlAssetNameRaw ? bowlAssetNameRaw : null;

    // Gated on IsPlayoffBowl because a traditional bowl reports slot 0, and 0 is
    // a real first-round position — reading the number unconditionally would
    // make every ordinary bowl look like a playoff game.
    const isPlayoffBowl = bowlResolved ? String(bowlResolved.record.IsPlayoffBowl) === 'true' : false;
    const playoffBracketSlot = isPlayoffBowl ? Number(bowlResolved?.record.PlayoffBracketSlot) : null;

    const pairKey =
      home && away ? [Number(home.TeamIndex), Number(away.TeamIndex)].sort((a, b) => a - b).join('-') : null;

    // A venue that isn't the home team's own field. This is what finally makes
    // conference championships honest: five of the ten are at a fixed neutral
    // site and five are hosted by a qualifying team, and the save says which is
    // which per game — previously every one of them claimed the home stadium.
    const gameStadium = refString(r, 'Stadium');
    const homeStadium = home ? stadiumRefOfTeam.get(Number(home.TeamIndex)) ?? null : null;
    const neutralVenueId = gameStadium && gameStadium !== homeStadium ? gameStadium : null;

    /*
      Postseason games are neutral-site by default, with one real exception: a
      CFP FIRST-ROUND game is played on the higher seed's campus, and the save
      says so by giving it no Stadium reference at all while every other bowl
      gets one. Without this the app labelled those "Neutral Site" and refused
      to name the host's stadium — the same class of error as the conference
      championships, pointing the other way.

      Scoped to the first round specifically rather than "any bowl missing a
      venue", because a bowl whose matchup isn't set yet also has no reference
      and must not be reported as a home game for whoever is penciled in.
    */
    const isCfpFirstRound = bowlName === 'CFP First Round';
    const isNeutralSite =
      (isBowlGame && !(isCfpFirstRound && neutralVenueId === null)) ||
      String(r.IsKickoffGame) === 'true' ||
      neutralVenueId !== null ||
      (pairKey !== null && neutralSitePairs.has(pairKey));

    /*
      An unresolved CFP bracket slot carries the PREVIOUS season's score and a
      full stat line, which the game never clears — see shared/gameStatus.ts.
      They're dropped at the source rather than left in the snapshot to be
      filtered correctly at every one of ~20 read sites forever.
    */
    const played = isGamePlayed(String(r.GameStatus));
    const score = (key: string) => (played ? Number(r[key]) : 0);

    games.push({
      gameId,
      week: Number(r.SeasonWeek),
      status: String(r.GameStatus),
      homeTeamIndex: home ? Number(home.TeamIndex) : null,
      awayTeamIndex: away ? Number(away.TeamIndex) : null,
      homeTeamName: home ? String(home.DisplayName) : null,
      awayTeamName: away ? String(away.DisplayName) : null,
      homeScore: score('HomeScore'),
      awayScore: score('AwayScore'),
      homeQuarterScores: [
        score('HomeScoreQuarter1'),
        score('HomeScoreQuarter2'),
        score('HomeScoreQuarter3'),
        score('HomeScoreQuarter4'),
      ],
      awayQuarterScores: [
        score('AwayScoreQuarter1'),
        score('AwayScoreQuarter2'),
        score('AwayScoreQuarter3'),
        score('AwayScoreQuarter4'),
      ],
      homeScoreOvertime: score('HomeScoreOT') || 0,
      awayScoreOvertime: score('AwayScoreOT') || 0,
      isOvertimeGame: played && String(r.IsOvertimeGame) === 'true',
      dayOfWeek: String(r.DayOfWeek),
      broadcastScope: String(r.BroadcastNetwork),
      kickoffMinutes: Number(r.TimeOfDay),
      gameMonth: Number(r.GameDateMonth),
      gameDay: Number(r.GameDateDay),
      homeTeamStats: played ? resolveTeamStats(franchise, r, 'HomeTeamStatCache') : null,
      awayTeamStats: played ? resolveTeamStats(franchise, r, 'AwayTeamStatCache') : null,
      isBowlGame,
      isNationalChampionship,
      neutralVenueId,
      bowlName,
      bowlAssetName,
      playoffBracketSlot,
      isNeutralSite,
    });
  });
  return games;
}
