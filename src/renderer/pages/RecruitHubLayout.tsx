import { NavLink, Outlet, useParams } from 'react-router-dom';

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'shrink-0 px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * Recruit Hub shell — a dedicated top-level section for everything recruiting
 * (2026-07-20). Promoted out of NCAA Hub / Team Hub because recruiting is where
 * players spend the most time and wanted it front-and-center: your own class
 * (My Board) and the whole national pool (National Recruits) as sub-tabs.
 * Pathless layout route, so the pages keep their flat URLs.
 */
export function RecruitHubLayout() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  const tab = (to: string, label: string, end = false) => (
    <NavLink to={`/dynasty/${id}${to}`} end={end} className={subTabClass}>
      {label}
    </NavLink>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recruit Hub</p>
        <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
          Build your class — your board and the whole country.
        </h2>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
        {tab('/recruiting', 'My Board')}
        {tab('/recruits', 'National Recruits')}
        {tab('/watchlist', 'Watchlist')}
      </div>

      <Outlet />
    </div>
  );
}
