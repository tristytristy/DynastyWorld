import { NavLink, Outlet, useParams } from 'react-router-dom';
import { TeamSwitcher } from '../components/common/TeamSwitcher';

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * Team Hub shell. History became a subpage of Team Hub (2026-07-19) — both
 * the season overview and the program's history live under this one section,
 * governed by a single team switcher so switching to another program carries
 * across both sub-tabs. The switcher reads/writes the shared ViewedTeamProvider
 * (mounted in DynastyLayout), so it also stays in sync with Roster/Schedule/etc.
 */
export function TeamHubLayout() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
          <NavLink to={`/dynasty/${id}/team-hub`} end className={subTabClass}>
            Overview
          </NavLink>
          <NavLink to={`/dynasty/${id}/team-hub/history`} className={subTabClass}>
            History
          </NavLink>
        </div>
        <TeamSwitcher />
      </div>

      <Outlet />
    </div>
  );
}
