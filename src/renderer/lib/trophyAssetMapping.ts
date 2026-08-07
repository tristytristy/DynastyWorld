import type { BowlAppearance, Trophy } from '../../shared/types';

const CONFCHAMP_BASE_PATH = 'cfbmedia://media/confchamp';
const BOWL_BASE_PATH = 'cfbmedia://media/bowlgames';
const PLAYOFF_BASE_PATH = 'cfbmedia://media/playoffs';
// Conference marks stay bundled with the app (tiny SVGs, needed for the
// fallback UI) — only the big raster art moves to the external image folder.
const CONF_BASE_PATH = 'assets/conf';
const AWARDS_BASE_PATH = 'cfbmedia://media/awards';
// Bundled with the app, like the conference marks - small files, and the trophy
// case would look broken without them if the external media folder is missing.
const RIVALRY_TROPHY_BASE_PATH = 'assets/rivalry/rivalrytophy';

const NATIONAL_CHAMPIONSHIP_TROPHY = `${CONFCHAMP_BASE_PATH}/confchamp__NationalChampionshipTrophy.webp`;
const BOWL_DEFAULT_LOGO = `${BOWL_BASE_PATH}/bowl_Default.webp`;

/**
 * The real `BowlGame.Name` strings the save uses for the three CFP bracket
 * rounds (verified directly - these are the exact values, not a guess; the
 * corresponding `AssetName` is blank for all of them, which is why they
 * needed dedicated art rather than the normalized-bowl-name matching used for
 * traditional bowls).
 */
const PLAYOFF_ROUND_FILES: Record<string, string> = {
  'CFP First Round': 'playoff_Round_1.webp',
  'CFP Quarterfinal': 'playoff_Qtr_Final.webp',
  'CFP Semifinal': 'playoff_Semi_Game.webp',
};

const NATIONAL_CHAMPIONSHIP_APPEARANCE = {
  dark: `${PLAYOFF_BASE_PATH}/playoff_NationalChampionshipWhite.webp`,
  light: `${PLAYOFF_BASE_PATH}/playoff_NationalChampionship.webp`,
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
  ACC: 'confchamp__ACCChampionshipTrophy.webp',
  American: 'confchamp__AACChampionshipTrophy.webp',
  'Conference USA': 'confchamp__CUSAChampionshipTrophy.webp',
  CUSA: 'confchamp__CUSAChampionshipTrophy.webp',
  'Big 12': 'confchamp__BIG12ChampionshipTrophy.webp',
  'Big Ten': 'confchamp__BIG10ChampionshipTrophy.webp',
  MAC: 'confchamp__MACChampionshipTrophy.webp',
  MWC: 'confchamp__MountainWestChampionshipTrophy.webp',
  'Mountain West': 'confchamp__MountainWestChampionshipTrophy.webp',
  'Pac-12': 'confchamp__PAC12ChampionshipTrophy.webp',
  SEC: 'confchamp__SECChampionshipTrophy.webp',
  'Sun Belt': 'confchamp__SunBeltChampionshipTrophy.webp',
};

/**
 * The championship GAME logo (the event mark), as distinct from the trophy
 * lifted afterwards above. Same conference-name keys, including the save's own
 * abbreviations - `Conference.Name` is "MWC", not "Mountain West".
 */
