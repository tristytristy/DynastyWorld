import type { BowlAppearance, Trophy } from '../../shared/types';

const CONFCHAMP_BASE_PATH = 'assets/confchamp';
const BOWL_BASE_PATH = 'assets/bowlgames';
const PLAYOFF_BASE_PATH = 'assets/playoffs';
const CONF_BASE_PATH = 'assets/conf';
const AWARDS_BASE_PATH = 'assets/awards';

const NATIONAL_CHAMPIONSHIP_TROPHY = `${CONFCHAMP_BASE_PATH}/confchamp__NationalChampionshipTrophy.png`;
const BOWL_DEFAULT_LOGO = `${BOWL_BASE_PATH}/bowl_Default.png`;

/**
 * The real `BowlGame.Name` strings the save uses for the three CFP bracket
 * rounds (verified directly - these are the exact values, not a guess; the
 * corresponding `AssetName` is blank for all of them, which is why they
 * needed dedicated art rather than the normalized-bowl-name matching used for
 * traditional bowls).
 */
const PLAYOFF_ROUND_FILES: Record<string, string> = {
  'CFP First Round': 'playoff_Round_1.png',
  'CFP Quarterfinal': 'playoff_Qtr_Final.png',
  'CFP Semifinal': 'playoff_Semi_Game.png',
};

const NATIONAL_CHAMPIONSHIP_APPEARANCE = {
  dark: `${PLAYOFF_BASE_PATH}/playoff_NationalChampionshipWhite.png`,
  light: `${PLAYOFF_BASE_PATH}/playoff_NationalChampionship.png`,
};

interface ConferenceLogoFiles {
  dark: string;
  light: string;
}

/**
 * Exact map from the save's real `Conference.Name`/conferenceName string to
 * its logo file(s). The refreshed conf/ asset pack is a standardized SVG set
 * with most conferences shipping OD/OL light/dark variants and a few
 * intentionally using one file for both themes.
 */
const CONFERENCE_LOGO_FILES: Record<string, ConferenceLogoFiles> = {
  ACC: { dark: 'ACC_OD.svg', light: 'ACC_OL.svg' },
  American: { dark: 'AAC_OD.svg', light: 'AAC_OL.svg' },
  'Big 12': { dark: 'BIG12_OD.svg', light: 'BIG12_OL.svg' },
  'Big Ten': { dark: 'Big10_OD.svg', light: 'Big10_OL.svg' },
  CUSA: { dark: 'CUSA_OD.svg', light: 'CUSA_OL.svg' },
  'Conference USA': { dark: 'CUSA_OD.svg', light: 'CUSA_OL.svg' },
  MAC: { dark: 'MAC_OD.svg', light: 'MAC_OL.svg' },
  MWC: { dark: 'MWC_OD.svg', light: 'MWC_OL.svg' },
  'Mountain West': { dark: 'MWC_OD.svg', light: 'MWC_OL.svg' },
  'Pac-12': { dark: 'Pac12_OD.svg', light: 'Pac12_OL.svg' },
  SEC: { dark: 'SEC.svg', light: 'SEC.svg' },
  'Sun Belt': { dark: 'SunBelt.svg', light: 'SunBelt.svg' },
};

/**
 * Exact map from the save's real `Conference.Name` string to its trophy asset -
 * not a normalize-and-guess scheme. Verified against every real conference name
 * that produced a championship-game result in a real full-season save (10 of
 * the league's 12 conferences; the other 2 have no championship game). Three
 * of these needed an explicit alias because the conference's in-game name
 * doesn't match its asset filename convention at all (spelled out vs.
 * acronym): "Big Ten" -> BIG10, "Conference USA" doesn't appear as a
 * ConferenceName (it's "CUSA" already) but is included for safety, "American"
 * -> AAC. An unrecognized conference name intentionally renders no trophy
 * rather than guessing at a filename.
 */
const CONFERENCE_TROPHY_FILES: Record<string, string> = {
  ACC: 'confchamp__ACCChampionshipTrophy.png',
  American: 'confchamp__AACChampionshipTrophy.png',
  'Conference USA': 'confchamp__CUSAChampionshipTrophy.png',
  CUSA: 'confchamp__CUSAChampionshipTrophy.png',
  'Big 12': 'confchamp__BIG12ChampionshipTrophy.png',
  'Big Ten': 'confchamp__BIG10ChampionshipTrophy.png',
  MAC: 'confchamp__MACChampionshipTrophy.png',
  MWC: 'confchamp__MountainWestChampionshipTrophy.png',
  'Mountain West': 'confchamp__MountainWestChampionshipTrophy.png',
  'Pac-12': 'confchamp__PAC12ChampionshipTrophy.png',
  SEC: 'confchamp__SECChampionshipTrophy.png',
  'Sun Belt': 'confchamp__SunBeltChampionshipTrophy.png',
};

/**
 * Exact map from the save's real `AwardType` string (see extract-awards.ts -
 * verified against the save's real `LeagueHistoryAward` table) to the
 * closest real-world college football trophy image. Only Heisman is a
 * literal name match in the save; everything else is a generic
 * position-based name (`BEST_QB`, `BEST_LB`, etc.), so this pairing is
 * reasoned (see awardFormat.ts's fuller explanation, including the
 * BEST_SR/MOST_VERSATILE correction), not save-provided. All-American tiers
 * and weekly Player-of-the-Week honors intentionally have no entry here -
 * they're not single-winner awards, so they render as text-only badges
 * instead (see awardFormat.ts's isMarqueeAward).
 */
