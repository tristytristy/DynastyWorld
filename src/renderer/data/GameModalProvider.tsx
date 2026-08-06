import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface GameModalState {
  dynastyId: string;
  gameId: number;
  seasonId: number | undefined;
  /**
   * The games either side of this one, in the order the caller was showing
   * them — what Prev/Next step through.
   *
   * PASSED IN RATHER THAN FETCHED, because "the next game" is a question about
   * the LIST YOU CAME FROM, not about the season. Opened from a schedule it
   * means the next row; opened from a player's game log it would mean his next
   * appearance. The modal has no way to know which, so the caller says.
   *
   * Empty (the default) simply hides the controls — every existing caller keeps
   * working, and one that has no meaningful sequence should not invent one.
   */
  siblings: number[];
}

interface GameModalContextValue {
  state: GameModalState | null;
  openGameModal: (dynastyId: string, gameId: number, seasonId?: number, siblings?: number[]) => void;
  /** Steps to another game in the same list, keeping the season and the siblings. */
  goToGame: (gameId: number) => void;
  closeGameModal: () => void;
}

const GameModalContext = createContext<GameModalContextValue | null>(null);

/** Global game box-score modal — a game opens as an overlay over wherever it was clicked (Schedule, a media tag), not a separate page (IA two-level rule). Mirrors PlayerModalProvider. */
export function GameModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameModalState | null>(null);
  const openGameModal = useCallback(
    (dynastyId: string, gameId: number, seasonId?: number, siblings: number[] = []) =>
      setState({ dynastyId, gameId, seasonId, siblings }),
    [],
  );
  const goToGame = useCallback(
    (gameId: number) => setState((prev) => (prev ? { ...prev, gameId } : prev)),
    [],
  );
  const closeGameModal = useCallback(() => setState(null), []);
  const value = useMemo(
    () => ({ state, openGameModal, goToGame, closeGameModal }),
    [state, openGameModal, goToGame, closeGameModal],
  );
  return <GameModalContext.Provider value={value}>{children}</GameModalContext.Provider>;
}

export function useGameModal(): GameModalContextValue {
  const ctx = useContext(GameModalContext);
  if (!ctx) throw new Error('useGameModal must be used within a GameModalProvider.');
  return ctx;
}