const CONFERENCE_CHAMPIONSHIP_GAME_FILES: Record<string, string> = {
  ACC: 'confchamp__ACCChampionship.webp',
  American: 'confchamp__AmericanChampionship.webp',
  'Conference USA': 'confchamp__CUSAChampionship.webp',
  CUSA: 'confchamp__CUSAChampionship.webp',
  'Big 12': 'confchamp__BIG12Championship.webp',
  'Big Ten': 'confchamp__BIG10Championship.webp',
  MAC: 'confchamp__MACChampionship.webp',
  MWC: 'confchamp__MountainWestChampionship.webp',
  'Mountain West': 'confchamp__MountainWestChampionship.webp',
  'Pac-12': 'confchamp__PAC12Championship.webp',
  SEC: 'confchamp__SECChampionship.webp',
  'Sun Belt': 'confchamp__SunBeltChampionship.webp',
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
 * instead.
 */
const AWARD_TROPHY_FILES: Record<string, string> = {
  HEISMAN: 'trophies_HeismanMemorialTrophy.webp',
  BEST_QB: 'trophies_DaveyOBrienAward.webp',
  BEST_SR_QB: 'trophies_JohnnyUnitas.webp',
  BEST_RB: 'trophies_DoakWalkerRunningBackAward.webp',
  BEST_REC: 'trophies_BiletnikoffAward.webp',
  BEST_TE: 'trophies_JohnMackeyAward.webp',
  BEST_KICK: 'trophies_LouGroza.webp',
  BEST_PUNT: 'trophies_RayGuyAward.webp',
  BEST_C: 'trophies_RimingtonTrophy.webp',
  BEST_IL: 'trophies_OutlandTrophy.webp',
  BEST_LB: 'trophies_ButkusAward.webp',
  BEST_DB: 'trophies_JimThorpeAward.webp',
  BEST_DL: 'trophies_Lombardi.webp',
  BEST_DE: 'trophies_CFB_Generic_Trophy_BestDefensiveEnd.webp',
  BEST_DEF_1: 'trophies_BronkoNagurskiTrophy.webp',
  BEST_DEF_2: 'trophies_ChuckBednarikAward.webp',
  BEST_POTY: 'trophies_WalterCampAward.webp',
  BEST_PLAYER: 'trophies_MaxwellAward.webp',
  BEST_FRESHMAN_POTY: 'trophies_ShaunAlexanderAward.webp',
  BEST_ACADEMIC: 'trophies_CampbellAward.webp',
  BEST_SR: 'trophies_TheJetAward.webp',
  MOST_VERSATILE: 'trophies_HornungAward.webp',
  BEST_HC: 'trophies_BearBryantHeadCoach.webp',
  BEST_AC: 'trophies_Broyles.webp',
};

/**
 * Bowl asset filenames are keyed on the save's `BowlGame.AssetName` (a stable
 * identity, e.g. "Bahamas_Bowl") with underscores stripped — which resolves
 * every bowl in the game except the three the art pack shipped under their
 * SPONSOR name instead (see BOWL_ART_ALIASES).
 *
 * A bowl that still doesn't resolve falls back to the generic
 * bowl_Default.webp, same as any bowl whose AssetName is blank (the CFP bracket
 * round entries — those are drawn by getPlayoffRoundImagePath instead).
 */
function normalizeBowlAssetName(assetName: string): string {
  return assetName.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Bowls whose shipped artwork is named after the current SPONSOR rather than
 * the bowl's stable identity.
 *
 * Keying on `AssetName` is deliberate and stays that way: sponsors rotate, so
 * "Xbox Bowl" is this season's branding for what is permanently the Bahamas
 * Bowl. But three bowls were exported from the game under the sponsor name, so
 * the correct lookup asks for a file that was never shipped — the art is
 * present and simply unreachable. Found by auditing every bowl in a real save
 * against the folder, after a report that the Xbox Bowl rendered nothing.
 *
 * LOGO AND TROPHY ARE LISTED SEPARATELY BECAUSE THE PACK IS INCONSISTENT WITH
 * ITSELF, which a single per-bowl stem could not express:
 *
 * - Guaranteed Rate ships its LOGO under the stable name and only its TROPHY
 *   under the sponsor's.
 * - Camellia capitalises the logo `SaluteTo…` and the trophy `Saluteto…`.
 *
 * Values are exact on-disk stems, not derived — that inconsistency is precisely
 * what a derivation would get wrong. Fixing this in code rather than by
 * renaming the files: public/assets is gitignored and distributed by
 * build/assets-installer.nsi, so a rename needs an installer change AND leaves
 * everyone who already installed the pack still broken.
 */
const BOWL_ART_ALIASES: Record<string, { logo?: string; trophy?: string }> = {
  Bahamas_Bowl: { logo: 'XboxBowl', trophy: 'XboxBowlTrophy' },
  Camellia_Bowl: { logo: 'SaluteToVeteransBowl', trophy: 'SalutetoVeteransBowlTrophy' },
  Guaranteed_Rate_Bowl: { trophy: 'RateBowlTrophy' },
};

export function getConferenceChampionshipTrophyPath(conferenceName: string): string | null {
  const file = CONFERENCE_TROPHY_FILES[conferenceName];
  return file ? `${CONFCHAMP_BASE_PATH}/${file}` : null;
}

/** The championship game's own mark. Null for a conference with no art (e.g. Independent). */
export function getConferenceChampionshipGamePath(conferenceName: string): string | null {
  const file = CONFERENCE_CHAMPIONSHIP_GAME_FILES[conferenceName];
  return file ? `${CONFCHAMP_BASE_PATH}/${file}` : null;
}

export function getBowlLogoPath(bowlAssetName: string | null): string {
  if (!bowlAssetName) return BOWL_DEFAULT_LOGO;
  const stem = BOWL_ART_ALIASES[bowlAssetName]?.logo ?? normalizeBowlAssetName(bowlAssetName);
  return `${BOWL_BASE_PATH}/bowl_${stem}.webp`;
}

export function getBowlTrophyPath(bowlAssetName: string | null): string {
  if (!bowlAssetName) return BOWL_DEFAULT_LOGO;
  const stem =
    BOWL_ART_ALIASES[bowlAssetName]?.trophy ?? `${normalizeBowlAssetName(bowlAssetName)}Trophy`;
  return `${BOWL_BASE_PATH}/bowl_${stem}.webp`;
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

/**
 * The national championship TROPHY itself — the physical prize, not the CFP
 * event mark. Used where a title game is being identified as the game it is
 * (scoreboard, game info, schedule badge): the trophy says “this one was for
 * everything” in a way the round logo does not.
 */
export function getNationalChampionshipTrophyPath(): string {
  return NATIONAL_CHAMPIONSHIP_TROPHY;
}
export function getNationalChampionshipAppearanceImagePath(background: 'light' | 'dark' = 'light'): string {
  return background === 'dark' ? NATIONAL_CHAMPIONSHIP_APPEARANCE.dark : NATIONAL_CHAMPIONSHIP_APPEARANCE.light;
}

/**
 * A rivalry trophy's art from its file stem — the stem IS the filename, because
 * the rename encoded both schools into it (see docs/RIVALRY_TROPHIES.md).
 *
 * Exported for the surfaces that know a MATCHUP rather than a won trophy: the
 * Game Info header asks "is there silverware on the table tonight", which is a
 * question about the pairing and has an answer before anyone has won anything.
 */
export function getRivalryTrophyPath(stem: string | null): string | null {
  return stem ? `${RIVALRY_TROPHY_BASE_PATH}/${stem}.webp` : null;
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
    // assetKey IS the file stem here - the rename encoded the schools into the
    // filename, so no second lookup is needed. See docs/RIVALRY_TROPHIES.md.
    case 'rivalry-win':
      return getRivalryTrophyPath(trophy.assetKey);
    default:
      return null;
  }
}

/** null for anything without dedicated trophy art (All-American tiers, weekly honors) - those render as text-only badges instead. */
/**
 * Every award the game hands out that has trophy art, in the order the Trophy
 * Room displays them. Exported so that room can show the ones NOT yet won as
 * silhouettes — a collection you can see the shape of is one you want to finish.
 */
export const ALL_AWARD_TYPES: string[] = Object.keys(AWARD_TROPHY_FILES);

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
