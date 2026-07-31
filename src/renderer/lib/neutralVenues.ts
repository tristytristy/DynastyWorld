/**
 * Where a game is played when it isn't at somebody's home field.
 *
 * THREE WAYS IN, in decreasing order of certainty. The first is the save's own
 * answer; the other two exist because the first can never reach data that is
 * already imported.
 *
 *   1. `neutralVenueId` — the save's `SeasonGame.Stadium` reference. Exact, and
 *      it FOLLOWS the save: move a championship to a different venue in-game
 *      and the id moves with it. Only present on seasons synced after that
 *      extraction shipped.
 *
 *   2. Conference name, for a conference championship.
 *   3. Bowl asset name, for a bowl.
 *
 * WHY 2 AND 3 ARE NOT OPTIONAL. A dynasty's past seasons can never be
 * re-synced — the save has long since moved past week 16 of 2026, and there is
 * no way to regenerate that state. An id-only design therefore leaves every
 * championship already sitting in someone's archive permanently wrong, showing
 * the nominal home team's stadium (the Big Ten title game at Ohio Stadium
 * rather than Lucas Oil). Conference and bowl names are on the OLD snapshots
 * too, so these two paths repair history without a re-sync.
 *
 * The id still wins when present, so an in-game venue move is respected and
 * these stay a floor rather than a ceiling.
 *
 * The venue names are not in the save — `SeasonGame.Stadium` points at tables
 * 16433/16434/16437, outside the file, and the in-save Stadium table is empty.
 * They're supplied here, exactly as stadiumData.ts supplies home stadiums, and
 * `StadiumDataProvider` layers user overrides over the top of both.
 */

export interface NeutralVenue {
  stadium: string;
  city: string;
  state: string;
}

const V = {
  allegiant: { stadium: 'Allegiant Stadium', city: 'Las Vegas', state: 'NV' },
  alamodome: { stadium: 'Alamodome', city: 'San Antonio', state: 'TX' },
  albertsons: { stadium: 'Albertsons Stadium', city: 'Boise', state: 'ID' },
  amonCarter: { stadium: 'Amon G. Carter Stadium', city: 'Fort Worth', state: 'TX' },
  arizona: { stadium: 'Arizona Stadium', city: 'Tucson', state: 'AZ' },
  att: { stadium: 'AT&T Stadium', city: 'Arlington', state: 'TX' },
  bankOfAmerica: { stadium: 'Bank of America Stadium', city: 'Charlotte', state: 'NC' },
  brooks: { stadium: 'Brooks Stadium', city: 'Conway', state: 'SC' },
  campingWorld: { stadium: 'Camping World Stadium', city: 'Orlando', state: 'FL' },
  chaseField: { stadium: 'Chase Field', city: 'Phoenix', state: 'AZ' },
  ching: { stadium: 'Clarence T.C. Ching Complex', city: 'Honolulu', state: 'HI' },
  cramton: { stadium: 'Cramton Bowl', city: 'Montgomery', state: 'AL' },
  everbank: { stadium: 'EverBank Stadium', city: 'Jacksonville', state: 'FL' },
  fauStadium: { stadium: 'FAU Stadium', city: 'Boca Raton', state: 'FL' },
  fenway: { stadium: 'Fenway Park', city: 'Boston', state: 'MA' },
  fordField: { stadium: 'Ford Field', city: 'Detroit', state: 'MI' },
  geraldFord: { stadium: 'Gerald J. Ford Stadium', city: 'Dallas', state: 'TX' },
  hancockWhitney: { stadium: 'Hancock Whitney Stadium', city: 'Mobile', state: 'AL' },
  independence: { stadium: 'Independence Stadium', city: 'Shreveport', state: 'LA' },
  lucasOil: { stadium: 'Lucas Oil Stadium', city: 'Indianapolis', state: 'IN' },
  mercedesBenz: { stadium: 'Mercedes-Benz Stadium', city: 'Atlanta', state: 'GA' },
  navyMarine: { stadium: 'Navy-Marine Corps Memorial Stadium', city: 'Annapolis', state: 'MD' },
  nissan: { stadium: 'Nissan Stadium', city: 'Nashville', state: 'TN' },
  nrg: { stadium: 'NRG Stadium', city: 'Houston', state: 'TX' },
  protective: { stadium: 'Protective Stadium', city: 'Birmingham', state: 'AL' },
  raymondJames: { stadium: 'Raymond James Stadium', city: 'Tampa', state: 'FL' },
  simmonsBank: { stadium: 'Simmons Bank Liberty Stadium', city: 'Memphis', state: 'TN' },
  snapdragon: { stadium: 'Snapdragon Stadium', city: 'San Diego', state: 'CA' },
  sunBowl: { stadium: 'Sun Bowl Stadium', city: 'El Paso', state: 'TX' },
  superdome: { stadium: 'Caesars Superdome', city: 'New Orleans', state: 'LA' },
  thomasRobinson: { stadium: 'Thomas Robinson Stadium', city: 'Nassau', state: 'Bahamas' },
  toyota: { stadium: 'Toyota Stadium', city: 'Frisco', state: 'TX' },
  universityStadium: { stadium: 'University Stadium', city: 'Albuquerque', state: 'NM' },
} as const satisfies Record<string, NeutralVenue>;

