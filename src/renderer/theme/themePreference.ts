import { buildTeamColorVars, type TeamColorVars } from '../lib/teamTheme';

/**
 * Which colors the app runs on.
 *
 * `teamTheme.ts` answers "given these colors, produce WCAG-safe CSS vars."
 * This file answered the prior question — "*which* colors?" — and no longer
 * has to: THE ACTIVE DYNASTY'S COLORS, ALWAYS.
 *
 * There used to be a Theme Source setting with a Team mode and a Default mode
 * (a neutral brand palette), plus an unreachable Custom mode left over from the
 * original three-way chain. Removed on user direction (2026-08-07): team colour
 * is what the app is FOR, and the alternative was a switch that made every
 * dynasty look the same. Removed rather than hidden, so anyone whose stored
 * preference said `default` lands on team colours instead of being quietly
 * stuck on a mode with no control left to escape it — `loadThemePreference`
 * simply ignores the dead fields.
 *
 * The page ground stays settable: it is a different question (how dark is the
 * room), and it has its own control that still works.
 */

export interface ThemePreference {
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

/** The grounds as they were hardcoded in globals.css — the "no opinion" values. */
export const DEFAULT_GROUND_DARK = '#000000';
export const DEFAULT_GROUND_LIGHT = '#e8eaed';
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  groundDark: DEFAULT_GROUND_DARK,
  groundLight: DEFAULT_GROUND_LIGHT,
};

/** Storage key kept on the pre-DynastyOS prefix ON PURPOSE: it is invisible to users, and renaming it would silently discard the setting for everyone who already has one. */
const PREFERENCE_STORAGE_KEY = 'cfb-dynasty-hub:color-theme';

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
      // Any stored `colorMode` / `custom*` is deliberately dropped on the floor
      // — see the note at the top of this file.
      // The grounds are absent in preferences saved before they were settable,
      // so these fall back to the defaults rather than to undefined.
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
 * The active team's colors, always. Outside a dynasty — the Dashboard, or one
 * whose colors haven't loaded yet — `buildTeamColorVars` substitutes the brand
 * silver for null inputs, which is the neutral shell the app has always shown
 * there.
 */
export function resolveThemeColors(team?: ActiveTeamColors | null): TeamColorVars {
  return buildTeamColorVars(team?.primary ?? null, team?.secondary ?? null);
}
