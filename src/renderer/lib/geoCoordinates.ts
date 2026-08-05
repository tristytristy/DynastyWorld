import { canonicalKey } from './assetMapping';

/**
 * Latitude/longitude for every school and every stadium we could source.
 *
 * NOT IN THE SAVE. `Team` carries `City` and `Stadium` references, but both
 * target tables are empty on a real dynasty save (capacity 32 and 183, zero
 * populated rows), so location data of any kind has to come from outside.
 *
 * SOURCED FROM WIKIDATA, not from memory — the same discipline stadiumData.ts
 * was built with. Stadium points came from a bulk SPARQL query over US stadiums
 * plus a targeted second pass; campus points from a bulk query over US
 * higher-education institutions, matched on label and alias.
 *
 * EVERY POINT IS VALIDATED against a bounding box for its own state, and any
 * match falling outside was DISCARDED rather than kept. That check earned its
 * keep: an early, looser matcher confidently attached Malone Stadium (Monroe)
 * to Louisiana-Lafayette, a downtown Boston park to Boston College, and Seattle
 * Center's Memorial Stadium to Washington. A silently wrong coordinate is worse
 * than a missing one, so gaps below are deliberate.
 *
 * TWO SEPARATE MAPS, because they are two different places — see
 * schoolLocations.ts. UCLA's campus is in Los Angeles; UCLA's stadium is the
 * Rose Bowl in Pasadena, about 12 miles away. Miami, UNLV, UConn, Air Force and
 * Boston College differ too. Pick the one that matches the question you are
 * asking.
 *
 * Keyed on `canonicalKey`, like logos, stadium data and school locations, so a
 * lookup by any in-game DisplayName resolves the same way everywhere.
 *
 * Coordinates are rounded to 5 decimal places — about a metre, far finer than
 * anything this app would plot.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Where the SCHOOL is. 137 of 138. */
