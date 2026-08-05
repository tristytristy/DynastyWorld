import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { CoachPortrait } from '../../components/common/CoachPortrait';
import { TeamLogo } from '../../components/common/TeamLogo';
import { spaceCamelCase } from '../../components/common/CoachCard';
import { GliderNav, gliderItemClass } from '../../components/ui/GliderNav';
import { PINNED_SUB_NAV_CLASS, usePinnedSubNav } from '../../lib/pinnedSubNav';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { CoachHubProvider, useCoachHub } from './coachData';

/**
 * The Coach destinations, in render order — the glider is driven by position.
 * Overview is the dynasty index route, so the whole hub stays reachable from
 * every existing deep link and the sidebar's "Coach" entry.
 *
 * The rest sit under a `coach/` namespace because the flat dynasty namespace is
 * already crowded: a Coach "Career" page called `history` would collide with
 * Team Hub's program history, and `schedule` is taken too. The Hall keeps its
 * long-standing top-level `hall` route rather than moving under that namespace —
 * it predates the hub and deep links to it exist.
 *
 * HALL OF LEGENDS IS A TAB (user direction, 2026-08-02). The refactor spec put
 * it outside the glider as a right-aligned action, on the reasoning that it's
 * cross-coach and all-time rather than a section of this coach's profile — but
 * one nav that lists every destination beats one nav plus an exception, and the
 * user made that call. LEGACY IS NOW "COACHING TREE" for the same reason: the
 * page is the tree, so it says so.
 */
export const COACH_TABS: { to: string; label: string }[] = [
  { to: '', label: 'Overview' },
  { to: 'coach/season', label: 'Season' },
  { to: 'coach/career', label: 'Career' },
  { to: 'coach/staff', label: 'Staff' },
  { to: 'coach/milestones', label: 'Milestones' },
  { to: 'coach/trophy-room', label: 'Trophy Room' },
  { to: 'hall', label: 'Hall of Champions' },
];

/**
 * Coach Hub shell — the persistent submenu and coach identity that every Coach
 * destination shares, replacing the two-item Overview|Hall pair switch.
 */
export function CoachHubLayout() {
  return (
    <CoachHubProvider>
      <CoachHubChrome />
    </CoachHubProvider>
  );
}

function CoachHubChrome() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const subNavRef = usePinnedSubNav<HTMLDivElement>();

  if (!id) return null;

  const sub = location.pathname.split(`/dynasty/${id}`)[1]?.replace(/^\//, '') ?? '';
  const activeIndex = COACH_TABS.findIndex((tab) => tab.to === sub);
  const onHall = sub === 'hall';

  return (
    <div className="space-y-5">
      {/* One row, one rail. `overflow-x-auto` stays on the WRAPPER rather than on
          GliderNav — the rail is positioned in the tab row's own coordinates, so
          it scrolls with the tabs instead of staying pinned to the visible edge. */}
      <div ref={subNavRef} className={`${PINNED_SUB_NAV_CLASS} -mx-1 px-1 py-2`}>
        <div className="overflow-x-auto">
          <GliderNav
            activeIndex={activeIndex}
            emphasis="quiet"
            ariaLabel="Coach Hub sections"
            itemsClassName="gap-1.5"
          >
            {COACH_TABS.map((tab) => (
              <Link
                key={tab.to || 'overview'}
                to={tab.to ? `/dynasty/${id}/${tab.to}` : `/dynasty/${id}`}
                className={gliderItemClass(tab.to === sub, 'px-3.5 py-1.5')}
              >
                {tab.label}
              </Link>
            ))}
          </GliderNav>
        </div>
      </div>

      {/* Overview owns the full cinematic hero and the Hall has its own
          masthead, so the compact identity line is for the other four only —
          otherwise every destination would open with a portrait. */}
      {sub.startsWith('coach/') && <CoachIdentityLine />}

      {/* The Hall is its own page with its own data — it must not be held
          behind the coach's shell state. */}
      {onHall ? <Outlet /> : <CoachDestination />}
    </div>
  );
}

/**
 * The readiness guard, once, for all five destinations. The single-page Coach
 * repeated these branches at the top of its render; keeping them here is what
 * lets every destination assume a resolved overview (see useCoachHubReady) and
 * keeps the submenu on screen while the shell data arrives, instead of blanking
 * the hub behind a global spinner.
 */
function CoachDestination() {
  const { overview, coaches, seasonId } = useCoachHub();
  const { seasons } = useSelectedSeason();

  if (overview === undefined || coaches === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Coach Hub...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return (
        <p className="text-slate-500 dark:text-slate-400">
          No detailed data for this season — see the note above.
        </p>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <Outlet />;
}

/**
 * The one-line "who and when" the four analysis destinations carry instead of a
 * hero. Name, role, team and season only — deliberately NOT tenure: tenure needs
 * the all-seasons résumé map, and a shared line that reads "2nd year" on the
 * destinations that happen to have loaded it and "3rd year" on the ones that
 * haven't would be worse than not showing it. It's an Overview fact.
 */
function CoachIdentityLine() {
  const { overview, userCoach } = useCoachHub();
  if (!overview) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--section-divider)] pb-4">
      {userCoach ? (
        <CoachPortrait coach={userCoach} teamAssetName={overview.teamName} size="sm" className="!h-10 !w-10" />
      ) : (
        <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="sm" />
      )}
      <div className="min-w-0">
        <p className="truncate font-display text-base font-bold text-slate-950 dark:text-white">
          {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {userCoach ? `${spaceCamelCase(userCoach.position)} · ` : ''}
          {overview.teamName} · {overview.seasonYear}
        </p>
      </div>
    </div>
  );
}
