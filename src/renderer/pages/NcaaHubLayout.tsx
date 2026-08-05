import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { GliderNav, gliderItemClass, matchTabIndex } from '../components/ui/GliderNav';
import { PINNED_SUB_NAV_CLASS, usePinnedSubNav } from '../lib/pinnedSubNav';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';

/**
 * Render order — the glider is positional, so the list is the source of truth.
 * EXPORTED because DynastyLayout derives which top-level section is active from
 * it; a hand-kept second copy drifted and left four of these pages lighting up
 * "Coach" in the main nav.
 */
export const NCAA_TABS: { to: string; label: string; end?: boolean; postseasonOnly?: boolean }[] = [
  { to: '/ncaa-hub', label: 'Overview', end: true },
  { to: '/scores', label: 'Scores' },
  /*
    Right after Scores rather than last: when the playoff is live it is the most
    important thing in this section, and position nine buries it. Hidden until
    the season reaches the postseason — a Playoff tab during week 6 leads to an
    empty page, and the bracket genuinely doesn't exist until the week after the
    conference championships.
  */
  { to: '/playoff', label: 'Playoff', postseasonOnly: true },
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
  const { seasons, selectedSeasonId } = useSelectedSeason();

  /*
    The glider is POSITIONAL, so the rendered list has to be the same one
    matchTabIndex measures against — filtering here and matching against the
    full list would light up the wrong tab for everything after Playoff.
  */
  const postseasonReached =
    seasons.find((season) => season.id === selectedSeasonId)?.postseasonReached ?? false;
  const tabs = NCAA_TABS.filter((tab) => !tab.postseasonOnly || postseasonReached);

  if (!id) return null;

  const base = `/dynasty/${id}`;
  const activeIndex = matchTabIndex(pathname, base, tabs);

  return (
    <div className="space-y-5">
      {/* overflow-x-auto on the wrapper, not on GliderNav — nine tabs is the
          widest sub-nav in the app, and the rail has to scroll with them. */}
      <div ref={subNavRef} className={`${PINNED_SUB_NAV_CLASS} -mx-1 overflow-x-auto px-1 py-2`}>
        <GliderNav activeIndex={activeIndex} emphasis="quiet" ariaLabel="NCAA Hub sections" itemsClassName="gap-1.5">
          {tabs.map((tab, index) => (
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
