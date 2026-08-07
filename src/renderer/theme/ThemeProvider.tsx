import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TeamColorVars } from '../lib/teamTheme';
import {
  DEFAULT_THEME_PREFERENCE,
  loadThemePreference,
  resolveThemeColors,
  saveThemePreference,
  type ActiveTeamColors,
  type ThemePreference,
} from './themePreference';

export type Appearance = 'light' | 'dark';

/** Preserved from the pre–Phase-B Navbar so an existing dark-mode choice isn't lost. */
/** Storage key kept on the pre-DynastyOS prefix ON PURPOSE: it is invisible to users, and renaming it would silently discard the setting for everyone who already has one. */
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
  /** The page ground for one appearance. Stored per theme; only the active one is applied. */
  setGround: (appearance: Appearance, color: string) => void;
  setAppearance: (appearance: Appearance) => void;
  toggleAppearance: () => void;
  /** The CSS vars for an active team (or none) — DynastyLayout passes the current dynasty's colors. */
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
    /*
      Only the ACTIVE appearance's ground is applied. Setting both and letting
      CSS pick would need two variables and a rule per theme; one variable that
      always means "the ground right now" keeps globals.css to a single
      declaration and makes a theme flip a one-property change.
    */
    document.documentElement.style.setProperty(
      '--ground',
      appearance === 'dark' ? preference.groundDark : preference.groundLight,
    );
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    } catch {
      // Non-fatal: appearance simply won't be restored next launch.
    }
    // The window's caption buttons are drawn by Windows OVER our page, so they
    // don't inherit anything from CSS — without this, flipping to light mode
    // leaves a black band across the top-right corner. Optional-chained because
    // the renderer also runs under the screenshot harness and older preloads.
    void window.api?.window?.setTitleBarTheme?.(appearance);
  }, [appearance, preference.groundDark, preference.groundLight]);

  useEffect(() => {
    saveThemePreference(window.localStorage, preference);
  }, [preference]);

  // Baseline colors on the root — the brand silver, since no dynasty is active
  // at this level. DynastyLayout overrides them on its own subtree with the
  // active team's, which is where team colour actually lands.
  useEffect(() => {
    applyColorVars(resolveThemeColors());
  }, []);

  /** Sets the ground for ONE appearance — light and dark are tuned separately. */
  const setGround = useCallback((target: Appearance, color: string) => {
    setPreference((prev) => (target === 'dark' ? { ...prev, groundDark: color } : { ...prev, groundLight: color }));
  }, []);

  const setAppearance = useCallback((next: Appearance) => setAppearanceState(next), []);
  const toggleAppearance = useCallback(
    () => setAppearanceState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  // Ctrl+Shift+Z flips light/dark from anywhere. Bound here rather than on a
  // page so it works whatever is on screen, and skipped while a text field has
  // focus so it can't hijack a real undo/redo in the notes or search boxes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName ?? '')) return;
      event.preventDefault();
      setAppearanceState((prev) => (prev === 'dark' ? 'light' : 'dark'));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const resolveColorVars = useCallback((team?: ActiveTeamColors | null) => resolveThemeColors(team), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      appearance,
      setGround,
      setAppearance,
      toggleAppearance,
      resolveColorVars,
    }),
    [preference, appearance, setGround, setAppearance, toggleAppearance, resolveColorVars],
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
