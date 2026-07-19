import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SeasonSummary } from '../../shared/types';

interface SelectedSeasonContextValue {
  seasons: SeasonSummary[];
  selectedSeasonId: number | undefined;
  setSelectedSeasonId: (seasonId: number | undefined) => void;
  /** Re-fetches the season list without waiting for dynastyId to change — needed after an action (like relinking a save file) adds a season to the dynasty already being viewed. */
  refresh: () => void;
}

const SelectedSeasonContext = createContext<SelectedSeasonContextValue | null>(null);

/**
 * One persistent season selection shared by every dynasty page, mounted
 * once in DynastyLayout.tsx around <Outlet/> — replaces what used to be 8
 * separate pages each fetching their own season list and keeping their own
 * local seasonId state. getSeasons() already returns seasons sorted newest
 * first, so seasons[0] is the sane fallback if nothing is flagged current.
 */
export function SelectedSeasonProvider({ dynastyId, children }: { dynastyId: string; children: ReactNode }) {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | undefined>(undefined);

  const fetchSeasons = useCallback(() => {
    let cancelled = false;
    window.api.db.getSeasons(dynastyId).then((result) => {
      if (cancelled) return;
      setSeasons(result);
      const current = result.find((season) => season.isCurrent) ?? result[0];
      setSelectedSeasonId(current?.id);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId]);

  useEffect(() => {
    setSeasons([]);
    setSelectedSeasonId(undefined);
    return fetchSeasons();
  }, [fetchSeasons]);

  const value = useMemo<SelectedSeasonContextValue>(
    () => ({ seasons, selectedSeasonId, setSelectedSeasonId, refresh: fetchSeasons }),
    [seasons, selectedSeasonId, fetchSeasons],
  );

  return <SelectedSeasonContext.Provider value={value}>{children}</SelectedSeasonContext.Provider>;
}

export function useSelectedSeason(): SelectedSeasonContextValue {
  const ctx = useContext(SelectedSeasonContext);
  if (!ctx) {
    throw new Error('useSelectedSeason must be used within a SelectedSeasonProvider.');
  }
  return ctx;
}
