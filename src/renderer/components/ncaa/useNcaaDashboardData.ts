import { useEffect, useState } from 'react';
import type {
  LeagueScoresView,
  NationalRecruit,
  NationalStatLeaders,
  NcaaHubOverview,
  RecruitingOverview,
  StandingsOverview,
} from '../../../shared/types';

/**
 * The NCAA dashboard's data, loaded as SIX INDEPENDENT requests rather than one
 * awaited batch.
 *
 * The panels are independent surfaces and they should arrive independently: the
 * national recruit pool is the heaviest of these by a distance, and a
 * `Promise.all` would hold the Top 25 and the Game of the Week hostage to it.
 * Each resource carries its own `undefined` (loading) / `null` (unavailable)
 * state so a panel can show its own skeleton or its own honest empty state
 * without the page having a single global verdict.
 *
 * `undefined` = still loading. `null` = the season has no such data (a
 * history-only season, a snapshot taken before that extractor existed, or a
 * failed read). Panels must handle both.
 */

type Fetcher<T> = (dynastyId: string, seasonId?: number) => Promise<T | null>;

// Module-level so the identities are stable across renders and the effect below
// only re-runs when the dynasty or season actually changes.
const fetchHub: Fetcher<NcaaHubOverview> = (id, season) => window.api.db.getNcaaHub(id, season);
const fetchScores: Fetcher<LeagueScoresView> = (id, season) => window.api.db.getLeagueScores(id, season);
const fetchLeaders: Fetcher<NationalStatLeaders> = (id, season) => window.api.db.getNationalStatLeaders(id, season);
const fetchNationalRecruits: Fetcher<NationalRecruit[]> = (id, season) =>
  window.api.db.getNationalRecruits(id, season);
const fetchRecruiting: Fetcher<RecruitingOverview> = (id, season) => window.api.db.getRecruits(id, season);
const fetchStandings: Fetcher<StandingsOverview> = (id, season) => window.api.db.getStandings(id, season);

function useDbResource<T>(fetcher: Fetcher<T>, dynastyId: string, seasonId?: number): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setValue(undefined);
    fetcher(dynastyId, seasonId)
      .then((result) => {
        if (!cancelled) setValue(result);
      })
      .catch(() => {
        // One panel's missing dataset is not the page's problem — it resolves to
        // `null` and that panel shows why it's empty.
        if (!cancelled) setValue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, dynastyId, seasonId]);

  return value;
}

export interface NcaaDashboardData {
  hub: NcaaHubOverview | null | undefined;
  scores: LeagueScoresView | null | undefined;
  leaders: NationalStatLeaders | null | undefined;
  nationalRecruits: NationalRecruit[] | null | undefined;
  recruiting: RecruitingOverview | null | undefined;
  standings: StandingsOverview | null | undefined;
}

export function useNcaaDashboardData(dynastyId: string, seasonId?: number): NcaaDashboardData {
  return {
    hub: useDbResource(fetchHub, dynastyId, seasonId),
    scores: useDbResource(fetchScores, dynastyId, seasonId),
    leaders: useDbResource(fetchLeaders, dynastyId, seasonId),
    nationalRecruits: useDbResource(fetchNationalRecruits, dynastyId, seasonId),
    recruiting: useDbResource(fetchRecruiting, dynastyId, seasonId),
    standings: useDbResource(fetchStandings, dynastyId, seasonId),
  };
}
