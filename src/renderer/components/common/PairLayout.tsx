import { NavLink, Outlet, useParams } from 'react-router-dom';

const pillClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-4 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * A toggle between related pages that now share a single Team Hub tab — e.g.
 * Roster | Transfers, Schedule | Rivalries. Each pair is its own route group so
 * the pages themselves stay untouched (they keep their own headers/URLs); this
 * layout just renders the segmented switch above the matched page's Outlet. The
 * parent Team Hub tab highlights for either route (see TeamHubLayout).
 */
export function PairLayout({ items }: { items: { to: string; label: string }[] }) {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
        {items.map((item) => (
          <NavLink key={item.to} to={`/dynasty/${id}/${item.to}`} end className={pillClass}>
            {item.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
