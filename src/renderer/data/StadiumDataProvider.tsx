import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { canonicalKey } from '../lib/assetMapping';
import { DEFAULT_TEAM_STADIUMS, getDefaultStadiumInfo, type StadiumInfo } from '../lib/stadiumData';

/**
 * User-editable layer on top of the built-in stadium reference data —
 * corrections for research errors, or real-world stadium moves/renames,
 * without needing a code change. Persisted the same way theme preferences
 * are (localStorage, see themePreference.ts) since this is global app data,
 * not per-dynasty (a stadium correction should apply no matter which save is
 * open) — it doesn't belong in the SQLite dynasty database.
 */
/** Storage key kept on the pre-DynastyOS prefix ON PURPOSE: it is invisible to users, and renaming it would silently discard the setting for everyone who already has one. */
const STORAGE_KEY = 'cfb-dynasty-hub:stadium-overrides';

function isStadiumInfo(value: unknown): value is StadiumInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<StadiumInfo>).team === 'string' &&
    typeof (value as Partial<StadiumInfo>).stadium === 'string' &&
    typeof (value as Partial<StadiumInfo>).city === 'string' &&
    typeof (value as Partial<StadiumInfo>).state === 'string'
  );
}

function loadOverrides(storage: Pick<Storage, 'getItem'>): Record<string, StadiumInfo> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, StadiumInfo> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isStadiumInfo(value)) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function saveOverrides(storage: Pick<Storage, 'setItem'>, overrides: Record<string, StadiumInfo>): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Non-fatal: edits simply won't persist across launches.
  }
}

interface StadiumDataContextValue {
  /** Keyed the same as DEFAULT_TEAM_STADIUMS — only entries the user has actually edited/added. */
  overrides: Record<string, StadiumInfo>;
  /** Override if one exists, else the built-in default, else null (team genuinely not covered). */
  getStadium: (teamName: string) => StadiumInfo | null;
  /** Always the built-in value, ignoring any override — for showing "original" in the editor. */
  getDefaultStadium: (teamName: string) => StadiumInfo | null;
  isOverridden: (teamName: string) => boolean;
  setOverride: (teamName: string, info: Omit<StadiumInfo, 'team'>) => void;
  resetOverride: (teamName: string) => void;
  resetAllOverrides: () => void;
}

const StadiumDataContext = createContext<StadiumDataContextValue | null>(null);

export function StadiumDataProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, StadiumInfo>>(() =>
    loadOverrides(window.localStorage),
  );

  useEffect(() => {
    saveOverrides(window.localStorage, overrides);
  }, [overrides]);

  const setOverride = useCallback((teamName: string, info: Omit<StadiumInfo, 'team'>) => {
    const key = canonicalKey(teamName);
    setOverrides((prev) => ({ ...prev, [key]: { team: teamName, ...info } }));
  }, []);

  const resetOverride = useCallback((teamName: string) => {
    const key = canonicalKey(teamName);
    setOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetAllOverrides = useCallback(() => setOverrides({}), []);

  const getDefaultStadium = useCallback((teamName: string) => getDefaultStadiumInfo(teamName), []);

  const getStadium = useCallback(
    (teamName: string) => {
      const key = canonicalKey(teamName);
      return overrides[key] ?? DEFAULT_TEAM_STADIUMS[key] ?? null;
    },
    [overrides],
  );

  const isOverridden = useCallback((teamName: string) => canonicalKey(teamName) in overrides, [overrides]);

  const value = useMemo<StadiumDataContextValue>(
    () => ({ overrides, getStadium, getDefaultStadium, isOverridden, setOverride, resetOverride, resetAllOverrides }),
    [overrides, getStadium, getDefaultStadium, isOverridden, setOverride, resetOverride, resetAllOverrides],
  );

  return <StadiumDataContext.Provider value={value}>{children}</StadiumDataContext.Provider>;
}

export function useStadiumData(): StadiumDataContextValue {
  const ctx = useContext(StadiumDataContext);
  if (!ctx) {
    throw new Error('useStadiumData must be used within a StadiumDataProvider.');
  }
  return ctx;
}
