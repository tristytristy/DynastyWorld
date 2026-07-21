import { Outlet, NavLink, useParams } from 'react-router-dom';
import { TeamSwitcher } from '../components/common/TeamSwitcher';

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'shrink-0 px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * Team Hub shell — the home for everything about the selected team. Phase 4
 * unification (2026-07-21): the old standalone team-identity masthead was
 * removed (it duplicated the Overview page's own hero); the team selector now
 * lives in the sub-nav row itself. The single source of team identity is the
 * page hero (Team Overview Hero on the Overview tab, page headers elsewhere).
 * The switcher re-scopes every switcher-aware sub-tab at once. URLs stay flat.
 */
export function TeamHubLayout() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  const tab = (to: string, label: string, end = false) => (
    <NavLink to={`/dynasty/${id}${to}`} end={end} className={subTabClass}>
      {label}
    </NavLink>
  );

  return (
    <div className="space-y-5">
      {/* Sub-nav + team selector on one row — the selector carries team identity across every tab. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
          {tab('/team-hub', 'Overview', true)}
          {tab('/roster', 'Roster')}
          {tab('/schedule', 'Schedule')}
          {tab('/statistics', 'Statistics')}
          {tab('/trends', 'Trends')}
          {tab('/transfers', 'Transfers')}
          {tab('/media', 'Media')}
          {tab('/team-awards', 'Awards')}
          {tab('/weekly-honors', 'Weekly Honors')}
          {tab('/history', 'History')}
        </div>
        <div className="shrink-0">
          <TeamSwitcher />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