const AWARD_TROPHY_FILES: Record<string, string> = {
  HEISMAN: 'trophies_HeismanMemorialTrophy.png',
  BEST_QB: 'trophies_DaveyOBrienAward.png',
  BEST_SR_QB: 'trophies_JohnnyUnitas.png',
  BEST_RB: 'trophies_DoakWalkerRunningBackAward.png',
  BEST_REC: 'trophies_BiletnikoffAward.png',
  BEST_TE: 'trophies_JohnMackeyAward.png',
  BEST_KICK: 'trophies_LouGroza.png',
  BEST_PUNT: 'trophies_RayGuyAward.png',
  BEST_C: 'trophies_RimingtonTrophy.png',
  BEST_IL: 'trophies_OutlandTrophy.png',
  BEST_LB: 'trophies_ButkusAward.png',
  BEST_DB: 'trophies_JimThorpeAward.png',
  BEST_DL: 'trophies_Lombardi.png',
  BEST_DE: 'trophies_CFB_Generic_Trophy_BestDefensiveEnd.png',
  BEST_DEF_1: 'trophies_BronkoNagurskiTrophy.png',
  BEST_DEF_2: 'trophies_ChuckBednarikAward.png',
  BEST_POTY: 'trophies_WalterCampAward.png',
  BEST_PLAYER: 'trophies_MaxwellAward.png',
  BEST_FRESHMAN_POTY: 'trophies_ShaunAlexanderAward.png',
  BEST_ACADEMIC: 'trophies_CampbellAward.png',
  BEST_SR: 'trophies_TheJetAward.png',
  MOST_VERSATILE: 'trophies_HornungAward.png',
  BEST_HC: 'trophies_BearBryantHeadCoach.png',
  BEST_AC: 'trophies_Broyles.png',
};

/**
 * Bowl asset filenames are keyed on the save's `BowlGame.AssetName` (a stable
 * identity, e.g. "Bahamas_Bowl") with underscores stripped - verified against
 * the real bowlgames/ folder: 30 of 32 real (non-CFP-placeholder) bowls match
 * this normalization exactly. The 2 that don't (confirmed missing from the
 * asset pack entirely, not a naming mismatch) fall back to the generic
 * bowl_Default.png, same as any bowl whose AssetName didn't resolve at all
 * (the CFP bracket round entries, which have a blank AssetName in the save).
 */
function normalizeBowlAssetName(assetName: string): string {
  return assetName.replace(/[^a-zA-Z0-9]/g, '');
}

export function getConferenceChampionshipTrophyPath(conferenceName: string): string | null {
  const file = CONFERENCE_TROPHY_FILES[conferenceName];
  return file ? `${CONFCHAMP_BASE_PATH}/${file}` : null;
}

export function getBowlLogoPath(bowlAssetName: string | null): string {
  if (!bowlAssetName) return BOWL_DEFAULT_LOGO;
  return `${BOWL_BASE_PATH}/bowl_${normalizeBowlAssetName(bowlAssetName)}.png`;
}

export function getBowlTrophyPath(bowlAssetName: string | null): string {
  if (!bowlAssetName) return BOWL_DEFAULT_LOGO;
  return `${BOWL_BASE_PATH}/bowl_${normalizeBowlAssetName(bowlAssetName)}Trophy.png`;
}

/** null if `conferenceName` isn't a recognized real conference (e.g. "Independent") - never a guessed filename. */
export function getConferenceLogoPath(conferenceName: string, background: 'light' | 'dark' = 'light'): string | null {
  const files = CONFERENCE_LOGO_FILES[conferenceName];
  if (!files) return null;
  return `${CONF_BASE_PATH}/${background === 'dark' ? files.dark : files.light}`;
}

/** null if `bowlName` isn't one of the three known CFP round names. */
export function getPlayoffRoundImagePath(bowlName: string): string | null {
  const file = PLAYOFF_ROUND_FILES[bowlName];
  return file ? `${PLAYOFF_BASE_PATH}/${file}` : null;
}

export function getNationalChampionshipAppearanceImagePath(background: 'light' | 'dark' = 'light'): string {
  return background === 'dark' ? NATIONAL_CHAMPIONSHIP_APPEARANCE.dark : NATIONAL_CHAMPIONSHIP_APPEARANCE.light;
}

/** Resolves a Trophy DTO to its image path, or null if this trophy kind has nothing to show (unrecognized conference name). */
export function getTrophyImagePath(trophy: Trophy): string | null {
  switch (trophy.kind) {
    case 'national-championship':
      return NATIONAL_CHAMPIONSHIP_TROPHY;
    case 'conference-championship':
      return trophy.assetKey ? getConferenceChampionshipTrophyPath(trophy.assetKey) : null;
    case 'bowl-win':
      return getBowlTrophyPath(trophy.assetKey);
    default:
      return null;
  }
}

/** null for anything without dedicated trophy art (All-American tiers, weekly honors - see awardFormat.ts's isMarqueeAward) - those render as text-only badges instead. */
export function getAwardTrophyPath(awardType: string): string | null {
  const file = AWARD_TROPHY_FILES[awardType];
  return file ? `${AWARDS_BASE_PATH}/${file}` : null;
}

/**
 * The season's postseason-appearance image, win or loss - a traditional
 * bowl's event logo, the matching CFP bracket-round graphic, or the
 * appearance-appropriate (dark/light) national championship mark.
 */
export function getPostseasonAppearanceImagePath(
  bowl: BowlAppearance,
  background: 'light' | 'dark' = 'light',
): string {
  switch (bowl.kind) {
    case 'national-championship':
      return getNationalChampionshipAppearanceImagePath(background);
    case 'cfp-round':
      return getPlayoffRoundImagePath(bowl.bowlName) ?? BOWL_DEFAULT_LOGO;
    case 'bowl':
    default:
      return getBowlLogoPath(bowl.bowlAssetName);
  }
}