export const CAMPUS_COORDS: Readonly<Record<string, GeoPoint>> = {
  airforce: { lat: 39.00811, lon: -104.89051 }, // Air Force
  akron: { lat: 41.0752, lon: -81.5115 }, // Akron
  alabama: { lat: 33.21083, lon: -87.54611 }, // Alabama
  appalachianstate: { lat: 36.21384, lon: -81.67862 }, // App St.
  arizona: { lat: 32.23194, lon: -110.9525 }, // Arizona
  arizonastate: { lat: 33.42361, lon: -111.93556 }, // Arizona State
  arkansas: { lat: 36.06861, lon: -94.17611 }, // Arkansas
  arkansasstate: { lat: 35.84108, lon: -90.67959 }, // Arkansas State
  army: { lat: 41.3925, lon: -73.9575 }, // Army
  auburn: { lat: 32.60337, lon: -85.48608 }, // Auburn
  ballstate: { lat: 40.1983, lon: -85.4089 }, // Ball State
  baylor: { lat: 31.5472, lon: -97.1139 }, // Baylor
  boisestate: { lat: 43.604, lon: -116.204 }, // Boise State
  boston: { lat: 42.33508, lon: -71.17036 }, // Boston College
  bowlinggreen: { lat: 41.38, lon: -83.64 }, // Bowling Green
  buffalo: { lat: 43, lon: -78.78917 }, // Buffalo
  byu: { lat: 40.24972, lon: -111.64917 }, // BYU
  california: { lat: 37.87194, lon: -122.25833 }, // California
  centralmichigan: { lat: 43.5898, lon: -84.7775 }, // C. Michigan
  charlotte: { lat: 35.30639, lon: -80.73333 }, // Charlotte
  cincinnati: { lat: 39.13278, lon: -84.51528 }, // Cincinnati
  clemson: { lat: 34.67833, lon: -82.83917 }, // Clemson
  colorado: { lat: 40.00667, lon: -105.26722 }, // Colorado
  coloradostate: { lat: 40.57484, lon: -105.08098 }, // Colorado State
  connecticut: { lat: 41.80722, lon: -72.2525 }, // UConn
  delaware: { lat: 39.67911, lon: -75.75217 }, // Delaware
  duke: { lat: 36.00111, lon: -78.93889 }, // Duke
  eastcarolina: { lat: 35.6075, lon: -77.37 }, // East Carolina
  easternmichigan: { lat: 42.25015, lon: -83.62445 }, // E. Michigan
  florida: { lat: 29.6475, lon: -82.345 }, // Florida
  floridaatlantic: { lat: 26.3712, lon: -80.1017 }, // FLA Atlantic
  floridaintl: { lat: 25.7529, lon: -80.3732 }, // FIU
  floridastate: { lat: 30.44167, lon: -84.295 }, // Florida State
  fresnostate: { lat: 36.81333, lon: -119.75 }, // Fresno State
  georgia: { lat: 33.95583, lon: -83.37444 }, // Georgia
  georgiasouthern: { lat: 32.4194, lon: -81.7767 }, // Ga Southern
  georgiastate: { lat: 33.7528, lon: -84.3861 }, // Georgia State
  georgiatech: { lat: 33.77581, lon: -84.39469 }, // Georgia Tech
  hawaii: { lat: 21.297, lon: -157.817 }, // Hawai'i
  houston: { lat: 29.71892, lon: -95.33916 }, // Houston
  illinois: { lat: 40.1083, lon: -88.22834 }, // Illinois
  indiana: { lat: 39.16722, lon: -86.52139 }, // Indiana
  iowa: { lat: 41.66167, lon: -91.53639 }, // Iowa
  iowastate: { lat: 42.02619, lon: -93.64844 }, // Iowa State
  jacksonvillestate: { lat: 33.82, lon: -85.77 }, // Jax State
  jamesmadison: { lat: 38.43844, lon: -78.87375 }, // James Madison
  kansas: { lat: 38.95806, lon: -95.24778 }, // Kansas
  kansasstate: { lat: 39.19167, lon: -96.58083 }, // Kansas State
  kennesawstate: { lat: 34.03788, lon: -84.58102 }, // Kennesaw St.
  kentstate: { lat: 41.14694, lon: -81.34333 }, // Kent State
  kentucky: { lat: 38.0325, lon: -84.5025 }, // Kentucky
  liberty: { lat: 37.35242, lon: -79.18018 }, // Liberty
  // CORRECTED: the bulk matcher landed on a New Orleans institution, putting
  // this campus 116 miles from its own stadium — caught by the campus/stadium
  // proximity gate. UL Lafayette, from Wikidata.
  louisianalafayette: { lat: 30.21444, lon: -92.02 }, // Louisiana
  louisianamonroe: { lat: 32.527, lon: -92.074 }, // UL Monroe
  louisianatech: { lat: 32.5275, lon: -92.6475 }, // Louisiana Tech
  louisville: { lat: 38.21502, lon: -85.76022 }, // Louisville
  lsu: { lat: 30.4145, lon: -91.1783 }, // LSU
  marshall: { lat: 38.4251, lon: -82.4205 }, // Marshall
  maryland: { lat: 38.98806, lon: -76.9425 }, // Maryland
  massachusetts: { lat: 42.38889, lon: -72.52778 }, // UMass
  memphis: { lat: 35.11889, lon: -89.93722 }, // Memphis
  miami: { lat: 25.72164, lon: -80.27927 }, // Miami
  miamioh: { lat: 39.51191, lon: -84.73467 }, // Miami (OH)
  michigan: { lat: 42.27694, lon: -83.73806 }, // Michigan
  michiganstate: { lat: 42.70186, lon: -84.48216 }, // Michigan State
  middletennessee: { lat: 35.84889, lon: -86.36111 }, // Middle Tenn
  minnesota: { lat: 44.975, lon: -93.23528 }, // Minnesota
  mississippistate: { lat: 33.45375, lon: -88.79005 }, // Mississippi St
  missouri: { lat: 38.9453, lon: -92.3288 }, // Missouri
  missouristate: { lat: 37.19971, lon: -93.28079 }, // Missouri State
  navy: { lat: 38.9825, lon: -76.485 }, // Navy
  ncstate: { lat: 35.78722, lon: -78.67056 }, // NC State
  nebraska: { lat: 40.8175, lon: -96.70139 }, // Nebraska
  nevada: { lat: 39.54583, lon: -119.81667 }, // Nevada
  newmexico: { lat: 35.08389, lon: -106.61861 }, // New Mexico
  newmexicostate: { lat: 32.283, lon: -106.748 }, // New Mexico St.
  northcarolina: { lat: 35.90861, lon: -79.04917 }, // North Carolina
  northdakotastate: { lat: 46.8916, lon: -96.8003 }, // NDSU
  northernillinois: { lat: 41.93389, lon: -88.77778 }, // NIU
  northtexas: { lat: 33.21095, lon: -97.14696 }, // North Texas
  northwestern: { lat: 42.05646, lon: -87.67527 }, // Northwestern
  notredame: { lat: 41.7, lon: -86.23889 }, // Notre Dame
  ohio: { lat: 39.3275, lon: -82.1 }, // Ohio
  ohiostate: { lat: 40.00577, lon: -83.02782 }, // Ohio State
  oklahoma: { lat: 35.20861, lon: -97.44583 }, // Oklahoma
  oklahomastate: { lat: 36.13222, lon: -97.08083 }, // Oklahoma State
  olddominion: { lat: 36.88654, lon: -76.30522 }, // Old Dominion
  olemiss: { lat: 34.36528, lon: -89.535 }, // Ole Miss
  oregon: { lat: 44.04417, lon: -123.07583 }, // Oregon
  oregonstate: { lat: 44.56583, lon: -123.27889 }, // Oregon State
  pennstate: { lat: 40.79611, lon: -77.86278 }, // Penn State
  pittsburgh: { lat: 40.44456, lon: -79.95327 }, // Pittsburgh
  purdue: { lat: 40.425, lon: -86.92306 }, // Purdue
  rice: { lat: 29.71694, lon: -95.40278 }, // Rice
  rutgers: { lat: 40.50167, lon: -74.44806 }, // Rutgers
  sacramentostate: { lat: 38.56639, lon: -121.428 }, // Sac State
  samhoustonstate: { lat: 30.7143, lon: -95.5474 }, // Sam Houston
  sandiegostate: { lat: 32.77528, lon: -117.07222 }, // San Diego St.
  sanjosestate: { lat: 37.33556, lon: -121.88111 }, // San Jose State
  smu: { lat: 32.84411, lon: -96.78487 }, // SMU
  southalabama: { lat: 30.69588, lon: -88.17691 }, // South Alabama
  southcarolina: { lat: 33.9975, lon: -81.02528 }, // South Carolina
  southernmississippi: { lat: 31.32961, lon: -89.33381 }, // Southern Miss
  southflorida: { lat: 28.06, lon: -82.41 }, // USF
  stanford: { lat: 37.4275, lon: -122.17 }, // Stanford
  syracuse: { lat: 43.03764, lon: -76.134 }, // Syracuse
  tcu: { lat: 32.70961, lon: -97.36282 }, // TCU
  temple: { lat: 39.98139, lon: -75.15444 }, // Temple
  tennessee: { lat: 35.9517, lon: -83.93 }, // Tennessee
  texas: { lat: 30.28614, lon: -97.73942 }, // Texas
  texasam: { lat: 30.61037, lon: -96.34406 }, // Texas A&M
  texassanantonio: { lat: 29.584, lon: -98.619 }, // UTSA
  texasstate: { lat: 29.8892, lon: -97.9389 }, // Texas State
  texastech: { lat: 33.58483, lon: -101.87999 }, // Texas Tech
  toledo: { lat: 41.6577, lon: -83.6137 }, // Toledo
  troy: { lat: 31.79806, lon: -85.95389 }, // Troy
  tulane: { lat: 29.94083, lon: -90.12056 }, // Tulane
  tulsa: { lat: 36.15222, lon: -95.94639 }, // Tulsa
  uab: { lat: 33.5, lon: -86.8075 }, // UAB
  ucf: { lat: 28.6016, lon: -81.2005 }, // UCF
  ucla: { lat: 34.07222, lon: -118.44278 }, // UCLA
  unlv: { lat: 36.10779, lon: -115.14376 }, // UNLV
  usc: { lat: 34.02167, lon: -118.28528 }, // USC
  utah: { lat: 40.76417, lon: -111.84639 }, // Utah
  utahstate: { lat: 41.7425, lon: -111.8125 }, // Utah State
  utep: { lat: 31.77, lon: -106.505 }, // UTEP
  vanderbilt: { lat: 36.1475, lon: -86.8025 }, // Vanderbilt
  virginia: { lat: 38.03556, lon: -78.50333 }, // Virginia
  virginiatech: { lat: 37.225, lon: -80.425 }, // Virginia Tech
  wakeforest: { lat: 36.135, lon: -80.277 }, // Wake Forest
  washington: { lat: 47.65417, lon: -122.30806 }, // Washington
  washingtonstate: { lat: 46.7252, lon: -117.1596 }, // Washington St.
  westernkentucky: { lat: 36.98361, lon: -86.4575 }, // W. Kentucky
  westernmichigan: { lat: 42.28318, lon: -85.61522 }, // W. Michigan
  westvirginia: { lat: 39.63582, lon: -79.95453 }, // West Virginia
  wisconsin: { lat: 43.07528, lon: -89.40417 }, // Wisconsin
  wyoming: { lat: 41.31306, lon: -105.58139 }, // Wyoming
};

