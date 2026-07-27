import { Outlet, Link, useParams, useLocation } from 'react-router-dom';
import { TeamSwitcher } from '../components/common/TeamSwitcher';

const subTabClass = (active: boolean) =>
  [
    'shrink-0 px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    active
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
  const location = useLocation();
  if (!id) return null;

  // Flat URLs, so highlight by membership. Merged tabs (Roster, Schedule,
  // Statistics, Honors) stay active across either page in their pair.
  const sub = location.pathname.split(`/dynasty/${id}`)[1]?.replace(/^\//, '').split('/')[0] ?? 'team-hub';

  // The primary route each tab links to, plus every route it should highlight for.
  const tab = (to: string, label: string, paths: string[]) => (
    <Link to={`/dynasty/${id}/${to}`} className={subTabClass(paths.includes(sub))}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      {/* Sub-nav + team selector on one row — the selector carries team identity across every tab. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
          {tab('team-hub', 'Overview', ['team-hub', ''])}
          {tab('roster', 'Roster', ['roster', 'transfers'])}
          {tab('schedule', 'Schedule', ['schedule', 'rivalries'])}
          {tab('statistics', 'Statistics', ['statistics', 'trends'])}
          {tab('team-awards', 'Honors', ['team-awards', 'weekly-honors'])}
          {tab('history', 'History', ['history'])}
        </div>
        <div className="shrink-0">
          <TeamSwitcher />
        </div>
      </div>

      <Outlet />
    </div>
  );
}
