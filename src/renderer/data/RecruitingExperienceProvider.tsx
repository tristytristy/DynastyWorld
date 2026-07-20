import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Recruiting "experience" preferences — app-side immersion settings that shape
 * how recruit data is shown, independent of any save. The first one:
 * `hideUnscoutedStats`, a spoiler-free mode for players who want to recruit the
 * way the game intends (you only really know a prospect's ratings after you've
 * scouted them). The save stores full ratings for every recruit regardless of
 * scouting, and there's no clean per-recruit "revealed" flag to key off — so
 * this is a deliberate app-level toggle, not an attempt to mirror the game's
 * per-prospect scout progress. Persisted in localStorage like the theme.
 */
interface RecruitingExperienceValue {
  hideUnscoutedStats: boolean;
  setHideUnscoutedStats: (value: boolean) => void;
}

const STORAGE_KEY = 'cfb.experience.hideUnscoutedStats';

const RecruitingExperienceContext = createContext<RecruitingExperienceValue | null>(null);

export function RecruitingExperienceProvider({ children }: { children: ReactNode }) {
  const [hideUnscoutedStats, setHideState] = useState<boolean>(
    () => window.localStorage.getItem(STORAGE_KEY) === '1',
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, hideUnscoutedStats ? '1' : '0');
  }, [hideUnscoutedStats]);

  const setHideUnscoutedStats = useCallback((value: boolean) => setHideState(value), []);

  const value = useMemo(
    () => ({ hideUnscoutedStats, setHideUnscoutedStats }),
    [hideUnscoutedStats, setHideUnscoutedStats],
  );

  return <RecruitingExperienceContext.Provider value={value}>{children}</RecruitingExperienceContext.Provider>;
}

export function useRecruitingExperience(): RecruitingExperienceValue {
  const ctx = useContext(RecruitingExperienceContext);
  if (!ctx) throw new Error('useRecruitingExperience must be used within RecruitingExperienceProvider');
  return ctx;
}
