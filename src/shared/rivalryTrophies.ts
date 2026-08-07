/**
 * Which rivalry trophy is on the line when two schools meet.
 *
 * Every pairing here is READ OUT OF THE SAVE, not remembered: the `Rivalry`
 * table carries a `Trophy` reference alongside Team1/Team2, so a trophy's two
 * schools are a fact in the file. See docs/RIVALRY_TROPHIES.md for the
 * derivation, the handful identified another way, and which files still ship
 * placeholder art.
 *
 * Lives in shared/ rather than renderer/lib because both sides need it — the
 * database layer decides whether a trophy was WON (getTrophies), the renderer
 * decides what to draw.
 */

/** [team A, team B, asset file stem] — display names exactly as the save gives them. */
const RIVALRY_TROPHIES: [string, string, string][] = [
  // Shipped with the game's 2026-08-06 patch. The save has always carried this
  // Trophy reference — it was one of the nine listed in docs/RIVALRY_TROPHIES.md
  // as having no art in the pack, so the pairing resolved to nothing.
  ['Bowling Green', 'Toledo', 'rvlt-BattleofI75-BGSU-TOL'],
  ['Southern Miss', 'Tulane', 'rvlt-Bell-USM-TULN'],
  ['South Alabama', 'Troy', 'rvlt-Belt-USA-TROY'],
  ['Syracuse', 'West Virginia', 'rvlt-BenSchwartzwalder-SYR-WVU'],
  ['Virginia Tech', 'West Virginia', 'rvlt-BlackDiamond-VT-WVU'],
  ['Memphis', 'UAB', 'rvlt-Bones-MEM-UAB'],
  ['Kentucky', 'Tennessee', 'rvlt-BourbonBarrel-UK-TENN'],
  ['Utah State', 'Wyoming', 'rvlt-BridgerRifle-USU-WYO'],
  ['Colorado State', 'Wyoming', 'rvlt-BronzeBoot-CSU-WYO'],
  ['Ball State', 'NIU', 'rvlt-BronzeStalk-BALL-NIU'],
  ['Colorado', 'Colorado State', 'rvlt-CentennialCup-COLO-CSU'],
  ['Texas', 'Texas Tech', 'rvlt-ChancellorsSpurs-TEX-TTU'],
  ['UConn', 'UCF', 'rvlt-CivilConflict-CONN-UCF'],
  ['Air Force', 'Army', 'rvlt-CommanderinChiefs-AF-ARMY'],
  ['Virginia', 'Virginia Tech', 'rvlt-CommonwealthCup-UVA-VT'],
  ['Maryland', 'Navy', 'rvlt-CrabBowl-MD-NAVY'],
  ['Iowa', 'Iowa State', 'rvlt-CyHawk-IOWA-ISU'],
  ["Hawai'i", 'San Jose State', 'rvlt-DickTomeyLegacy-HAW-SJSU'],
  ['FIU', 'FLA Atlantic', 'rvlt-DonShulaAward-FIU-FAU'],
  ['Buffalo', 'UMass', 'rvlt-FlagshipCup-BUFF-UMASS'],
  ['Iowa', 'Minnesota', 'rvlt-FloydofRosedale-IOWA-MINN'],
  ['Nebraska', 'Wisconsin', 'rvlt-Freedom-NEB-WIS'],
  ['Nevada', 'UNLV', 'rvlt-FremontCannon-NEV-UNLV'],
  ['Navy', 'SMU', 'rvlt-Gansz-NAVY-SMU'],
  ['Michigan', 'Northwestern', 'rvlt-GeorgeJewitt-MICH-NW'],
  ['Arkansas', 'LSU', 'rvlt-GoldenBoot-ARK-LSU'],
  ['Ole Miss', 'Mississippi St', 'rvlt-GoldenEgg-MISS-MSST'],
  ['Oklahoma', 'Texas', 'rvlt-GoldenHat-OU-TEX'],
  ['Kansas', 'Kansas State', 'rvlt-GovernorsCup-KU-KSU'],
  ['Georgia', 'Georgia Tech', 'rvlt-GovernorsCup-UGA-GT'],
  ['Kentucky', 'Louisville', 'rvlt-GovernorsCup-UK-LOU'],
  ['Minnesota', 'Penn State', 'rvlt-GovernorsVictoryBell-MINN-PSU'],
  ['Iowa', 'Wisconsin', 'rvlt-Heartland-IOWA-WIS'],
  ['Iowa', 'Nebraska', 'rvlt-Heroes-IOWA-NEB'],
  ['Illinois', 'Ohio State', 'rvlt-Illibuck-ILL-OSU'],
  ['Boston College', 'Notre Dame', 'rvlt-Ireland-BC-ND'],
  ['SMU', 'TCU', 'rvlt-IronSkillet-SMU-TCU'],
  ["Hawai'i", 'UNLV', 'rvlt-IslandShowdown-HAW-UNLV'],
  ['Alabama', 'Auburn', 'rvlt-JamesEFoy-ALA-AUB'],
  ['Cincinnati', 'Louisville', 'rvlt-KegofNails-CIN-LOU'],
  ['Arizona', 'New Mexico', 'rvlt-KitCarsonRifle-ARIZ-UNM'],
  ['Air Force', "Hawai'i", 'rvlt-Kuter-AF-HAW'],
  ['Michigan State', 'Penn State', 'rvlt-LandGrant-MSU-PSU'],
  ['Illinois', 'Northwestern', 'rvlt-LandofLincoln-ILL-NW'],
  ['Notre Dame', 'Stanford', 'rvlt-Legends-ND-STAN'],
  ['Michigan', 'Minnesota', 'rvlt-LittleBrownJug-MICH-MINN'],
  ['Texas', 'Texas A&M', 'rvlt-LonestarShowdown-TEX-TAMU'],
  ['LSU', 'Ole Miss', 'rvlt-MagnoliaBowl-LSU-MISS'],
  ['Missouri', 'South Carolina', 'rvlt-MayorsCup-MIZ-SC'],
  ['Rice', 'SMU', 'rvlt-MayorsCup-RICE-SMU'],
  ['Michigan State', 'Notre Dame', 'rvlt-Megaphone-MSU-ND'],
  ['C. Michigan', 'E. Michigan', 'rvlt-MichiganMAC-CMU-EMU'],
  ['Boise State', 'Fresno State', 'rvlt-MilkCan-BSU-FRES'],
  ['Boston College', 'Clemson', 'rvlt-ORourkeMcFadden-BC-CLEM'],
  ['Fresno State', 'San Diego St.', 'rvlt-OilCan-FRES-SDSU'],
  ['Florida', 'Georgia', 'rvlt-OkefenokeeOar-UF-UGA'],
  ['Troy', 'Jax State', 'rvlt-OlSchoolBell-TROY-JVST'],
  ['Indiana', 'Michigan State', 'rvlt-OldBrassSpittoon-IND-MSU'],
  ['Indiana', 'Purdue', 'rvlt-OldOakenBucket-IND-PUR'],
  ['BYU', 'Utah State', 'rvlt-OldWagonWheel-BYU-USU'],
  ['Arkansas State', 'Memphis', 'rvlt-PaintBucket-ARST-MEM'],
  ['Middle Tenn', 'Troy', 'rvlt-Palladium-MTSU-TROY'],
  ['Clemson', 'South Carolina', 'rvlt-PalmettoBowl-CLEM-SC'],
  ["Hawai'i", 'Wyoming', 'rvlt-Paniolo-HAW-WYO'],
  ['Michigan', 'Michigan State', 'rvlt-PaulBunyan-MICH-MSU'],
  ['Minnesota', 'Wisconsin', 'rvlt-PaulBunyanAxe-MINN-WIS'],
  ['Oregon', 'Oregon State', 'rvlt-Platypus-ORE-ORST'],
  ['Illinois', 'Purdue', 'rvlt-PurdueCannon-ILL-PUR'],
  ['Air Force', 'Colorado State', 'rvlt-RamFalcon-AF-CSU'],
  ['Ball State', 'Miami (OH)', 'rvlt-RedBirdRivalry-BALL-MOH'],
  ['New Mexico', 'New Mexico St.', 'rvlt-RioGrandeRivalry-UNM-NMSU'],
  ['Navy', 'Notre Dame', 'rvlt-RipMiller-NAVY-ND'],
  ['TCU', 'Texas Tech', 'rvlt-Saddle-TCU-TTU'],
  ['Notre Dame', 'Northwestern', 'rvlt-Shillelagh-ND-NW'],
  ['Notre Dame', 'USC', 'rvlt-Shillelagh-ND-USC'],
  ['New Mexico St.', 'UTEP', 'rvlt-SilverSpade-NMSU-UTEP'],
  ['Arkansas', 'Texas A&M', 'rvlt-SouthwestClassic-ARK-TAMU'],
  ['Iowa State', 'Missouri', 'rvlt-Telephone-ISU-MIZ'],
  ['Arizona', 'Arizona State', 'rvlt-TerritorialCup-ARIZ-ASU'],
  ['Clemson', 'NC State', 'rvlt-TextileBowl-CLEM-NCST'],
  ['LSU', 'Tulane', 'rvlt-TigerRag-LSU-TULN'],
  ['Missouri', 'Oklahoma', 'rvlt-TigerSoonerPeacePipe-MIZ-OU'],
  ['Fresno State', 'San Jose State', 'rvlt-ValleyCup-FRES-SJSU'],
  ['Cincinnati', 'Miami (OH)', 'rvlt-VictoryBell-CIN-MOH'],
  ['Missouri', 'Nebraska', 'rvlt-VictoryBell-MIZ-NEB'],
  ['UCLA', 'USC', 'rvlt-VictoryBell-UCLA-USC'],
  ['North Carolina', 'Duke', 'rvlt-VictoryBell-UNC-DUKE'],
  ['Akron', 'Kent State', 'rvlt-WagonWheel-AKR-KENT'],
  ['USF', 'UCF', 'rvlt-WaronI4-USF-UCF'],
];

