import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import type { SeasonOverview } from '../../shared/types';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamSwitcher } from '../components/common/TeamSwitcher';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'shrink-0 px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * Team Hub shell — the home for everything about the selected team (IA
 * reorg 2026-07-19). A persistent masthead (logo · name · record · team
 * switcher) stays pinned above a sub-nav of the team's pages; the switcher
 * re-scopes every switcher-aware sub-tab at once. URLs stay flat (this is a
 * pathless layout route), so existing links keep working. Anything finer than
 * a sub-tab — a player, a game — opens as a modal.
 */
export function TeamHubLayout() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId } = useSelectedSeason();
  const { viewedTeamIndex, leagueTeams, userTeamName } = useViewedTeam();
  const [overview, setOverview] = useState<SeasonOverview | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, selectedSeasonId).then((r) => !cancelled && setOverview(r ?? null));
    return () => {
      cancelled = true;
    };
  }, [id, selectedSeasonId]);

  if (!id) return null;

  const viewingLeagueTeam = viewedTeamIndex !== null;
  const teamName = viewingLeagueTeam
    ? (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team')
    : (userTeamName ?? overview?.teamName ?? 'Team');
  const record = !viewingLeagueTeam && overview ? `${overview.record.wins}-${overview.record.losses}` : null;

  const tab = (to: string, label: string, end = false) => (
    <NavLink to={`/dynasty/${id}${to}`} end={end} className={subTabClass}>
      {label}
    </NavLink>
  );

  return (
    <div className="space-y-5">
      {/* Persistent team masthead — always visible above the sub-nav. */}
      <div className="flex flex-col gap-4 border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <TeamLogo team={{ assetName: teamName, label: teamName }} size="md" />
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-bold leading-none text-slate-950 dark:text-white">{teamName}</h2>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {record ? (
                <>
                  <span className="tnum font-semibold text-slate-700 dark:text-slate-200">{record}</span>
                  {overview && <span>· {overview.seasonYear}</span>}
                </>
              ) : (
                <span>League view</span>
              )}
            </p>
          </div>
        </div>
        <TeamSwitcher />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
        {tab('/team-hub', 'Overview', true)}
        {tab('/roster', 'Roster')}
        {tab('/schedule', 'Schedule')}
        {tab('/statistics', 'Statistics')}
        {tab('/trends', 'Trends')}
        {tab('/transfers', 'Transfers')}
        {tab('/recruiting', 'Recruiting')}
        {tab('/media', 'Media')}
        {tab('/team-awards', 'Awards')}
        {tab('/weekly-honors', 'Weekly Honors')}
        {tab('/history', 'History')}
      </div>

      <Outlet />
    </div>
  );
}
