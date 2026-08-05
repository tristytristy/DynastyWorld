import { useMemo } from 'react';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useCoachHubReady, useCoachQuery } from './coachData';
import type { ProgramHistoryMilestone, ProgramHistoryOverview } from '../../../shared/types';

/**
 * Milestones — every notable thing that has happened, year by year.
 *
 * Replaces the Coaching Tree tab, which moved onto Staff behind the
 * Current/Tree switch (user direction 2026-08-02). Overview shows the latest
 * milestone and nothing else; this is the whole run of them.
 *
 * SORTED NEWEST FIRST, and within a year in the order `getHistory` produced
 * them. The stored list is grouped by KIND rather than by year — the reason
 * Overview's "latest milestone" card once showed a 2026 playoff run while the
 * page displayed 2027 — so this groups explicitly instead of trusting array
 * position.
 */
export function CoachMilestones() {
  const { dynastyId } = useCoachHubReady();
  // Shared with Overview, Career and the Trophy Room — fetched once per dynasty.
  const history = useCoachQuery<ProgramHistoryOverview | null>(
    dynastyId ? `history:${dynastyId}` : null,
    () => window.api.db.getHistory(dynastyId),
  );

  const byYear = useMemo(() => {
    const grouped = new Map<number, ProgramHistoryMilestone[]>();
    for (const m of history?.milestones ?? []) {
      const list = grouped.get(m.seasonYear) ?? [];
      list.push(m);
      grouped.set(m.seasonYear, list);
    }
    return [...grouped.entries()].sort((a, b) => b[0] - a[0]);
  }, [history]);

  if (history === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading milestones...</p>;
  }

  const total = history?.milestones?.length ?? 0;

  if (total === 0) {
    return (
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Milestones</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Nothing to mark yet
        </h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Conference titles, playoff runs, unbeaten seasons, signature wins and climbs up the poll all land here as you
          sync each season.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Milestones</p>
          <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Everything worth marking
          </h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {total} milestone{total === 1 ? '' : 's'} across {byYear.length} season{byYear.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {byYear.map(([year, items]) => (
          <div key={year}>
            {/* The year is the spine — a run of seasons reads as a career rather
                than as a flat list of achievements. */}
            <div className="flex items-center gap-3">
              <span className="tnum font-display text-lg font-bold text-[var(--team-accent-text)]">{year}</span>
              <span className="h-px flex-1 bg-[color:var(--section-divider)]" aria-hidden="true" />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {items.length} milestone{items.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {items.map((m, i) => (
                <li
                  key={`${year}-${m.label}-${i}`}
                  className="corner-cut-sm border-l-[3px] border-l-[var(--team-primary)]/60 border-y border-r border-y-slate-200/70 border-r-slate-200/70 bg-slate-50/70 px-3 py-2.5 dark:border-y-slate-800 dark:border-r-slate-800 dark:bg-white/5"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{m.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{m.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}
