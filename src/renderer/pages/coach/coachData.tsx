import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CardBookModal } from '../../components/common/CardBookModal';
import { ScandalsModal } from '../../components/common/ScandalsModal';
import { useEditorModal } from '../../data/EditorModalProvider';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { buildCoachResumeMap, buildTenureMap, buildUserPositionByYear, type SeasonStaffSlice } from './coachMetrics';
import type { CoachResume } from '../../components/common/CoachCard';
import type { Coach, CareerCoachStats, CoachOverview, ScheduleOverview, SeasonOverview } from '../../../shared/types';

/** One season's coaches snapshot — the light half of a résumé slice. */
type SeasonCoachSlice = { seasonYear: number; coaches: CoachOverview | null };

/**
 * Coach Hub shared state.
 *
 * WHAT THE SHELL OWNS is deliberately small: the identity every destination
 * shows in its masthead, and nothing else. That's `getSeasonOverview` +
 * `getCoaches` for the selected season — two requests, flat, however long the
 * dynasty is. Each destination loads its own analysis.
 *
 * THE ALL-SEASONS RÉSUMÉ MAP IS OPT-IN, via `useCoachResumes()`. Building it
 * costs one `getCoaches` and one `getSchedule` per season — measured at ~1.1 MB
 * of snapshot JSON parsed per season on the main side (see
 * docs/coach-hub-phase0-data-availability.md) — and the old single-page Coach
 * did it on every visit to show a handful of scalars. Now only the destinations
 * that genuinely need per-coach history pay for it, it is fetched at most once
 * per dynasty+season-set, and it is shared by whoever asks.
 *
 * The modals live at the layout so they stay reachable from every destination
 * rather than being trapped on the page that happens to own the button.
 */
type CoachHubValue = {
  dynastyId: string;
  seasonId: number | undefined;
  /** undefined while loading, null when the dynasty/season has no data. */
  overview: SeasonOverview | null | undefined;
  coaches: CoachOverview | null | undefined;
  /** The human-controlled coach — HC, OC or DC, whoever the user actually plays as. */
  userCoach: Coach | null;
  /** Everyone else on staff, so the user is never listed twice. */
  staff: Coach[];
  career: CareerCoachStats | null;
  refreshCoaches: () => void;
  editCoach: (coach: Coach) => void;
  openCardbook: () => void;
  openScandals: () => void;
  /** Each coach's estimated first year here, from the per-season COACHES snapshots only. See useSeasonCoaches. */
  tenureByCoach: Map<string, number> | undefined;
  /** Full staff résumés — needs the per-season SCHEDULES too, so it costs twice as much. See useCoachResumes. */
  resumes: Map<string, CoachResume> | undefined;
  userPositionByYear: Map<number, string>;
  requestSeasonCoaches: () => void;
  requestResumes: () => void;
  /** Shared per-dynasty request cache — see useCoachQuery. */
  queryCache: QueryCache;
};

const CoachHubContext = createContext<CoachHubValue | null>(null);

export function useCoachHub(): CoachHubValue {
  const value = useContext(CoachHubContext);
  if (!value) throw new Error('useCoachHub must be used inside CoachHubProvider');
  return value;
}

/**
 * The same value with `overview` narrowed to non-null. The layout refuses to
 * render its Outlet until the shell data has resolved, so every destination is
 * guaranteed a real overview and none of them need to repeat the loading and
 * not-found branches the single-page Coach carried at the top.
 */
export type ReadyCoachHub = Omit<CoachHubValue, 'overview'> & { overview: SeasonOverview };

export function useCoachHubReady(): ReadyCoachHub {
  const value = useCoachHub();
  if (!value.overview) {
    throw new Error('useCoachHubReady used outside the CoachHubLayout readiness guard');
  }
  return value as ReadyCoachHub;
}

/**
 * A session cache shared by every Coach destination.
 *
 * THE WASTE THIS REMOVES IS REAL AND WAS MEASURED: `getHistory` had four callers
 * (Overview, Career, Milestones, Trophy Room), the national stat table three
 * (Overview, Season, Staff), and each one refetched on mount — so walking the
 * hub re-read the same league-wide snapshots several times over, and every
 * return visit paid again. Cached, a visited destination is instant.
 *
 * KEYS CARRY THE SEASON, so the cache can never serve one season's schedule to
 * another, and the whole map is dropped when the dynasty changes.
 *
 * The stale guard matters as much as the cache. A promise that resolves after
 * its key has moved on — the user clicking through seasons faster than the reads
 * complete — is dropped rather than written into state, which is the difference
 * between "slow" and "shows the wrong year's record".
 */
type QueryCache = Map<string, Promise<unknown>>;