/**
 * By the save's own venue reference. Ids are stable — verified byte-identical
 * across three unrelated saves — and several are confirmed by the same id
 * appearing somewhere independent: 16433:99895 is the SEC Championship, a CFP
 * Quarterfinal AND a week-1 neutral kickoff (all Mercedes-Benz); 16434:85072 is
 * the Armed Forces Bowl and is also TCU's own home-stadium id.
 */
const VENUE_BY_SAVE_ID: Record<string, NeutralVenue> = {
  '16433:105920': V.nissan,
  '16433:105934': V.nrg,
  '16433:105985': V.everbank,
  '16433:99763': V.bankOfAmerica,
  '16433:99791': V.superdome,
  '16433:99792': V.att,
  '16433:99895': V.mercedesBenz,
  '16434:85067': V.alamodome,
  '16434:85072': V.amonCarter,
  '16434:85074': V.arizona,
  '16434:85088': V.albertsons,
  '16434:85115': V.fauStadium,
  '16434:85121': V.fordField,
  '16434:85129': V.geraldFord,
  '16434:85137': V.independence,
  '16434:85154': V.hancockWhitney,
  '16434:85158': V.simmonsBank,
  '16434:85165': V.lucasOil,
  '16434:85186': V.navyMarine,
  '16434:85203': V.raymondJames,
  '16434:85219': V.allegiant,
  '16434:85223': V.snapdragon,
  '16434:85237': V.sunBowl,
  '16434:85244': V.protective,
  '16434:85250': V.universityStadium,
  '16435:129082': V.brooks,
  '16437:18160': V.thomasRobinson,
  '16437:18173': V.toyota,
  '16437:18191': V.ching,
  '16437:18192': V.cramton,
  '16437:18194': V.chaseField,
  '16437:18195': V.fenway,
  '16437:18197': V.campingWorld,
};

/**
 * Conference championship venues, for seasons imported before the venue
 * reference was extracted.
 *
 * `null` means HOSTED — the higher seed's own stadium, which is the correct
 * answer for those five and must be recorded explicitly rather than left out.
 * A missing key means "we have no opinion", and those two are not the same
 * thing: a conference we don't recognise should fall through, a conference we
 * know is hosted should stop the lookup and let the host's stadium stand.
 *
 * The neutral/hosted split is READ FROM THE SAVE (`Conference.ChampionshipStadium`,
 * populated for exactly these five and empty for the other five) — not from
 * real-world recall. Keys cover the save's own abbreviations, since
 * `Conference.Name` is "MWC" rather than "Mountain West".
 */
