import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { GliderNav, gliderItemClass, matchTabIndex } from '../components/ui/GliderNav';
import { PINNED_SUB_NAV_CLASS, usePinnedSubNav } from '../lib/pinnedSubNav';

/**
 * Render order — the glider is positional, so the list is the source of truth.
 * EXPORTED because DynastyLayout derives which top-level section is active from
 * it; a hand-kept second copy drifted and left four of these pages lighting up
 * "Coach" in the main nav.
 */
export const NCAA_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: '/ncaa-hub', label: 'Overview', end: true },
  { to: '/scores', label: 'Scores' },
  { to: '/national-stats', label: 'Statistics' },
  { to: '/players', label: 'Players' },
  { to: '/standings', label: 'Standings' },
  { to: '/annual-awards', label: 'Annual Awards' },
  { to: '/all-america', label: 'All-America & All-Conf' },
  { to: '/ncaa-records', label: 'Record Book' },
];

/**
 * NCAA Hub shell — the league/national section (IA reorg 2026-07-19). The
 * counterpart to Team Hub: everything not tied to one program — the national
 * snapshot, standings, and the national award races — lives here as sub-tabs.
 * Pathless layout route, so the pages keep their flat URLs.
 */
export function NcaaHubLayout() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  // Before the early return: hooks must run in the same order every render.
  const subNavRef = usePinnedSubNav<HTMLDivElement>();
  if (!id) return null;

  const base = `/dynasty/${id}`;
  const activeIndex = matchTabIndex(pathname, base, NCAA_TABS);

  return (
    <div className="space-y-5">
      {/* overflow-x-auto on the wrapper, not on GliderNav — eight tabs is the
          widest sub-nav in the app, and the rail has to scroll with them. */}
      <div ref={subNavRef} className={`${PINNED_SUB_NAV_CLASS} -mx-1 overflow-x-auto px-1 py-2`}>
        <GliderNav activeIndex={activeIndex} emphasis="quiet" ariaLabel="NCAA Hub sections" itemsClassName="gap-1.5">
          {NCAA_TABS.map((tab, index) => (
            <Link
              key={tab.to}
              to={`${base}${tab.to}`}
              className={gliderItemClass(index === activeIndex, 'px-3.5 py-1.5')}
            >
              {tab.label}
            </Link>
          ))}
        </GliderNav>
      </div>

      <Outlet />
    </div>
  );
}