/** Where the team PLAYS. 121 of 137 stadium entries. */
export const STADIUM_COORDS: Readonly<Record<string, GeoPoint>> = {
  /*
    SUPPLIED BY THE USER and verified, not pasted. Each was converted from DMS,
    checked against its own state's bounding box, and measured against the
    school's campus point — all fifteen landed under a mile from campus, which
    is what an on-campus stadium looks like.

    ONE SUPPLIED ROW WAS REJECTED: "Kansas State — Dave Booth Memorial Stadium"
    at 38°57'48"N 95°14'47"W sits 73 miles from K-State's campus and within 20
    METRES of the Kansas entry already in this table. That is David Booth
    KANSAS Memorial Stadium in Lawrence; Kansas State plays at Bill Snyder
    Family Stadium in Manhattan. Still missing rather than wrong.
  */
  airforce: { lat: 38.99694, lon: -104.84222 }, // Air Force — Falcon Stadium
  akron: { lat: 41.07235, lon: -81.50802 }, // Akron — InfoCision Stadium
  alabama: { lat: 33.20778, lon: -87.55056 }, // Alabama — Bryant-Denny Stadium
  appalachianstate: { lat: 36.2117, lon: -81.6856 }, // Appalachian State — Kidd Brewer Stadium
  arizona: { lat: 32.22889, lon: -110.94889 }, // Arizona — Arizona Stadium
  arizonastate: { lat: 33.42639, lon: -111.9325 }, // Arizona State — Mountain America Stadium
  arkansas: { lat: 36.0681, lon: -94.1789 }, // Arkansas — Razorback Stadium
  arkansasstate: { lat: 35.8489, lon: -90.6672 }, // Arkansas State — Centennial Bank Stadium
  army: { lat: 41.3875, lon: -73.96417 }, // Army — Michie Stadium
  auburn: { lat: 32.60222, lon: -85.48917 }, // Auburn — Jordan-Hare Stadium
  ballstate: { lat: 40.2161, lon: -85.4167 }, // Ball State — Scheumann Stadium
  baylor: { lat: 31.5302, lon: -97.1485 }, // Baylor — McLane Stadium
  boisestate: { lat: 43.6028, lon: -116.196 }, // Boise State — Albertsons Stadium
  boston: { lat: 42.335, lon: -71.16639 }, // Boston College — Alumni Stadium
  bowlinggreen: { lat: 41.37806, lon: -83.6225 }, // Bowling Green — Doyt Perry Stadium
  buffalo: { lat: 42.99917, lon: -78.7775 }, // Buffalo — UB Stadium
  byu: { lat: 40.2575, lon: -111.65444 }, // BYU — LaVell Edwards Stadium
  california: { lat: 37.87111, lon: -122.25083 }, // California — California Memorial Stadium
  centralmichigan: { lat: 43.5775, lon: -84.77083 }, // Central Michigan — Kelly/Shorts Stadium
  charlotte: { lat: 35.3106, lon: -80.7403 }, // Charlotte — Jerry Richardson Stadium
  cincinnati: { lat: 39.13111, lon: -84.51611 }, // Cincinnati — Nippert Stadium
  clemson: { lat: 34.67861, lon: -82.84306 }, // Clemson — Memorial Stadium
  coastalcarolina: { lat: 33.793, lon: -79.0177 }, // Coastal Carolina — Brooks Stadium
  colorado: { lat: 40.00944, lon: -105.26694 }, // Colorado — Folsom Field
  coloradostate: { lat: 40.56978, lon: -105.08795 }, // Colorado State — Canvas Stadium
  connecticut: { lat: 41.75333, lon: -72.62833 }, // UConn — Rentschler Field
  delaware: { lat: 39.6617, lon: -75.7488 }, // Delaware — Delaware Stadium
  duke: { lat: 35.99528, lon: -78.94167 }, // Duke — Wallace Wade Stadium
  eastcarolina: { lat: 35.5964, lon: -77.3653 }, // East Carolina — Dowdy-Ficklen Stadium
  easternmichigan: { lat: 42.2558, lon: -83.6472 }, // Eastern Michigan — Rynearson Stadium
  florida: { lat: 29.65, lon: -82.34861 }, // Florida — Ben Hill Griffin Stadium
  floridaatlantic: { lat: 26.37528, lon: -80.10028 }, // Florida Atlantic — FAU Stadium
  floridaintl: { lat: 25.7525, lon: -80.37778 }, // FIU — Pitbull Stadium
  floridastate: { lat: 30.43806, lon: -84.30444 }, // Florida State — Doak S. Campbell Stadium
  fresnostate: { lat: 36.8144, lon: -119.758 }, // Fresno State — Valley Children's Stadium
  georgia: { lat: 33.94972, lon: -83.37333 }, // Georgia — Sanford Stadium
  georgiasouthern: { lat: 32.41222, lon: -81.78306 }, // Georgia Southern — Paulson Stadium
  georgiastate: { lat: 33.73528, lon: -84.38944 }, // Georgia State — Center Parc Stadium
  georgiatech: { lat: 33.7725, lon: -84.39278 }, // Georgia Tech — Bobby Dodd Stadium
  hawaii: { lat: 21.29429, lon: -157.81712 }, // Hawaii — Clarence T.C. Ching Athletics Complex
  houston: { lat: 29.72194, lon: -95.34917 }, // Houston — TDECU Stadium
  illinois: { lat: 40.09917, lon: -88.23583 }, // Illinois — Memorial Stadium
  indiana: { lat: 39.18083, lon: -86.52556 }, // Indiana — Memorial Stadium
  iowa: { lat: 41.65861, lon: -91.55111 }, // Iowa — Kinnick Stadium
  iowastate: { lat: 42.01417, lon: -93.63583 }, // Iowa State — Jack Trice Stadium
  jacksonvillestate: { lat: 33.82028, lon: -85.76639 }, // Jax State — AmFirst Stadium
  jamesmadison: { lat: 38.4353, lon: -78.8731 }, // James Madison — Bridgeforth Stadium
  kansas: { lat: 38.96306, lon: -95.24639 }, // Kansas — David Booth Kansas Memorial Stadium
  kennesawstate: { lat: 34.02894, lon: -84.56761 }, // Kennesaw State — Fifth Third Stadium
  kentstate: { lat: 41.13917, lon: -81.31333 }, // Kent State — Dix Stadium
  kentucky: { lat: 38.02278, lon: -84.50528 }, // Kentucky — Kroger Field
  liberty: { lat: 37.354, lon: -79.175 }, // Liberty — Arthur L. Williams Stadium
  louisianalafayette: { lat: 30.21583, lon: -92.04194 }, // Louisiana — Cajun Field
  louisianamonroe: { lat: 32.53083, lon: -92.06583 }, // Louisiana-Monroe — Malone Stadium
  louisianatech: { lat: 32.53222, lon: -92.65583 }, // Louisiana Tech — Joe Aillet Stadium
  louisville: { lat: 38.20583, lon: -85.75889 }, // Louisville — L&N Federal Credit Union Stadium
  lsu: { lat: 30.41194, lon: -91.18556 }, // LSU — Tiger Stadium
  marshall: { lat: 38.425, lon: -82.4208 }, // Marshall — Joan C. Edwards Stadium
  maryland: { lat: 38.99028, lon: -76.94722 }, // Maryland — SECU Stadium
  massachusetts: { lat: 42.37731, lon: -72.53602 }, // UMass — McGuirk Alumni Stadium
  memphis: { lat: 35.12111, lon: -89.9775 }, // Memphis — Simmons Bank Liberty Stadium
  miami: { lat: 25.95806, lon: -80.23889 }, // Miami — Hard Rock Stadium
  miamioh: { lat: 39.5194, lon: -84.7328 }, // Miami (OH) — Yager Stadium
  michigan: { lat: 42.26583, lon: -83.74861 }, // Michigan — Michigan Stadium
  michiganstate: { lat: 42.72806, lon: -84.48472 }, // Michigan State — Spartan Stadium
  middletennessee: { lat: 35.8511, lon: -86.3683 }, // Middle Tennessee — Floyd Stadium
  minnesota: { lat: 44.97639, lon: -93.22444 }, // Minnesota — Huntington Bank Stadium
  mississippistate: { lat: 33.45639, lon: -88.79361 }, // Mississippi State — Davis Wade Stadium
  missouri: { lat: 38.93583, lon: -92.33306 }, // Missouri — Faurot Field
  missouristate: { lat: 37.19778, lon: -93.27972 }, // Missouri State — Robert W. Plaster Stadium
  navy: { lat: 38.98472, lon: -76.50694 }, // Navy — Navy-Marine Corps Memorial Stadium
  ncstate: { lat: 35.80083, lon: -78.71944 }, // NC State — Carter-Finley Stadium
  nebraska: { lat: 40.82102, lon: -96.7055 }, // Nebraska — Memorial Stadium
  nevada: { lat: 39.54694, lon: -119.8175 }, // Nevada — Mackay Stadium
  newmexico: { lat: 35.06694, lon: -106.62833 }, // New Mexico — University Stadium
  newmexicostate: { lat: 32.27972, lon: -106.74111 }, // New Mexico State — Aggie Memorial Stadium
  northcarolina: { lat: 35.90694, lon: -79.04778 }, // North Carolina — Kenan Stadium
  northdakotastate: { lat: 46.90304, lon: -96.80155 }, // North Dakota State — Fargodome
  northernillinois: { lat: 41.9339, lon: -88.7778 }, // Northern Illinois — Huskie Stadium
  northtexas: { lat: 33.20361, lon: -97.15944 }, // North Texas — DATCU Stadium
  northwestern: { lat: 42.08751, lon: -87.70063 }, // Northwestern — Ryan Field
  notredame: { lat: 41.69833, lon: -86.23389 }, // Notre Dame — Notre Dame Stadium
  ohio: { lat: 39.3211, lon: -82.1028 }, // Ohio — Peden Stadium
  ohiostate: { lat: 40.00167, lon: -83.01972 }, // Ohio State — Ohio Stadium
  oklahoma: { lat: 35.20583, lon: -97.4425 }, // Oklahoma — Gaylord Family Oklahoma Memorial Stadium
  oklahomastate: { lat: 36.12583, lon: -97.06639 }, // Oklahoma State — Boone Pickens Stadium
  olddominion: { lat: 36.8889, lon: -76.30488 }, // Old Dominion — S.B. Ballard Stadium
  olemiss: { lat: 34.36194, lon: -89.53417 }, // Ole Miss — Vaught-Hemingway Stadium
  oregon: { lat: 44.05833, lon: -123.06861 }, // Oregon — Autzen Stadium
  oregonstate: { lat: 44.55944, lon: -123.28139 }, // Oregon State — Reser Stadium
  pennstate: { lat: 40.81222, lon: -77.85611 }, // Penn State — Beaver Stadium
  pittsburgh: { lat: 40.44667, lon: -80.01583 }, // Pittsburgh — Acrisure Stadium
  purdue: { lat: 40.4344, lon: -86.9183 }, // Purdue — Ross-Ade Stadium
  rice: { lat: 29.71639, lon: -95.40917 }, // Rice — Rice Stadium
  rutgers: { lat: 40.51361, lon: -74.46528 }, // Rutgers — SHI Stadium
  sacramentostate: { lat: 38.55567, lon: -121.4229 }, // Sacramento State — Hornet Stadium
  samhoustonstate: { lat: 30.71389, lon: -95.54167 }, // Sam Houston — Bowers Stadium
  sandiegostate: { lat: 32.78444, lon: -117.12283 }, // San Diego State — Snapdragon Stadium
  sanjosestate: { lat: 37.31972, lon: -121.86833 }, // San Jose State — CEFCU Stadium
  smu: { lat: 32.83664, lon: -96.78399 }, // SMU — Gerald J. Ford Stadium
  southalabama: { lat: 30.6969, lon: -88.19201 }, // South Alabama — Hancock Whitney Stadium
  southcarolina: { lat: 33.97306, lon: -81.01917 }, // South Carolina — Williams-Brice Stadium
  southernmississippi: { lat: 31.32889, lon: -89.33139 }, // Southern Miss — M.M. Roberts Stadium
  southflorida: { lat: 27.97583, lon: -82.50333 }, // South Florida — Raymond James Stadium
  stanford: { lat: 37.43444, lon: -122.16111 }, // Stanford — Stanford Stadium
  syracuse: { lat: 43.03611, lon: -76.13639 }, // Syracuse — JMA Wireless Dome
  tcu: { lat: 32.70972, lon: -97.36806 }, // TCU — Amon G. Carter Stadium
  temple: { lat: 39.90089, lon: -75.16776 }, // Temple — Lincoln Financial Field
  tennessee: { lat: 35.955, lon: -83.925 }, // Tennessee — Neyland Stadium
  texas: { lat: 30.28367, lon: -97.73256 }, // Texas — Darrell K Royal-Texas Memorial Stadium
  texasam: { lat: 30.60992, lon: -96.34052 }, // Texas A&M — Kyle Field
  texassanantonio: { lat: 29.41694, lon: -98.47889 }, // UTSA — Alamodome
  texasstate: { lat: 29.89111, lon: -97.92556 }, // Texas State — Bobcat Stadium
  texastech: { lat: 33.5911, lon: -101.873 }, // Texas Tech — Jones AT&T Stadium
  toledo: { lat: 41.6569, lon: -83.6136 }, // Toledo — Glass Bowl
  troy: { lat: 31.7994, lon: -85.9519 }, // Troy — Veterans Memorial Stadium
  tulane: { lat: 29.94482, lon: -90.11682 }, // Tulane — Yulman Stadium
  tulsa: { lat: 36.14861, lon: -95.94389 }, // Tulsa — Skelly Field at H.A. Chapman Stadium
  uab: { lat: 33.52778, lon: -86.80889 }, // UAB — Protective Stadium
  ucf: { lat: 28.6091, lon: -81.1924 }, // UCF — Acrisure Bounce House
  ucla: { lat: 34.1614, lon: -118.1676 }, // UCLA — Rose Bowl Stadium
  unlv: { lat: 36.09078, lon: -115.183 }, // UNLV — Allegiant Stadium
  usc: { lat: 34.01417, lon: -118.28778 }, // USC — Los Angeles Memorial Coliseum
  utah: { lat: 40.76, lon: -111.84889 }, // Utah — Rice-Eccles Stadium
  utahstate: { lat: 41.75167, lon: -111.81167 }, // Utah State — Maverik Stadium
  utep: { lat: 31.773, lon: -106.508 }, // UTEP — Sun Bowl Stadium
  vanderbilt: { lat: 36.14417, lon: -86.80889 }, // Vanderbilt — FirstBank Stadium
  virginia: { lat: 38.03111, lon: -78.51361 }, // Virginia — Scott Stadium
  virginiatech: { lat: 37.22, lon: -80.41806 }, // Virginia Tech — Lane Stadium
  wakeforest: { lat: 36.13056, lon: -80.25472 }, // Wake Forest — Allegacy Federal Credit Union Stadium
  washington: { lat: 47.6503, lon: -122.3016 }, // Washington — Husky Stadium
  washingtonstate: { lat: 46.732, lon: -117.16 }, // Washington State — Martin Stadium
  westernkentucky: { lat: 36.98472, lon: -86.45944 }, // W. Kentucky — L.T. Smith Stadium
  westernmichigan: { lat: 42.28583, lon: -85.60111 }, // Western Michigan — Waldo Stadium
  westvirginia: { lat: 39.65028, lon: -79.95472 }, // West Virginia — Milan Puskar Stadium
  wisconsin: { lat: 43.07, lon: -89.41278 }, // Wisconsin — Camp Randall Stadium
  wyoming: { lat: 41.31167, lon: -105.56833 }, // Wyoming — War Memorial Stadium
};

/** Campus point, or undefined when we have none. */
export function campusCoords(teamName: string | null | undefined): GeoPoint | undefined {
  if (!teamName) return undefined;
  return CAMPUS_COORDS[canonicalKey(teamName)];
}

/** Stadium point, or undefined when we have none. */
export function stadiumCoords(teamName: string | null | undefined): GeoPoint | undefined {
  if (!teamName) return undefined;
  return STADIUM_COORDS[canonicalKey(teamName)];
}

/**
 * Great-circle distance in miles — for "how far did they travel", a road-trip
 * map, or sorting opponents by remoteness. Haversine, which is accurate to
 * well within a mile at these distances.
 */
export function distanceMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
