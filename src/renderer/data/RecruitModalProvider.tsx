import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { RecruitBoardEntry } from '../../shared/types';

interface RecruitModalContextValue {
  dynastyId: string | null;
  recruit: RecruitBoardEntry | null;
  /** Whether the recruiting board's own season is the dynasty's current (live) season — RecruitProfileModal is mounted at the app root, outside SelectedSeasonProvider's scope, so this can't be recomputed there and is passed through instead, same reasoning as dynastyId. */
  canEdit: boolean;
  openRecruitModal: (dynastyId: string, recruit: RecruitBoardEntry, canEdit: boolean) => void;
  closeRecruitModal: () => void;
}

const RecruitModalContext = createContext<RecruitModalContextValue | null>(null);

/**
 * The recruiting board already has the full RecruitBoardEntry in memory when a
 * row is clicked, so unlike PlayerModalProvider this holds the entry directly
 * rather than an id to re-fetch. `dynastyId` is carried alongside it so the
 * modal's own Edit button can open the recruit editor without needing a
 * separate route param. Mounted at the app root (see app.tsx) rather than
 * locally in Recruiting.tsx because a page-local modal renders inside
 * <main>'s clip-path and gets visually clipped.
 */
export function RecruitModalProvider({ children }: { children: ReactNode }) {
  const [dynastyId, setDynastyId] = useState<string | null>(null);
  const [recruit, setRecruit] = useState<RecruitBoardEntry | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const openRecruitModal = useCallback((id: string, entry: RecruitBoardEntry, editable: boolean) => {
    setDynastyId(id);
    setRecruit(entry);
    setCanEdit(editable);
  }, []);
  const closeRecruitModal = useCallback(() => setRecruit(null), []);

  const value = useMemo<RecruitModalContextValue>(
    () => ({ dynastyId, recruit, canEdit, openRecruitModal, closeRecruitModal }),
    [dynastyId, recruit, canEdit, openRecruitModal, closeRecruitModal],
  );

  return <RecruitModalContext.Provider value={value}>{children}</RecruitModalContext.Provider>;
}

export function useRecruitModal(): RecruitModalContextValue {
  const ctx = useContext(RecruitModalContext);
  if (!ctx) {
    throw new Error('useRecruitModal must be used within a RecruitModalProvider.');
  }
  return ctx;
}
