import { buildTeamColorVars, type TeamColorVars } from '../lib/teamTheme';

/**
 * Phase B of the UI/UX overhaul: the color-theme priority chain sitting on top
 * of Phase A's static tokens and `teamTheme.ts`'s contrast-safe color math.
 *
 * `teamTheme.ts` answers "given these colors, produce WCAG-safe CSS vars."
 * This file answers the prior question — "*which* colors?" — via the
 * Custom → Team → Default priority chain, plus the persisted user preference
 * that selects between them. `ThemeProvider` wires this into React and applies
 * the result; the Preferences menu (Phase G) will drive the setters.
 */

export type ColorMode = 'team' | 'default' | 'custom';

export interface ThemePreference {
  /** team = active dynasty's colors; default = app brand; custom = user-picked. */
  colorMode: ColorMode;
  /** Only consulted when colorMode === 'custom'. Hex, validated on load. */
  customPrimary: string;
  customSecondary: string;
  /**
   * The page ground, per appearance — the surface everything else sits on.
   *
   * Defaults reproduce exactly what was hardcoded in globals.css before this
   * existed, so the setting changes nothing until it's deliberately used. The
   * two appearances are stored separately because one value can't serve both:
   * a ground that reads well behind light text is unreadable behind dark text.
   */
  groundDark: string;
  groundLight: string;
}

/** Active dynasty's colors, supplied by DynastyLayout; null outside a dynasty. */
export interface ActiveTeamColors {
  primary: string | null;
  secondary: string | null;
}

const BRAND_PRIMARY = '#9C9C9C'; // brand-500, DynastyOS silver
const BRAND_SECONDARY = '#6E6E6E'; // brand-700, DynastyOS silver (deep)
/** The grounds as they were hardcoded in globals.css — the "no opinion" values. */
export const DEFAULT_GROUND_DARK = '#000000';
export const DEFAULT_GROUND_LIGHT = '#e8eaed';
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  colorMode: 'team',
  customPrimary: BRAND_PRIMARY,
  customSecondary: BRAND_SECONDARY,
  groundDark: DEFAULT_GROUND_DARK,
  groundLight: DEFAULT_GROUND_LIGHT,
};

/** Storage key kept on the pre-DynastyOS prefix ON PURPOSE: it is invisible to users, and renaming it would silently discard the setting for everyone who already has one. */
const PREFERENCE_STORAGE_KEY = 'cfb-dynasty-hub:color-theme';

function isColorMode(value: unknown): value is ColorMode {
  return value === 'team' || value === 'default' || value === 'custom';
}

function validHexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_PATTERN.test(value) ? value : fallback;
}

/** Reads the persisted preference, coercing anything malformed back to defaults. */
export function loadThemePreference(storage: Pick<Storage, 'getItem'>): ThemePreference {
  try {
    const raw = storage.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<ThemePreference>;
    return {
      colorMode: isColorMode(parsed.colorMode) ? parsed.colorMode : DEFAULT_THEME_PREFERENCE.colorMode,
      customPrimary: validHexOr(parsed.customPrimary, DEFAULT_THEME_PREFERENCE.customPrimary),
      customSecondary: validHexOr(parsed.customSecondary, DEFAULT_THEME_PREFERENCE.customSecondary),
      // Absent in preferences saved before the ground was settable, so these
      // fall back to the defaults rather than to undefined.
      groundDark: validHexOr(parsed.groundDark, DEFAULT_THEME_PREFERENCE.groundDark),
      groundLight: validHexOr(parsed.groundLight, DEFAULT_THEME_PREFERENCE.groundLight),
    };
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function saveThemePreference(
  storage: Pick<Storage, 'setItem'>,
  preference: ThemePreference,
): void {
  try {
    storage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Non-fatal: preference simply won't persist across launches.
  }
}

/**
 * The priority chain. `team` falls through to Default whenever no active team
 * is present (e.g. the Dashboard, or a dynasty whose colors haven't loaded) —
 * buildTeamColorVars already substitutes the brand color for null inputs, so
 * "Team with no team" and "Default" resolve identically, by design.
 */
export function resolveThemeColors(
  preference: ThemePreference,
  team?: ActiveTeamColors | null,
): TeamColorVars {
  switch (preference.colorMode) {
    case 'custom':
      return buildTeamColorVars(preference.customPrimary, preference.customSecondary);
    case 'default':
      return buildTeamColorVars(null, null);
    case 'team':
    default:
      return buildTeamColorVars(team?.primary ?? null, team?.secondary ?? null);
  }
}
