import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSelectedSeason } from './SelectedSeasonProvider';
import type { LeagueTeamSummary } from '../../shared/types';

/**
 * Which team the team-scoped pages (Team Hub / Roster / Schedule /
 * Statistics / History) are currently viewing (2026-07-20 league browse
 * expansion). `null` = the user's own team — the default, and the only mode
 * with full data (gamelogs, team stats, kicking, record book). Other teams
 * render from the per-season league snapshots, with each page honest about
 * what isn't tracked for non-user teams. Resets to the user's team when the
 * dynasty or season changes.
 */
interface ViewedTeamContextValue {
  /** null = the user's own team (full data). */
  viewedTeamIndex: number | null;
  setViewedTeamIndex: (teamIndex: number | null) => void;
  /** All teams with league-snapshot rosters this season — dropdown source. Null when the season predates league snapshots. */
  leagueTeams: LeagueTeamSummary[] | null | undefined;
  /** The user's own team name this season (e.g. "C. Carolina") — for labels instead of a generic "My Team". */
  userTeamName: string | null;
}

const ViewedTeamContext = createContext<ViewedTeamContextValue | null>(null);

export function ViewedTeamProvider({ dynastyId, children }: { dynastyId: string; children: ReactNode }) {
  const { selectedSeasonId } = useSelectedSeason();
  const [viewedTeamIndex, setViewedTeamIndex] = useState<number | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<LeagueTeamSummary[] | null | undefined>(undefined);
  const [userTeamName, setUserTeamName] = useState<string | null>(null);

  useEffect(() => {
    setViewedTeamIndex(null);
    let cancelled = false;
    setLeagueTeams(undefined);
    window.api.db.getLeagueTeams(dynastyId, selectedSeasonId).then((result) => {
      if (!cancelled) setLeagueTeams(result);
    });
    window.api.db.getSeasonOverview(dynastyId, selectedSeasonId).then((overview) => {
      if (!cancelled) setUserTeamName(overview?.teamName ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, selectedSeasonId]);

  const set = useCallback((teamIndex: number | null) => setViewedTeamIndex(teamIndex), []);

  const value = useMemo<ViewedTeamContextValue>(
    () => ({ viewedTeamIndex, setViewedTeamIndex: set, leagueTeams, userTeamName }),
    [viewedTeamIndex, set, leagueTeams, userTeamName],
  );

  return <ViewedTeamContext.Provider value={value}>{children}</ViewedTeamContext.Provider>;
}

export function useViewedTeam(): ViewedTeamContextValue {
  const ctx = useContext(ViewedTeamContext);
  if (!ctx) throw new Error('useViewedTeam must be used within a ViewedTeamProvider.');
  return ctx;
}

/** Like useViewedTeam, but safe for components that also render outside DynastyLayout (e.g. inside the app-root player modal) — returns null there instead of throwing. */
export function useViewedTeamOptional(): ViewedTeamContextValue | null {
  return useContext(ViewedTeamContext);
}
