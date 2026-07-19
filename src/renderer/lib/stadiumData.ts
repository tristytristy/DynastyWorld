import { canonicalKey } from './assetMapping';

/**
 * Real-world FBS stadium data — NOT extracted from the save file. Confirmed
 * via direct investigation (see DevLog.md) that `SeasonGame.Stadium` and
 * `Team.Stadium` reference table IDs that don't exist anywhere in either save
 * file tested; the game simply doesn't persist venue data per-dynasty. This
 * table exists because the user asked for it to be researched from real-world
 * knowledge instead.
 *
 * Sourced from Wikipedia's "List of NCAA Division I FBS football stadiums"
 * (fetched directly, not from memory) and spot-verified against several
 * individual team searches — one real error was caught and corrected this
 * way (an earlier fetch pass returned a fabricated stadium name for Fresno
 * State; the corrected value below is confirmed via a dedicated search).
 * Given ~140 entries pulled via automated fetches, treat this as
 * high-confidence but not exhaustively hand-verified — if a specific team's
 * entry looks wrong, it's more likely a stale/renamed stadium (naming-rights
 * deals change yearly) than a wrong team.
 *
 * Keyed on the same canonical team key as TEAM_NCAA_LOGOS/TEAM_3D_LOGOS (via
 * canonicalKey()), so a lookup by any in-game DisplayName resolves exactly
 * like a logo lookup already does. Covers real FBS programs only — matches
 * the 3D logo set's realistic "your college dynasty" coverage; FCS/Group of
 * Six-adjacent schools without a stadium entry fall back to Home/Away/Neutral
 * text, same as before this feature.
 *
 * This is the DEFAULT/original data only — user corrections and custom
 * stadium moves are layered on top as overrides (see StadiumDataProvider.tsx)
 * rather than mutating this table, so "reset to default" always has
 * something real to reset to.
 */
export interface StadiumInfo {
  /** Display name — informational (search/list label in the editor); the storage key is derived from this via canonicalKey(), not stored separately. */
  team: string;
  stadium: string;
  city: string;
  state: string;
}

