import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import { SelectedSeasonProvider, useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { ViewedTeamProvider } from '../../data/ViewedTeamProvider';
import type { DynastyTheme } from '../../../shared/types';

// Hard-edged tabs in the display face; the active tab carries the signature
// cut corner (shape language — see feedback_shape_language memory / DevLog).
function sectionTabClass(active: boolean): string {
  return [
    'px-4 py-2 font-display text-sm font-semibold transition-all duration-base ease-standard',
    active
      ? 'corner-cut-sm bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');
}

// The top nav is three sections (IA reorg 2026-07-19). Team and league pages
// keep flat URLs (pathless layout shells), so a section highlights by
// membership, not URL prefix.
const TEAM_PATHS = new Set([
  'team-hub', 'roster', 'schedule', 'statistics', 'trends', 'transfers',
  'recruiting', 'media', 'team-awards', 'weekly-honors', 'history',
]);
const LEAGUE_PATHS = new Set(['ncaa-hub', 'recruits', 'standings', 'annual-awards', 'all-america']);

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
      <Link to={`/dynasty/${dynastyId}/history`} className="font-medium underline underline-offset-2">
        Team Hub → History tab
      </Link>
      . Full roster, schedule, and stats require syncing while that season is current.
    </div>
  );
}

/** Top-level section nav: Coach Hub · Team Hub · NCAA Hub. Highlights by section membership since team/league pages keep flat URLs. */
function DynastyNav({ id }: { id: string }) {
  const location = useLocation();
  const sub = location.pathname.split(`/dynasty/${id}`)[1]?.replace(/^\//, '').split('/')[0] ?? '';
  const section = TEAM_PATHS.has(sub) ? 'team' : LEAGUE_PATHS.has(sub) ? 'league' : 'coach';

  return (
    <nav className="rounded-xl border border-white/65 bg-white/76 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.38)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76">
      <div className="corner-cut flex flex-wrap items-center gap-2 border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
        <Link to={`/dynasty/${id}`} className={sectionTabClass(section === 'coach')}>
          Coach Hub
        </Link>
        <Link to={`/dynasty/${id}/team-hub`} className={sectionTabClass(section === 'team')}>
          Team Hub
        </Link>
        <Link to={`/dynasty/${id}/ncaa-hub`} className={sectionTabClass(section === 'league')}>
          NCAA Hub
        </Link>
        <SeasonSwitcher />
      </div>
    </nav>
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
        <DynastyNav id={id} />
        <HistoryOnlySeasonBanner dynastyId={id} />
        <Outlet />
      </div>
      </ViewedTeamProvider>
    </SelectedSeasonProvider>
  );
}