/**
 * The one trophy contested by three schools: two separate save rows are both
 * named "Battle for the Florida Cup". Expanded into its three pairings so the
 * lookup below stays a simple pair match.
 */
const THREE_WAY: [string, string, string][] = [
  ['Florida', 'Florida State', 'rvlt-FloridaCup-UF-FSU-MIA'],
  ['Florida', 'Miami', 'rvlt-FloridaCup-UF-FSU-MIA'],
  ['Florida State', 'Miami', 'rvlt-FloridaCup-UF-FSU-MIA'],
];

/** Case/punctuation-insensitive, so "Texas A&M" and "TEXAS AM" are the same team. */
function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Order-independent: the same trophy is at stake whoever is at home. */
function pairKey(a: string, b: string): string {
  return [normalizeTeam(a), normalizeTeam(b)].sort().join('|');
}

const BY_PAIR = new Map(
  [...RIVALRY_TROPHIES, ...THREE_WAY].map(([a, b, stem]) => [pairKey(a, b), stem]),
);

/** The trophy asset stem for this matchup, or null when the pairing has none. */
export function rivalryTrophyFor(teamA: string, teamB: string): string | null {
  return BY_PAIR.get(pairKey(teamA, teamB)) ?? null;
}

/**
 * Splitting on capitals gets most names right, and mangles the ones with a
 * lowercase joining word or an initial: "Floydof Rosedale", "Kegof Nails",
 * "James EFoy", "ORourke Mc Fadden", "Waron I4". Those are spelled out here
 * rather than pattern-matched, because there is no rule to find — it's a
 * closed set of a dozen names.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  CommanderinChiefs: "Commander-in-Chief's Trophy",
  CyHawk: 'Cy-Hawk Trophy',
  FloydofRosedale: 'Floyd of Rosedale',
  JamesEFoy: 'James E. Foy Trophy',
  KegofNails: 'Keg of Nails',
  LandofLincoln: 'Land of Lincoln',
  LonestarShowdown: 'Lone Star Showdown',
  ORourkeMcFadden: "O'Rourke-McFadden Trophy",
  OlSchoolBell: "Ol' School Bell",
  WaronI4: 'War on I-4',
};

/** Human label from the stem, e.g. "rvlt-LittleBrownJug-MICH-MINN" -> "Little Brown Jug". */
export function rivalryTrophyLabel(stem: string): string {
  const name = stem.split('-')[1] ?? stem;
  if (LABEL_OVERRIDES[name]) return LABEL_OVERRIDES[name];
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}