const CHAMPIONSHIP_VENUE_BY_CONFERENCE: Record<string, NeutralVenue | null> = {
  ACC: V.bankOfAmerica,
  'Big 12': V.att,
  'Big Ten': V.lucasOil,
  MAC: V.fordField,
  SEC: V.mercedesBenz,
  American: null,
  CUSA: null,
  'Conference USA': null,
  MWC: null,
  'Mountain West': null,
  'Pac-12': null,
  'Sun Belt': null,
};

/**
 * Bowl venues by the save's stable `bowlAssetName`, for the same
 * already-imported seasons. Uses the asset name rather than the display name
 * because EA rebrands bowls by sponsor year to year — "Salute to Veterans Bowl"
 * and "Xbox Bowl" are the Camellia and Bahamas bowls wearing a sponsor.
 */
const VENUE_BY_BOWL_ASSET: Record<string, NeutralVenue> = {
  '68Ventures_Bowl': V.hancockWhitney,
  Alamo_Bowl: V.alamodome,
  Arizona_Bowl: V.arizona,
  Armed_Forces_Bowl: V.amonCarter,
  Bahamas_Bowl: V.thomasRobinson,
  Birmingham_Bowl: V.protective,
  Boca_Raton_Bowl: V.fauStadium,
  Camellia_Bowl: V.cramton,
  Citrus_Bowl: V.campingWorld,
  Cure_Bowl: V.campingWorld,
  Duke_s_Mayo_Bowl: V.bankOfAmerica,
  Famous_Idaho_Potato_Bowl: V.albertsons,
  Fenway_Bowl: V.fenway,
  First_Responder_Bowl: V.geraldFord,
  Frisco_Bowl: V.toyota,
  Gasparilla_Bowl: V.raymondJames,
  Gator_Bowl: V.everbank,
  Guaranteed_Rate_Bowl: V.chaseField,
  Hawaii_Bowl: V.ching,
  Holiday_Bowl: V.snapdragon,
  Independence_Bowl: V.independence,
  Las_Vegas_Bowl: V.allegiant,
  Liberty_Bowl: V.simmonsBank,
  Military_Bowl: V.navyMarine,
  Music_City_Bowl: V.nissan,
  Myrtle_Beach_Bowl: V.brooks,
  New_Mexico_Bowl: V.universityStadium,
  New_Orleans_Bowl: V.superdome,
  Pop_Tarts_Bowl: V.campingWorld,
  Reliaquest_Bowl: V.raymondJames,
  Sun_Bowl: V.sunBowl,
  Texas_Bowl: V.nrg,
};

/** By the save's own venue reference. Null when the id isn't one we can name. */
export function getNeutralVenue(venueId: string | null | undefined): NeutralVenue | null {
  if (!venueId) return null;
  return VENUE_BY_SAVE_ID[venueId] ?? null;
}

export type ChampionshipVenue =
  | { kind: 'neutral'; venue: NeutralVenue }
  /** Played at the higher seed's own stadium — the caller should resolve the host. */
  | { kind: 'hosted' }
  /** No opinion; the caller decides. */
  | null;

/** A conference championship's venue, for seasons with no extracted venue reference. */
export function getChampionshipVenue(conferenceName: string | null | undefined): ChampionshipVenue {
  if (!conferenceName || !(conferenceName in CHAMPIONSHIP_VENUE_BY_CONFERENCE)) return null;
  const venue = CHAMPIONSHIP_VENUE_BY_CONFERENCE[conferenceName];
  return venue ? { kind: 'neutral', venue } : { kind: 'hosted' };
}

/** A bowl's venue by its stable asset name. Null when unrecognised. */
export function getBowlVenue(bowlAssetName: string | null | undefined): NeutralVenue | null {
  if (!bowlAssetName) return null;
  return VENUE_BY_BOWL_ASSET[bowlAssetName] ?? null;
}
