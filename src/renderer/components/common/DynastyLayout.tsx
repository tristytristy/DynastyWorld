import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { SelectedSeasonProvider, useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { ViewedTeamProvider } from '../../data/ViewedTeamProvider';
import type { DynastyTheme } from '../../../shared/types';

// Hard-edged tabs in the display face; the active tab carries the signature
// cut corner (shape language — see feedback_shape_language memory / DevLog).
const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-4 py-2 font-display text-sm font-semibold transition-all duration-base ease-standard',
    isActive
      ? 'corner-cut-sm bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

function SeasonSwitcher() {
  const { seasons, selectedSeasonId, setSelectedSeasonId } = useSelectedSeason();

  if (seasons.length <= 1) return null;

  return (
    <label className="ml-auto flex items-center gap-2 border border-slate-200/80 bg-slate-50/90 px-3.5 py-1.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
      <span>Season</span>
      <select
        value={selectedSeasonId ?? ''}
        onChange={(event) => setSelectedSeasonId(event.target.value ? Number(event.target.value) : undefined)}
        className="bg-transparent font-medium text-slate-900 outline-none dark:text-white"
      >
        {seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.seasonYear}
            {season.isCurrent ? ' (current)' : ''}
            {season.hasFullData ? '' : ' — History Only'}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A history-only season (backfilled from the save's own league-wide history
 * — see extract-league-history.ts) has no roster/schedule/stats/teams
 * snapshot, so every per-season page on this tab bar will just show its own
 * generic "not found" state. That's technically correct but gives no
 * context on its own — this banner supplies the missing "why," once, above
 * whichever tab is active, instead of rewriting every page's empty state.
 */
function HistoryOnlySeasonBanner({ dynastyId }: { dynastyId: string }) {
  const { seasons, selectedSeasonId } = useSelectedSeason();
  const selected = seasons.find((season) => season.id === selectedSeasonId);
  if (!selected || selected.hasFullData) return null;

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/90 px-5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <span className="font-semibold">{selected.seasonYear} — History Only.</span>{' '}
      This season wasn&apos;t individually synced, so only league-wide results (national/conference champions, season
      awards) are available — see the{' '}
      <Link to={`/dynasty/${dynastyId}/team-hub/history`} className="font-medium underline underline-offset-2">
        Team Hub → History tab
      </Link>
      . Full roster, schedule, and stats require syncing while that season is current.
    </div>
  );
}

export function DynastyLayout() {
  const { id } = useParams<{ id: string }>();
  const { resolveColorVars } = useTheme();
  const [theme, setTheme] = useState<DynastyTheme | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getDynastyTheme(id).then((result) => {
      if (!cancelled) setTheme(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const colorVars = resolveColorVars({
    primary: theme?.primaryColor ?? null,
    secondary: theme?.secondaryColor ?? null,
  });

  if (!id) return null;

  return (
    <SelectedSeasonProvider dynastyId={id}>
      <ViewedTeamProvider dynastyId={id}>
      <div style={colorVars as unknown as CSSProperties} className="space-y-6">
        <nav className="rounded-xl border border-white/65 bg-white/76 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.38)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76">
          <div className="corner-cut flex flex-wrap items-center gap-2 border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
            <NavLink to={`/dynasty/${id}`} end className={tabClass}>
              Coach Hub
            </NavLink>
            <NavLink to={`/dynasty/${id}/team-hub`} className={tabClass}>
              Team Hub
            </NavLink>
            <NavLink to={`/dynasty/${id}/ncaa-hub`} className={tabClass}>
              NCAA Hub
            </NavLink>
            <NavLink to={`/dynasty/${id}/roster`} className={tabClass}>
              Roster
            </NavLink>
            <NavLink to={`/dynasty/${id}/schedule`} className={tabClass}>
              Schedule
            </NavLink>
            <NavLink to={`/dynasty/${id}/standings`} className={tabClass}>
              Standings
            </NavLink>
            <NavLink to={`/dynasty/${id}/statistics`} className={tabClass}>
              Statistics
            </NavLink>
            <NavLink to={`/dynasty/${id}/awards`} className={tabClass}>
              Awards
            </NavLink>
            <NavLink to={`/dynasty/${id}/recruiting`} className={tabClass}>
              Recruiting
            </NavLink>
            <NavLink to={`/dynasty/${id}/media`} className={tabClass}>
              Media
            </NavLink>
            <SeasonSwitcher />
          </div>
        </nav>
        <HistoryOnlySeasonBanner dynastyId={id} />
        <Outlet />
      </div>
      </ViewedTeamProvider>
    </SelectedSeasonProvider>
  );
}
