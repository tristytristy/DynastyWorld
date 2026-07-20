import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Recruiting "experience" preferences — app-side immersion settings for how
 * recruit data is shown, independent of any save.
 *
 * Two INDEPENDENT reveal locks — a prospect's overall rating and their detailed
 * athletic ratings — each start LOCKED and are revealed only on a deliberate
 * unlock (with a warning). Revealing one never reveals the other. A stat can be
 * unlocked for a single recruit or all at once; re-locking resets that stat
 * back to fully locked. Kept in memory (not persisted), so a fresh launch
 * always defaults to locked — the immersion-safe default. This mirrors how the
 * game itself keeps ratings hidden until you scout; the save exposes full
 * ratings regardless, so this is a deliberate app-level gate.
 */
interface LockControls {
  unlockedAll: boolean;
  isUnlocked: (playerId: number) => boolean;
  unlockForRecruit: (playerId: number) => void;
  unlockForAll: () => void;
  lockAll: () => void;
}

interface RecruitingExperienceValue {
  ovr: LockControls;
  athletic: LockControls;
}

const RecruitingExperienceContext = createContext<RecruitingExperienceValue | null>(null);

function useLockSet(): LockControls {
  const [unlockedAll, setUnlockedAll] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<number>>(() => new Set());

  const isUnlocked = useCallback(
    (playerId: number) => unlockedAll || unlockedIds.has(playerId),
    [unlockedAll, unlockedIds],
  );
  const unlockForRecruit = useCallback((playerId: number) => {
    setUnlockedIds((prev) => {
      const next = new Set(prev);
      next.add(playerId);
      return next;
    });
  }, []);
  const unlockForAll = useCallback(() => setUnlockedAll(true), []);
  const lockAll = useCallback(() => {
    setUnlockedAll(false);
    setUnlockedIds(new Set());
  }, []);

  return useMemo(
    () => ({ unlockedAll, isUnlocked, unlockForRecruit, unlockForAll, lockAll }),
    [unlockedAll, isUnlocked, unlockForRecruit, unlockForAll, lockAll],
  );
}

export function RecruitingExperienceProvider({ children }: { children: ReactNode }) {
  const ovr = useLockSet();
  const athletic = useLockSet();

  const value = useMemo(() => ({ ovr, athletic }), [ovr, athletic]);

  return <RecruitingExperienceContext.Provider value={value}>{children}</RecruitingExperienceContext.Provider>;
}

export function useRecruitingExperience(): RecruitingExperienceValue {
  const ctx = useContext(RecruitingExperienceContext);
  if (!ctx) throw new Error('useRecruitingExperience must be used within RecruitingExperienceProvider');
  return ctx;
}
