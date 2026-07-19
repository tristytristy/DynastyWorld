import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Minimal display info for a player who may not be on the user's own roster (e.g. an opposing team's Heisman winner) — lets the modal render something useful instead of a bare "not found" when the full roster/stats lookup misses. */
export interface PlayerModalFallback {
  name: string;
  position: string;
  teamDisplayName: string;
  /** Real portrait, resolved leaguewide (see getLeaguePortraits.ts) — not roster-scoped like the rest of this fallback's callers usually assume. */
  portraitAssetName?: string | null;
}

interface PlayerModalState {
  dynastyId: string;
  playerId: number;
  /** The season the caller was actually browsing when the player was clicked (e.g. Roster's currently-selected season) — lets the modal resolve the player against that exact season's snapshot instead of always assuming the current/most-recent one. Undefined when the caller has no specific season in view (e.g. an award card spanning all seasons); the modal falls back to searching every season for the player in that case. */
  seasonId: number | undefined;
  /** The exact ordered list of player IDs currently visible wherever the modal was opened from (e.g. Roster's current sort/filter/search result) — enables Previous/Next. Undefined when opened from a context with no meaningful ordering (e.g. an award card). */
  navigationIds: number[] | undefined;
  fallback: PlayerModalFallback | undefined;
  /** Set when the player was opened while browsing another team via the team switcher — the profile and teammate rail then resolve against that team's league snapshot instead of the user's roster. */
  leagueTeamIndex: number | undefined;
}

interface PlayerModalContextValue {
  state: PlayerModalState | null;
  openPlayerModal: (
    dynastyId: string,
    playerId: number,
    seasonId?: number,
    navigationIds?: number[],
    fallback?: PlayerModalFallback,
    leagueTeamIndex?: number,
  ) => void;
  closePlayerModal: () => void;
  goToPlayer: (playerId: number, fallback?: PlayerModalFallback) => void;
}

const PlayerModalContext = createContext<PlayerModalContextValue | null>(null);

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerModalState | null>(null);

  const openPlayerModal = useCallback(
    (
      dynastyId: string,
      playerId: number,
      seasonId?: number,
      navigationIds?: number[],
      fallback?: PlayerModalFallback,
      leagueTeamIndex?: number,
    ) => {
      setState({ dynastyId, playerId, seasonId, navigationIds, fallback, leagueTeamIndex });
    },
    [],
  );

  const closePlayerModal = useCallback(() => setState(null), []);

  const goToPlayer = useCallback((playerId: number, fallback?: PlayerModalFallback) => {
    setState((prev) => (prev ? { ...prev, playerId, fallback } : prev));
  }, []);

  const value = useMemo<PlayerModalContextValue>(
    () => ({ state, openPlayerModal, closePlayerModal, goToPlayer }),
    [state, openPlayerModal, closePlayerModal, goToPlayer],
  );

  return <PlayerModalContext.Provider value={value}>{children}</PlayerModalContext.Provider>;
}

export function usePlayerModal(): PlayerModalContextValue {
  const ctx = useContext(PlayerModalContext);
  if (!ctx) {
    throw new Error('usePlayerModal must be used within a PlayerModalProvider.');
  }
  return ctx;
}
