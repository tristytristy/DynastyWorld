import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TeamColorVars } from '../lib/teamTheme';
import {
  DEFAULT_THEME_PREFERENCE,
  loadThemePreference,
  resolveThemeColors,
  saveThemePreference,
  type ActiveTeamColors,
  type ColorMode,
  type ThemePreference,
} from './themePreference';

export type Appearance = 'light' | 'dark';

/** Preserved from the pre–Phase-B Navbar so an existing dark-mode choice isn't lost. */
const APPEARANCE_STORAGE_KEY = 'cfb-dynasty-hub:theme';

function loadInitialAppearance(): Appearance {
  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeContextValue {
  preference: ThemePreference;
  appearance: Appearance;
  setColorMode: (mode: ColorMode) => void;
  setCustomColors: (primary: string, secondary: string) => void;
  setAppearance: (appearance: Appearance) => void;
  toggleAppearance: () => void;
  /**
   * Resolves the priority chain for a given active team (or none). DynastyLayout
   * passes the current dynasty's colors; team mode yields team colors while
   * custom/default modes ignore the argument — the chain lives in one place.
   */
  resolveColorVars: (team?: ActiveTeamColors | null) => TeamColorVars;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyColorVars(vars: TeamColorVars): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    loadThemePreference(window.localStorage),
  );
  const [appearance, setAppearanceState] = useState<Appearance>(loadInitialAppearance);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark');
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    } catch {
      // Non-fatal: appearance simply won't be restored next launch.
    }
  }, [appearance]);

  useEffect(() => {
    saveThemePreference(window.localStorage, preference);
    // Baseline colors on the root: custom/default apply app-wide; team with no
    // active dynasty falls back to the brand default (see resolveThemeColors).
    // DynastyLayout overrides this on its own subtree with the active team.
    applyColorVars(resolveThemeColors(preference));
  }, [preference]);

  const setColorMode = useCallback((colorMode: ColorMode) => {
    setPreference((prev) => ({ ...prev, colorMode }));
  }, []);

  const setCustomColors = useCallback((customPrimary: string, customSecondary: string) => {
    setPreference((prev) => ({ ...prev, customPrimary, customSecondary }));
  }, []);

  const setAppearance = useCallback((next: Appearance) => setAppearanceState(next), []);
  const toggleAppearance = useCallback(
    () => setAppearanceState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const resolveColorVars = useCallback(
    (team?: ActiveTeamColors | null) => resolveThemeColors(preference, team),
    [preference],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      appearance,
      setColorMode,
      setCustomColors,
      setAppearance,
      toggleAppearance,
      resolveColorVars,
    }),
    [preference, appearance, setColorMode, setCustomColors, setAppearance, toggleAppearance, resolveColorVars],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider.');
  }
  return ctx;
}

export { DEFAULT_THEME_PREFERENCE };
