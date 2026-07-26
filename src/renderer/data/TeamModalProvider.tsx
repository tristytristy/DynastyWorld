import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The global Team modal (2026-07-25). Mirrors PlayerModalProvider: any team name
 * across the app can open a premier team card by teamIndex. Mounted inside
 * DynastyLayout (not app-root like the player modal) because its "View Team Hub"
 * button drives the ViewedTeamProvider's setViewedTeamIndex + the router, both of
 * which only exist inside the dynasty subtree.
 */
interface TeamModalState {
  dynastyId: string;
  teamIndex: number;
  /** The season in view when the team name was clicked; undefined falls back to the current season. */
  seasonId: number | undefined;
}

interface TeamModalContextValue {
  state: TeamModalState | null;
  openTeamModal: (dynastyId: string, teamIndex: number, seasonId?: number) => void;
  closeTeamModal: () => void;
}

const TeamModalContext = createContext<TeamModalContextValue | null>(null);

export function TeamModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeamModalState | null>(null);

  const openTeamModal = useCallback((dynastyId: string, teamIndex: number, seasonId?: number) => {
    setState({ dynastyId, teamIndex, seasonId });
  }, []);

  const closeTeamModal = useCallback(() => setState(null), []);

  const value = useMemo<TeamModalContextValue>(
    () => ({ state, openTeamModal, closeTeamModal }),
    [state, openTeamModal, closeTeamModal],
  );

  return <TeamModalContext.Provider value={value}>{children}</TeamModalContext.Provider>;
}

export function useTeamModal(): TeamModalContextValue {
  const ctx = useContext(TeamModalContext);
  if (!ctx) {
    throw new Error('useTeamModal must be used within a TeamModalProvider.');
  }
  return ctx;
}

/** Safe outside DynastyLayout (returns null instead of throwing) — mirrors useViewedTeamOptional. */
export function useTeamModalOptional(): TeamModalContextValue | null {
  return useContext(TeamModalContext);
}
