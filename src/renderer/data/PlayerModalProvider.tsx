import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRecruitModal } from './RecruitModalProvider';

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
  const { openRecruitModal } = useRecruitModal();
  /*
    A routed open is a VIEW. Whether a recruit may be edited depends on the
    board's season being the dynasty's live one, which the Recruit Hub knows and
    this provider does not — so rather than guess, the edit affordance stays off
    here and remains where it is already correct: on the board itself.
  */
  const canEditRecruits = false;

  /*
    THE RECRUIT GUARD.

    Recruits live in the same Player table as roster players, so an id that
    reaches here is not necessarily a college player. Sent to the player modal, a
    prospect got the whole five-destination workspace — Journey, Player DNA,
    Season snapshot, Showcase, Development — none of which can mean anything for
    someone who has never played a college down, and all of it showing ratings
    the Recruit Hub deliberately keeps locked.

    Two callers were doing exactly that: global search, and the Recruit Hub's own
    "Open full" button. Rather than fix them one at a time and hope the next
    caller remembers, the check lives HERE, at the one door every caller goes
    through — including ones written later.

    A recruit costs one extra lookup before the modal appears; a roster player
    (the overwhelmingly common case) is unaffected, because the miss returns null
    and the player modal opens exactly as before. The id is resolved against the
    recruit pool, not the team index — see getRecruitIds for why 255 is not the
    test.
  */
  const openPlayerModal = useCallback(
    (
      dynastyId: string,
      playerId: number,
      seasonId?: number,
      navigationIds?: number[],
      fallback?: PlayerModalFallback,
      leagueTeamIndex?: number,
    ) => {
      void (async () => {
        /*
          THE REROUTE NEEDS A SEASON, and without one it does not happen.

          Player ids are NOT unique across seasons — the save re-uses them.
          Measured on the UCLA archive: 2 of 14 enshrined legends held ids the
          2028 recruit class had since handed to somebody else, so clicking Nico
          Iamaleava (#9147) in the Hall opened the RECRUIT modal for Rudy Bass.
          Wrong modal and wrong person, from one line that asked "is this id a
          prospect?" before opening a player.

          A career-spanning surface — the Hall, the Trophy Room, a milestone —
          has no single season to scope an id to, so it passed none, and
          `getRecruitById` fell back to the CURRENT season's pool and answered
          about a different human being. The id was never ambiguous; the question
          was, and asking it anyway is what produced a confident wrong answer.

          So: no season, no reroute. The player modal is the correct destination
          for every id the recruit pool doesn't legitimately claim, and every
          surface that genuinely opens prospects (the Recruit Hub and its
          boards) is season-scoped by nature and passes one.
        */
        if (seasonId === undefined) {
          setState({ dynastyId, playerId, seasonId, navigationIds, fallback, leagueTeamIndex });
          return;
        }
        try {
          const recruit = await window.api.db.getRecruitById(dynastyId, playerId, seasonId);
          if (recruit) {
            openRecruitModal(dynastyId, recruit, canEditRecruits);
            return;
          }
        } catch {
          // A failed lookup must never swallow the click — fall through and open
          // the player modal, which is the correct destination for every id the
          // recruit pool doesn't claim anyway.
        }
        setState({ dynastyId, playerId, seasonId, navigationIds, fallback, leagueTeamIndex });
      })();
    },
    [openRecruitModal, canEditRecruits],
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