/** The original, non-editable dataset. Exported so the override layer can diff against and reset to it. */
export const DEFAULT_TEAM_STADIUMS: Record<string, StadiumInfo> = {
  ucf: { team: 'UCF', stadium: 'Acrisure Bounce House', city: 'Orlando', state: 'FL' },
  pittsburgh: { team: 'Pittsburgh', stadium: 'Acrisure Stadium', city: 'Pittsburgh', state: 'PA' },
  newmexicostate: { team: 'New Mexico State', stadium: 'Aggie Memorial Stadium', city: 'Las Cruces', state: 'NM' },
  texassanantonio: { team: 'UTSA', stadium: 'Alamodome', city: 'San Antonio', state: 'TX' },
  washington: { team: 'Washington', stadium: 'Alaska Airlines Field at Husky Stadium', city: 'Seattle', state: 'WA' },
  boisestate: { team: 'Boise State', stadium: 'Albertsons Stadium', city: 'Boise', state: 'ID' },
  wakeforest: { team: 'Wake Forest', stadium: 'Allegacy Federal Credit Union Stadium', city: 'Winston-Salem', state: 'NC' },
  unlv: { team: 'UNLV', stadium: 'Allegiant Stadium', city: 'Paradise', state: 'NV' },
  georgiasouthern: { team: 'Georgia Southern', stadium: 'Allen E. Paulson Stadium', city: 'Statesboro', state: 'GA' },
  boston: { team: 'Boston College', stadium: 'Alumni Stadium', city: 'Boston', state: 'MA' },
  tcu: { team: 'TCU', stadium: 'Amon G. Carter Stadium', city: 'Fort Worth', state: 'TX' },
  liberty: { team: 'Liberty', stadium: 'Arthur L. Williams Stadium', city: 'Lynchburg', state: 'VA' },
  oregon: { team: 'Oregon', stadium: 'Autzen Stadium', city: 'Eugene', state: 'OR' },
  eastcarolina: { team: 'East Carolina', stadium: 'Dowdy-Ficklen Stadium', city: 'Greenville', state: 'NC' },
  pennstate: { team: 'Penn State', stadium: 'Beaver Stadium', city: 'University Park', state: 'PA' },
  tulane: { team: 'Tulane', stadium: 'Yulman Stadium', city: 'New Orleans', state: 'LA' },
  kansasstate: { team: 'Kansas State', stadium: 'Bill Snyder Family Stadium', city: 'Manhattan', state: 'KS' },
  army: { team: 'Army', stadium: 'Michie Stadium', city: 'West Point', state: 'NY' },
  floridastate: { team: 'Florida State', stadium: 'Doak S. Campbell Stadium', city: 'Tallahassee', state: 'FL' },
  georgiatech: { team: 'Georgia Tech', stadium: 'Bobby Dodd Stadium', city: 'Atlanta', state: 'GA' },
  oklahomastate: { team: 'Oklahoma State', stadium: 'Boone Pickens Stadium', city: 'Stillwater', state: 'OK' },
  jamesmadison: { team: 'James Madison', stadium: 'Bridgeforth Stadium', city: 'Harrisonburg', state: 'VA' },
  northernillinois: { team: 'Northern Illinois', stadium: 'Huskie Stadium', city: 'DeKalb', state: 'IL' },
  duke: { team: 'Duke', stadium: 'Wallace Wade Stadium', city: 'Durham', state: 'NC' },
  coastalcarolina: { team: 'Coastal Carolina', stadium: 'Brooks Stadium', city: 'Conway', state: 'SC' },
  jacksonvillestate: { team: 'Jacksonville State', stadium: 'AmFirst Stadium', city: 'Jacksonville', state: 'AL' },
  louisianalafayette: { team: 'Louisiana', stadium: 'Cajun Field', city: 'Lafayette', state: 'LA' },
  california: { team: 'California', stadium: 'California Memorial Stadium', city: 'Berkeley', state: 'CA' },
  wisconsin: { team: 'Wisconsin', stadium: 'Camp Randall Stadium', city: 'Madison', state: 'WI' },
  virginia: { team: 'Virginia', stadium: 'Scott Stadium', city: 'Charlottesville', state: 'VA' },
  southernmississippi: { team: 'Southern Miss', stadium: 'M.M. Roberts Stadium', city: 'Hattiesburg', state: 'MS' },
  arizona: { team: 'Arizona', stadium: 'Arizona Stadium', city: 'Tucson', state: 'AZ' },
  sanjosestate: { team: 'San Jose State', stadium: 'CEFCU Stadium', city: 'San Jose', state: 'CA' },
  arkansasstate: { team: 'Arkansas State', stadium: 'Centennial Bank Stadium', city: 'Jonesboro', state: 'AR' },
  georgiastate: { team: 'Georgia State', stadium: 'Center Parc Stadium', city: 'Atlanta', state: 'GA' },
  hawaii: { team: 'Hawaii', stadium: 'Clarence T.C. Ching Athletics Complex', city: 'Honolulu', state: 'HI' },
  texas: { team: 'Texas', stadium: 'Darrell K Royal-Texas Memorial Stadium', city: 'Austin', state: 'TX' },
  northtexas: { team: 'North Texas', stadium: 'DATCU Stadium', city: 'Denton', state: 'TX' },
  kansas: { team: 'Kansas', stadium: 'David Booth Kansas Memorial Stadium', city: 'Lawrence', state: 'KS' },
  mississippistate: { team: 'Mississippi State', stadium: 'Davis Wade Stadium', city: 'Starkville', state: 'MS' },
  delaware: { team: 'Delaware', stadium: 'Delaware Stadium', city: 'Newark', state: 'DE' },
  kentstate: { team: 'Kent State', stadium: 'Dix Stadium', city: 'Kent', state: 'OH' },
  arkansas: { team: 'Arkansas', stadium: 'Razorback Stadium', city: 'Fayetteville', state: 'AR' },
  bowlinggreen: { team: 'Bowling Green', stadium: 'Doyt L. Perry Stadium', city: 'Bowling Green', state: 'OH' },
  samhoustonstate: { team: 'Sam Houston', stadium: 'Bowers Stadium', city: 'Huntsville', state: 'TX' },
  airforce: { team: 'Air Force', stadium: 'Falcon Stadium', city: 'Colorado Springs', state: 'CO' },
  northdakotastate: { team: 'North Dakota State', stadium: 'Fargodome', city: 'Fargo', state: 'ND' },
  missouri: { team: 'Missouri', stadium: 'Faurot Field', city: 'Columbia', state: 'MO' },
  kennesawstate: { team: 'Kennesaw State', stadium: 'Fifth Third Stadium', city: 'Kennesaw', state: 'GA' },
  vanderbilt: { team: 'Vanderbilt', stadium: 'FirstBank Stadium', city: 'Nashville', state: 'TN' },
  colorado: { team: 'Colorado', stadium: 'Folsom Field', city: 'Boulder', state: 'CO' },
  clemson: { team: 'Clemson', stadium: 'Memorial Stadium', city: 'Clemson', state: 'SC' },
  arizonastate: { team: 'Arizona State', stadium: 'Mountain America Stadium', city: 'Tempe', state: 'AZ' },
  miamioh: { team: 'Miami (OH)', stadium: 'Yager Stadium', city: 'Oxford', state: 'OH' },
  oklahoma: { team: 'Oklahoma', stadium: 'Gaylord Family Oklahoma Memorial Stadium', city: 'Norman', state: 'OK' },
  smu: { team: 'SMU', stadium: 'Gerald J. Ford Stadium', city: 'University Park', state: 'TX' },
  illinois: { team: 'Illinois', stadium: 'Memorial Stadium', city: 'Champaign', state: 'IL' },
  toledo: { team: 'Toledo', stadium: 'Glass Bowl', city: 'Toledo', state: 'OH' },
  southalabama: { team: 'South Alabama', stadium: 'Hancock Whitney Stadium', city: 'Mobile', state: 'AL' },
  miami: { team: 'Miami', stadium: 'Hard Rock Stadium', city: 'Miami Gardens', state: 'FL' },
  sacramentostate: { team: 'Sacramento State', stadium: 'Hornet Stadium', city: 'Sacramento', state: 'CA' },
  westernkentucky: { team: 'Western Kentucky', stadium: 'L.T. Smith Stadium', city: 'Bowling Green', state: 'KY' },
  floridaatlantic: { team: 'Florida Atlantic', stadium: 'FAU Stadium', city: 'Boca Raton', state: 'FL' },
  minnesota: { team: 'Minnesota', stadium: 'Huntington Bank Stadium', city: 'Minneapolis', state: 'MN' },
  akron: { team: 'Akron', stadium: 'InfoCision Stadium', city: 'Akron', state: 'OH' },
  syracuse: { team: 'Syracuse', stadium: 'JMA Wireless Dome', city: 'Syracuse', state: 'NY' },
  iowastate: { team: 'Iowa State', stadium: 'Jack Trice Stadium', city: 'Ames', state: 'IA' },
  texasstate: { team: 'Texas State', stadium: 'UFCU Stadium', city: 'San Marcos', state: 'TX' },
  marshall: { team: 'Marshall', stadium: 'Joan C. Edwards Stadium', city: 'Huntington', state: 'WV' },
  louisianatech: { team: 'Louisiana Tech', stadium: 'Joe Aillet Stadium', city: 'Ruston', state: 'LA' },
  houston: { team: 'Houston', stadium: 'TDECU Stadium', city: 'Houston', state: 'TX' },
  middletennessee: { team: 'Middle Tennessee', stadium: 'Floyd Stadium', city: 'Murfreesboro', state: 'TN' },
  wyoming: { team: 'Wyoming', stadium: 'War Memorial Stadium', city: 'Laramie', state: 'WY' },
  texastech: { team: 'Texas Tech', stadium: 'Jones AT&T Stadium', city: 'Lubbock', state: 'TX' },
  centralmichigan: { team: 'Central Michigan', stadium: 'Kelly/Shorts Stadium', city: 'Mount Pleasant', state: 'MI' },
  northcarolina: { team: 'North Carolina', stadium: 'Kenan Stadium', city: 'Chapel Hill', state: 'NC' },
  appalachianstate: { team: 'Appalachian State', stadium: 'Kidd Brewer Stadium', city: 'Boone', state: 'NC' },
  iowa: { team: 'Iowa', stadium: 'Kinnick Stadium', city: 'Iowa City', state: 'IA' },
  olddominion: { team: 'Old Dominion', stadium: 'S.B. Ballard Stadium', city: 'Norfolk', state: 'VA' },
  kentucky: { team: 'Kentucky', stadium: 'Kroger Field', city: 'Lexington', state: 'KY' },
  texasam: { team: 'Texas A&M', stadium: 'Kyle Field', city: 'College Station', state: 'TX' },
  louisville: { team: 'Louisville', stadium: 'L&N Federal Credit Union Stadium', city: 'Louisville', state: 'KY' },
  virginiatech: { team: 'Virginia Tech', stadium: 'Lane Stadium', city: 'Blacksburg', state: 'VA' },
  byu: { team: 'BYU', stadium: 'LaVell Edwards Stadium', city: 'Provo', state: 'UT' },
  temple: { team: 'Temple', stadium: 'Lincoln Financial Field', city: 'Philadelphia', state: 'PA' },
  usc: { team: 'USC', stadium: 'Los Angeles Memorial Coliseum', city: 'Los Angeles', state: 'CA' },
  nevada: { team: 'Nevada', stadium: 'Mackay Stadium', city: 'Reno', state: 'NV' },
  louisianamonroe: { team: 'Louisiana-Monroe', stadium: 'Malone Stadium', city: 'Monroe', state: 'LA' },
  washingtonstate: { team: 'Washington State', stadium: 'Martin Stadium', city: 'Pullman', state: 'WA' },
  charlotte: { team: 'Charlotte', stadium: 'Jerry Richardson Stadium', city: 'Charlotte', state: 'NC' },
  baylor: { team: 'Baylor', stadium: 'McLane Stadium', city: 'Waco', state: 'TX' },
  indiana: { team: 'Indiana', stadium: 'Memorial Stadium', city: 'Bloomington', state: 'IN' },
  nebraska: { team: 'Nebraska', stadium: 'Memorial Stadium', city: 'Lincoln', state: 'NE' },
  utahstate: { team: 'Utah State', stadium: 'Maverik Stadium', city: 'Logan', state: 'UT' },
  michigan: { team: 'Michigan', stadium: 'Michigan Stadium', city: 'Ann Arbor', state: 'MI' },
  westvirginia: { team: 'West Virginia', stadium: 'Milan Puskar Stadium', city: 'Morgantown', state: 'WV' },
  navy: { team: 'Navy', stadium: 'Navy-Marine Corps Memorial Stadium', city: 'Annapolis', state: 'MD' },
  tennessee: { team: 'Tennessee', stadium: 'Neyland Stadium', city: 'Knoxville', state: 'TN' },
  cincinnati: { team: 'Cincinnati', stadium: 'Nippert Stadium', city: 'Cincinnati', state: 'OH' },
  notredame: { team: 'Notre Dame', stadium: 'Notre Dame Stadium', city: 'Notre Dame', state: 'IN' },
  ohiostate: { team: 'Ohio State', stadium: 'Ohio Stadium', city: 'Columbus', state: 'OH' },
  auburn: { team: 'Auburn', stadium: 'Jordan-Hare Stadium', city: 'Auburn', state: 'AL' },
  ohio: { team: 'Ohio', stadium: 'Peden Stadium', city: 'Athens', state: 'OH' },
  floridaintl: { team: 'FIU', stadium: 'Pitbull Stadium', city: 'Miami', state: 'FL' },
  connecticut: { team: 'UConn', stadium: 'Rentschler Field', city: 'East Hartford', state: 'CT' },
  uab: { team: 'UAB', stadium: 'Protective Stadium', city: 'Birmingham', state: 'AL' },
  southflorida: { team: 'South Florida', stadium: 'Raymond James Stadium', city: 'Tampa', state: 'FL' },
  oregonstate: { team: 'Oregon State', stadium: 'Reser Stadium', city: 'Corvallis', state: 'OR' },
  rice: { team: 'Rice', stadium: 'Rice Stadium', city: 'Houston', state: 'TX' },
  utah: { team: 'Utah', stadium: 'Rice-Eccles Stadium', city: 'Salt Lake City', state: 'UT' },
  ucla: { team: 'UCLA', stadium: 'Rose Bowl Stadium', city: 'Pasadena', state: 'CA' },
  purdue: { team: 'Purdue', stadium: 'Ross-Ade Stadium', city: 'West Lafayette', state: 'IN' },
  northwestern: { team: 'Northwestern', stadium: 'Ryan Field', city: 'Evanston', state: 'IL' },
  easternmichigan: { team: 'Eastern Michigan', stadium: 'Rynearson Stadium', city: 'Ypsilanti', state: 'MI' },
  alabama: { team: 'Alabama', stadium: 'Bryant-Denny Stadium', city: 'Tuscaloosa', state: 'AL' },
  georgia: { team: 'Georgia', stadium: 'Sanford Stadium', city: 'Athens', state: 'GA' },
  ballstate: { team: 'Ball State', stadium: 'Scheumann Stadium', city: 'Muncie', state: 'IN' },
  maryland: { team: 'Maryland', stadium: 'SECU Stadium', city: 'College Park', state: 'MD' },
  rutgers: { team: 'Rutgers', stadium: 'SHI Stadium', city: 'Piscataway', state: 'NJ' },
  southcarolina: { team: 'South Carolina', stadium: 'Williams-Brice Stadium', city: 'Columbia', state: 'SC' },
  stanford: { team: 'Stanford', stadium: 'Stanford Stadium', city: 'Stanford', state: 'CA' },
  ncstate: { team: 'NC State', stadium: 'Carter-Finley Stadium', city: 'Raleigh', state: 'NC' },
  tulsa: { team: 'Tulsa', stadium: 'Skelly Field at H.A. Chapman Stadium', city: 'Tulsa', state: 'OK' },
  utep: { team: 'UTEP', stadium: 'Sun Bowl Stadium', city: 'El Paso', state: 'TX' },
  memphis: { team: 'Memphis', stadium: 'Simmons Bank Liberty Stadium', city: 'Memphis', state: 'TN' },
  buffalo: { team: 'Buffalo', stadium: 'UB Stadium', city: 'Buffalo', state: 'NY' },
  westernmichigan: { team: 'Western Michigan', stadium: 'Waldo Stadium', city: 'Kalamazoo', state: 'MI' },
  sandiegostate: { team: 'San Diego State', stadium: 'Snapdragon Stadium', city: 'San Diego', state: 'CA' },
  fresnostate: { team: 'Fresno State', stadium: "Valley Children's Stadium", city: 'Fresno', state: 'CA' },
  coloradostate: { team: 'Colorado State', stadium: 'Canvas Stadium', city: 'Fort Collins', state: 'CO' },
  massachusetts: { team: 'UMass', stadium: 'McGuirk Alumni Stadium', city: 'Amherst', state: 'MA' },
  michiganstate: { team: 'Michigan State', stadium: 'Spartan Stadium', city: 'East Lansing', state: 'MI' },
  lsu: { team: 'LSU', stadium: 'Tiger Stadium', city: 'Baton Rouge', state: 'LA' },
  florida: { team: 'Florida', stadium: 'Ben Hill Griffin Stadium', city: 'Gainesville', state: 'FL' },
  olemiss: { team: 'Ole Miss', stadium: 'Vaught-Hemingway Stadium', city: 'Oxford', state: 'MS' },
  newmexico: { team: 'New Mexico', stadium: 'University Stadium', city: 'Albuquerque', state: 'NM' },
  troy: { team: 'Troy', stadium: 'Veterans Memorial Stadium', city: 'Troy', state: 'AL' },
};

/**
 * The DEFAULT-only lookup (no user overrides applied) — null for any team
 * without a real-world FBS stadium entry (FCS/lower-tier schools). Most UI
 * code should go through `useStadiumData().getStadium()` instead (see
 * StadiumDataProvider.tsx), which layers user corrections on top of this;
 * this is exported for the provider itself and for "what's the original
 * value" displays in the editor.
 */
export function getDefaultStadiumInfo(teamAssetName: string): StadiumInfo | null {
  return DEFAULT_TEAM_STADIUMS[canonicalKey(teamAssetName)] ?? null;
}
