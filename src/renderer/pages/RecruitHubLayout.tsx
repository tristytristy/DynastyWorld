import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { GliderNav, gliderItemClass, matchTabIndex } from '../components/ui/GliderNav';

/** Render order — the glider is positional, so the list is the source of truth. */
const TABS: { to: string; label: string }[] = [
  { to: '/recruiting', label: 'My Board' },
  { to: '/recruits', label: 'National Recruits' },
  { to: '/watchlist', label: 'Watchlist' },
];

/**
 * Recruit Hub shell — a dedicated top-level section for everything recruiting
 * (2026-07-20). Promoted out of NCAA Hub / Team Hub because recruiting is where
 * players spend the most time and wanted it front-and-center: your own class
 * (My Board) and the whole national pool (National Recruits) as sub-tabs.
 * Pathless layout route, so the pages keep their flat URLs.
 */
export function RecruitHubLayout() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  if (!id) return null;

  const base = `/dynasty/${id}`;
  const activeIndex = matchTabIndex(pathname, base, TABS);

  return (
    <div className="space-y-5">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recruit Hub</p>
        <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
          Build your class — your board and the whole country.
        </h2>
      </div>

      <div className="overflow-x-auto">
        <GliderNav activeIndex={activeIndex} emphasis="quiet" ariaLabel="Recruit Hub sections" itemsClassName="gap-1.5">
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