export function useCoachQuery<T>(key: string | null, run: () => Promise<T>): T | undefined {
  const { queryCache } = useCoachHub();
  const [value, setValue] = useState<T | undefined>(undefined);
  // The runner is captured per key rather than per render — callers pass an
  // inline arrow, and depending on it would refetch on every keystroke elsewhere.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setValue(undefined);
    let promise = queryCache.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = runRef.current();
      queryCache.set(key, promise as Promise<unknown>);
    }
    promise
      .then((result) => {
        if (!cancelled) setValue(result);
      })
      .catch(() => {
        // A failed read must not poison the cache — the next visit retries.
        queryCache.delete(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key, queryCache]);

  return value;
}

/**
 * The same cache as `useCoachQuery`, as a plain function.
 *
 * Some destinations need several reads coordinated inside one effect — a
 * schedule and a league table and a recruiting class, resolved together so the
 * page doesn't paint in three stages. A hook can't be called per-read there, so
 * this hands back the join-or-start primitive to use inside the effect they
 * already have. Same map, same keys, same eviction on failure.
 */
export function useCachedFetch(): <T>(key: string, run: () => Promise<T>) => Promise<T> {
  const { queryCache } = useCoachHub();
  return useCallback(
    <T,>(key: string, run: () => Promise<T>): Promise<T> => {
      const existing = queryCache.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const promise = run().catch((error) => {
        queryCache.delete(key);
        throw error;
      });
      queryCache.set(key, promise as Promise<unknown>);
      return promise;
    },
    [queryCache],
  );
}

/**
 * Opt in to the LIGHT all-seasons load: one `getCoaches` per season, which is
 * enough for tenure and for the user's own position each year. Roughly half the
 * cost of the full résumé map, because it skips the per-season schedules.
 */
export function useSeasonCoaches(): Map<string, number> | undefined {
  const { tenureByCoach, requestSeasonCoaches } = useCoachHub();
  useEffect(() => {
    requestSeasonCoaches();
  }, [requestSeasonCoaches]);
  return tenureByCoach;
}

/**
 * Opt in to the full all-seasons staff résumé map (tenure AND each coach's
 * cumulative record here). Returns undefined while it loads. Safe to call from
 * several destinations at once — each request is made once and shared.
 */
export function useCoachResumes(): Map<string, CoachResume> | undefined {
  const { resumes, requestResumes } = useCoachHub();
  useEffect(() => {
    requestResumes();
  }, [requestResumes]);
  return resumes;
}

