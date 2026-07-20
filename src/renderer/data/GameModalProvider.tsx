import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface GameModalState {
  dynastyId: string;
  gameId: number;
  seasonId: number | undefined;
}

interface GameModalContextValue {
  state: GameModalState | null;
  openGameModal: (dynastyId: string, gameId: number, seasonId?: number) => void;
  closeGameModal: () => void;
}

const GameModalContext = createContext<GameModalContextValue | null>(null);

/** Global game box-score modal — a game opens as an overlay over wherever it was clicked (Schedule, a media tag), not a separate page (IA two-level rule). Mirrors PlayerModalProvider. */
export function GameModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameModalState | null>(null);
  const openGameModal = useCallback(
    (dynastyId: string, gameId: number, seasonId?: number) => setState({ dynastyId, gameId, seasonId }),
    [],
  );
  const closeGameModal = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ state, openGameModal, closeGameModal }), [state, openGameModal, closeGameModal]);
  return <GameModalContext.Provider value={value}>{children}</GameModalContext.Provider>;
}

export function useGameModal(): GameModalContextValue {
  const ctx = useContext(GameModalContext);
  if (!ctx) throw new Error('useGameModal must be used within a GameModalProvider.');
  return ctx;
}
