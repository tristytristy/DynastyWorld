import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { GliderNav, gliderItemClass, matchTabIndex } from '../components/ui/GliderNav';

/** Render order — the glider is positional, so the list is the source of truth. */
const TABS: { to: string; label: string; end?: boolean }[] = [
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
  if (!id) return null;

  const base = `/dynasty/${id}`;
  const activeIndex = matchTabIndex(pathname, base, TABS);

  return (
    <div className="space-y-5">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">NCAA Hub</p>
        <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
          The nation — rankings, standings, and national honors.
        </h2>
      </div>

      {/* overflow-x-auto on the wrapper, not on GliderNav — eight tabs is the
          widest sub-nav in the app, and the rail has to scroll with them. */}
      <div className="overflow-x-auto">
        <GliderNav activeIndex={activeIndex} emphasis="quiet" ariaLabel="NCAA Hub sections" itemsClassName="gap-1.5">
          {TABS.map((tab, index) => (
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
