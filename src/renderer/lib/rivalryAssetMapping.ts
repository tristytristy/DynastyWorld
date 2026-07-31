const RIVALRY_LOGO_BASE_PATH = 'assets/rivalry/rivalrylogo';

/** The generic "RIVALRY" shield, for a confirmed rivalry with no dedicated art. */
const DEFAULT_RIVALRY_LOGO = `${RIVALRY_LOGO_BASE_PATH}/ryLgs_1024_Default_Small.webp`;

/**
 * Matchup → logo file, keyed by the two teams rather than by the save's rivalry
 * NAME.
 *
 * Two reasons it has to work this way. The art is named by pairing
 * ("AlabamaVsAuburn"), not by rivalry ("Iron Bowl"). And the save only extracts
 * rivalry names for the USER's team (see extract-rivalries.ts) — keying on the
 * pairing means a browsed team's schedule and any league game's box score get
 * the same treatment for free, with no new extraction.
 *
 * Written out as real display-name pairs instead of parsed from the filenames,
 * because the filenames don't agree with each other or with the save. The art
 * ships "TexasAM" in one file and "Texasam" in another; the save says
 * "New Mexico St." where the art says "NewMexicoState", "USF" where the art
 * says "SouthFlorida", and "Washington St." where the art says
 * "WashingtonState". A parser would need every one of those exceptions anyway,
 * and would fail silently on the next one — this fails loudly, at the point
 * where a new pairing is added.
 *
 * Names below are verified against the real 138-team display-name list.
 */
const RIVALRY_LOGO_FILES: [string, string, string][] = [
  ['Alabama', 'Auburn', 'ryLgs_1024_AlabamaVsAuburn_Small.webp'],
  ['Alabama', 'Tennessee', 'ryLgs_1024_AlabamaVsTennessee_Small.webp'],
  ['Arizona', 'Arizona State', 'ryLgs_1024_ArizonaVsArizonaState_Small.webp'],
  ['Arkansas', 'Texas A&M', 'ryLgs_1024_ArkansasVsTexasAM_Small.webp'],
  ['Army', 'Navy', 'ryLgs_1024_ArmyVsNavy_Small.webp'],
  ['Buffalo', 'UMass', 'ryLgs_1024_BuffaloVsUmass_Small.webp'],
  ['California', 'Stanford', 'ryLgs_1024_CalVsStanford_Small.webp'],
  ['Clemson', 'South Carolina', 'ryLgs_1024_ClemsonVsSouthCarolina_Small.webp'],
  ['Colorado State', 'Wyoming', 'ryLgs_1024_ColoradoStateVsWyoming_Small.webp'],
  ['Colorado', 'Colorado State', 'ryLgs_1024_ColoradoVsColoradoState_Small.webp'],
  ['Florida', 'Florida State', 'ryLgs_1024_FloridaVsFloridaState_Small.webp'],
  ['Florida', 'Georgia', 'ryLgs_1024_FloridaVsGeorgia_Small.webp'],
  ['Iowa', 'Iowa State', 'ryLgs_1024_IowaVsIowaState_Small.webp'],
  ['Kansas', 'Kansas State', 'ryLgs_1024_KansasVsKansasState_Small.webp'],
  ['LSU', 'Ole Miss', 'ryLgs_1024_LsuVsOleMiss_Small.webp'],
  ['Missouri', 'Arkansas', 'ryLgs_1024_MissouriVsArkansas_Small.webp'],
  ['Nebraska', 'Iowa', 'ryLgs_1024_NebraskaVsIowa_Small.webp'],
  ['New Mexico', 'New Mexico St.', 'ryLgs_1024_NewMexicoVsNewMexicoState_Small.webp'],
  ['Oklahoma State', 'Tulsa', 'ryLgs_1024_OklahomaStateVsTulsa_Small.webp'],
  ['Oklahoma', 'Oklahoma State', 'ryLgs_1024_OklahomaVsOklahomaState_Small.webp'],
  ['Oklahoma', 'Texas', 'ryLgs_1024_OklahomaVsTexas_Small.webp'],
  ['Pittsburgh', 'West Virginia', 'ryLgs_1024_PittsburghVsWestVirginia_Small.webp'],
  ['Southern Miss', 'Tulane', 'ryLgs_1024_SouthernMissVsTulane_Small.webp'],
  ['Texas State', 'UTSA', 'ryLgs_1024_TexasStateVsUtsa_Small.webp'],
  ['Texas', 'Texas A&M', 'ryLgs_1024_TexasVsTexasam_Small.webp'],
  ['Toledo', 'Bowling Green', 'ryLgs_1024_ToledoVsBowlingGreen_Small.webp'],
  ['Troy', 'South Alabama', 'ryLgs_1024_TroyVsSouthAlabama_Small.webp'],
  ['UCF', 'USF', 'ryLgs_1024_UcfVsSouthFlorida_Small.webp'],
  ['UTEP', 'New Mexico St.', 'ryLgs_1024_UtepVsNewMexicoState_Small.webp'],
  ['Virginia', 'Virginia Tech', 'ryLgs_1024_VirginiaVsVirginiaTech_Small.webp'],
  ['Washington', 'Washington St.', 'ryLgs_1024_WashingtonVsWashingtonState_Small.webp'],
];

/** Case/punctuation-insensitive, so "Texas A&M" and "TEXAS AM" are the same team. */
function normalizeTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Order-independent: a matchup is the same rivalry whoever is at home. */
function pairKey(a: string, b: string): string {
  return [normalizeTeam(a), normalizeTeam(b)].sort().join('|');
}

const LOGO_BY_PAIR = new Map(
  RIVALRY_LOGO_FILES.map(([teamA, teamB, file]) => [pairKey(teamA, teamB), `${RIVALRY_LOGO_BASE_PATH}/${file}`]),
);

/**
 * This matchup's rivalry logo, or null when it isn't one we can name.
 *
 * `isKnownRivalry` is the save's own rivalry flag for the user's team. It only
 * ever widens the result to the generic shield — a pairing with dedicated art
 * gets it either way, so a browsed team's Iron Bowl still shows the Iron Bowl.
 * Without the flag there is no fallback, because "these two teams played" is
 * not evidence of a rivalry.
 */
export function getRivalryLogoPath(teamA: string, teamB: string, isKnownRivalry = false): string | null {
  const known = LOGO_BY_PAIR.get(pairKey(teamA, teamB));
  if (known) return known;
  return isKnownRivalry ? DEFAULT_RIVALRY_LOGO : null;
}
