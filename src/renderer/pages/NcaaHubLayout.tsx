import { NavLink, Outlet, useParams } from 'react-router-dom';

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'shrink-0 px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * NCAA Hub shell — the league/national section (IA reorg 2026-07-19). The
 * counterpart to Team Hub: everything not tied to one program — the national
 * snapshot, standings, and the national award races — lives here as sub-tabs.
 * Pathless layout route, so the pages keep their flat URLs.
 */
export function NcaaHubLayout() {
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
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">NCAA Hub</p>
        <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
          The nation — rankings, standings, and national honors.
        </h2>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
        {tab('/ncaa-hub', 'Overview', true)}
        {tab('/standings', 'Standings')}
        {tab('/annual-awards', 'Annual Awards')}
        {tab('/all-america', 'All-America & All-Conf')}
        {tab('/ncaa-records', 'Record Book')}
      </div>

      <Outlet />
    </div>
  );
}