export function CoachHubProvider({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const { openCoachEditor } = useEditorModal();

  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [coaches, setCoaches] = useState<CoachOverview | null | undefined>(undefined);
  const [seasonCoaches, setSeasonCoaches] = useState<SeasonCoachSlice[] | undefined>(undefined);
  const [seasonSchedules, setSeasonSchedules] = useState<Map<number, ScheduleOverview | null> | undefined>(undefined);
  const [coachesWanted, setCoachesWanted] = useState(false);
  const [schedulesWanted, setSchedulesWanted] = useState(false);
  const [cardbookOpen, setCardbookOpen] = useState(false);
  const [scandalsOpen, setScandalsOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOverview(undefined);
    setCoaches(undefined);
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getCoaches(id, seasonId).then((result) => {
      if (!cancelled) setCoaches(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  // The season SET, not the selected season — the résumé map spans every synced
  // year, so switching the season selector must not refetch it.
  const seasonIds = useMemo(() => seasons.map((s) => s.id).join(','), [seasons]);

  // LEVEL 1 — one coaches snapshot per season (~0.45 MB each). Tenure and the
  // user's own position per year come from this alone.
  useEffect(() => {
    if (!id || !coachesWanted || seasons.length === 0) return;
    let cancelled = false;
    setSeasonCoaches(undefined);

    Promise.all(
      seasons.map(
        async (season): Promise<SeasonCoachSlice> => ({
          seasonYear: season.seasonYear,
          coaches: await window.api.db.getCoaches(id, season.id),
        }),
      ),
    ).then((slices) => {
      if (!cancelled) setSeasonCoaches(slices);
    });

    return () => {
      cancelled = true;
    };
    // seasonIds stands in for `seasons` so an identical list re-created on
    // render doesn't retrigger the most expensive request in the hub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, coachesWanted, seasonIds]);

  // LEVEL 2 — the per-season schedules (~0.95 MB each), needed only to give each
  // coach a win-loss record for the years they were here. Staff is the one
  // destination that asks for it.
  useEffect(() => {
    if (!id || !schedulesWanted || seasons.length === 0) return;
    let cancelled = false;
    setSeasonSchedules(undefined);

    Promise.all(
      seasons.map(async (season) => [season.seasonYear, await window.api.db.getSchedule(id, season.id)] as const),
    ).then((pairs) => {
      if (!cancelled) setSeasonSchedules(new Map(pairs));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, schedulesWanted, seasonIds]);

  const tenureByCoach = useMemo(
    () => (seasonCoaches ? buildTenureMap(seasonCoaches) : undefined),
    [seasonCoaches],
  );

  const userPositionByYear = useMemo(
    () => (seasonCoaches ? buildUserPositionByYear(seasonCoaches) : new Map<number, string>()),
    [seasonCoaches],
  );

  const resumes = useMemo(() => {
    if (!seasonCoaches || !seasonSchedules) return undefined;
    const slices: SeasonStaffSlice[] = seasonCoaches.map((s) => ({
      seasonYear: s.seasonYear,
      coaches: s.coaches,
      schedule: seasonSchedules.get(s.seasonYear) ?? null,
    }));
    return buildCoachResumeMap(slices);
  }, [seasonCoaches, seasonSchedules]);

  const refreshCoaches = useCallback(() => {
    if (!id) return;
    window.api.db.getCoaches(id, seasonId).then(setCoaches);
  }, [id, seasonId]);

  const editCoach = useCallback(
    (coach: Coach) => {
      if (!id) return;
      openCoachEditor({
        dynastyId: id,
        teamIndex: coach.teamIndex,
        position: coach.position,
        coachLabel: `${coach.firstName} ${coach.lastName}`,
        onSaved: refreshCoaches,
      });
    },
    [id, openCoachEditor, refreshCoaches],
  );

  /*
    Dropped wholesale when the dynasty changes — a cache that outlived its
    dynasty would be the worst kind of fast.

    Reset during render rather than in an effect, deliberately: an effect runs
    AFTER children have already read the context, so the first render of a new
    dynasty would be served the old dynasty's promises. Comparing a ref to the
    current id is the standard "derive state from a prop change" shape and has no
    such window.
  */
  const queryCacheRef = useRef<QueryCache>(new Map());
  const cachedDynastyRef = useRef(id);
  if (cachedDynastyRef.current !== id) {
    cachedDynastyRef.current = id;
    queryCacheRef.current = new Map();
  }
  const queryCache = queryCacheRef.current;

  const requestSeasonCoaches = useCallback(() => setCoachesWanted(true), []);
  const requestResumes = useCallback(() => {
    setCoachesWanted(true);
    setSchedulesWanted(true);
  }, []);

  const userCoach = coaches?.userCoach ?? null;
  const staff = useMemo(
    () =>
      coaches?.staff.filter(
        (c) => !(c.teamIndex === userCoach?.teamIndex && c.position === userCoach?.position),
      ) ?? [],
    [coaches, userCoach],
  );

  const value = useMemo<CoachHubValue>(
    () => ({
      dynastyId: id ?? '',
      seasonId,
      overview,
      coaches,
      userCoach,
      staff,
      career: userCoach?.careerStats ?? null,
      refreshCoaches,
      editCoach,
      openCardbook: () => setCardbookOpen(true),
      openScandals: () => setScandalsOpen(true),
      tenureByCoach,
      resumes,
      userPositionByYear,
      requestSeasonCoaches,
      requestResumes,
      queryCache,
    }),
    [
      queryCache,
      id,
      seasonId,
      overview,
      coaches,
      userCoach,
      staff,
      refreshCoaches,
      editCoach,
      tenureByCoach,
      resumes,
      userPositionByYear,
      requestSeasonCoaches,
      requestResumes,
    ],
  );

  return (
    <CoachHubContext.Provider value={value}>
      {children}
      <CoachHubModals
        dynastyId={id ?? ''}
        cardbookOpen={cardbookOpen}
        scandalsOpen={scandalsOpen}
        onCloseCardbook={() => setCardbookOpen(false)}
        onCloseScandals={() => setScandalsOpen(false)}
      />
    </CoachHubContext.Provider>
  );
}

/** Split out so the modal imports don't pull into every destination's module graph. */
function CoachHubModals({
  dynastyId,
  cardbookOpen,
  scandalsOpen,
  onCloseCardbook,
  onCloseScandals,
}: {
  dynastyId: string;
  cardbookOpen: boolean;
  scandalsOpen: boolean;
  onCloseCardbook: () => void;
  onCloseScandals: () => void;
}) {
  if (!dynastyId) return null;
  return (
    <>
      <ScandalsModal open={scandalsOpen} onClose={onCloseScandals} dynastyId={dynastyId} />
      <CardBookModal open={cardbookOpen} onClose={onCloseCardbook} dynastyId={dynastyId} />
    </>
  );
}
