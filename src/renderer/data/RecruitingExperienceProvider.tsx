import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Recruiting "experience" preferences — app-side immersion settings that shape
 * how recruit data is shown, independent of any save.
 *
 * - `hideUnscoutedStats`: a spoiler-free mode (EXPERIENCE → Recruiting) that
 *   hides a recruit's overall rating (the OVR column + panel Overall row). The
 *   save stores full ratings for every recruit regardless of scouting and
 *   there's no clean per-recruit "revealed" flag, so this is a deliberate
 *   app-level toggle, not a mirror of the game's scout progress. Persisted.
 * - Athletic-snapshot lock: the detailed athletic breakdown starts LOCKED and
 *   is revealed only on a deliberate unlock (with a warning). A recruit can be
 *   unlocked individually, or all at once; re-locking clears everything back to
 *   locked. Kept in memory (not persisted), so a fresh launch always defaults
 *   to locked — the immersion-safe default.
 */
interface RecruitingExperienceValue {
  hideUnscoutedStats: boolean;
  setHideUnscoutedStats: (value: boolean) => void;

  /** True when a recruit's athletic snapshot is revealed (individually or via unlock-all). */
  isAthleticUnlocked: (playerId: number) => boolean;
  athleticUnlockedAll: boolean;
  unlockAthleticForRecruit: (playerId: number) => void;
  unlockAthleticForAll: () => void;
  /** Re-lock everything (individual unlocks + unlock-all) back to the default locked state. */
  lockAllAthletic: () => void;
}

const STORAGE_KEY = 'cfb.experience.hideUnscoutedStats';

const RecruitingExperienceContext = createContext<RecruitingExperienceValue | null>(null);

export function RecruitingExperienceProvider({ children }: { children: ReactNode }) {
  const [hideUnscoutedStats, setHideState] = useState<boolean>(
    () => window.localStorage.getItem(STORAGE_KEY) === '1',
  );
  const [athleticUnlockedAll, setAthleticUnlockedAll] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<number>>(() => new Set());

  const setHideUnscoutedStats = useCallback((value: boolean) => {
    setHideState(value);
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  }, []);

  const isAthleticUnlocked = useCallback(
    (playerId: number) => athleticUnlockedAll || unlockedIds.has(playerId),
    [athleticUnlockedAll, unlockedIds],
  );

  const unlockAthleticForRecruit = useCallback((playerId: number) => {
    setUnlockedIds((prev) => {
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
  }, []);

  const unlockAthleticForAll = useCallback(() => setAthleticUnlockedAll(true), []);

  const lockAllAthletic = useCallback(() => {
    setAthleticUnlockedAll(false);
    setUnlockedIds(new Set());
  }, []);

  const value = useMemo(
    () => ({
      hideUnscoutedStats,
      setHideUnscoutedStats,
      isAthleticUnlocked,
      athleticUnlockedAll,
      unlockAthleticForRecruit,
      unlockAthleticForAll,
      lockAllAthletic,
    }),
    [
      hideUnscoutedStats,
      setHideUnscoutedStats,
      isAthleticUnlocked,
      athleticUnlockedAll,
      unlockAthleticForRecruit,
      unlockAthleticForAll,
      lockAllAthletic,
    ],
  );

  return <RecruitingExperienceContext.Provider value={value}>{children}</RecruitingExperienceContext.Provider>;
}

export function useRecruitingExperience(): RecruitingExperienceValue {
  const ctx = useContext(RecruitingExperienceContext);
  if (!ctx) throw new Error('useRecruitingExperience must be used within RecruitingExperienceProvider');
  return ctx;
}
