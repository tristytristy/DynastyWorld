import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import type { AwardsOverview } from '../../../shared/types';

export interface AwardsOutletContext {
  dynastyId: string;
  seasonId: number | undefined;
  awards: AwardsOverview;
}

const subTabClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-3.5 py-1.5 text-sm font-medium transition-all duration-base ease-standard',
    isActive
      ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
  ].join(' ');

/**
 * Shell for the four Awards subpages — fetches the shared AwardsOverview
 * once (all four subpages read from the same season-scoped payload, no
 * reason to refetch per tab) and renders a compact segmented sub-nav that
 * stays within the Awards section rather than adding another full-width top
 * nav row. Team Awards (a structurally different, app-generated dataset —
 * see TeamAwards.tsx) fetches its own data independently, same as before
 * this reorganization; this shell only owns the read-only, save-derived
 * AwardsOverview the other three subpages share.
 */
export function AwardsLayout() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [awards, setAwards] = useState<AwardsOverview | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setAwards(undefined);
    window.api.db.getAwards(id, seasonId).then((result) => {
      if (!cancelled) setAwards(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (!id) return null;

  if (awards === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading awards...</p>;
  }

  if (awards === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Awards not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Awards</p>
          <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
            Season honors, national recognition, and team-level awards.
          </h2>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto border border-slate-200/80 bg-slate-50/90 p-1.5 dark:border-slate-800 dark:bg-white/5">
          <NavLink to={`/dynasty/${id}/awards/annual`} className={subTabClass}>
            Annual Awards
          </NavLink>
          <NavLink to={`/dynasty/${id}/awards/all-teams`} className={subTabClass}>
            All-America &amp; All-Conference
          </NavLink>
          <NavLink to={`/dynasty/${id}/awards/team`} className={subTabClass}>
            Team Awards
          </NavLink>
          <NavLink to={`/dynasty/${id}/awards/weekly`} className={subTabClass}>
            Weekly Honors
          </NavLink>
        </div>
      </div>

      <Outlet context={{ dynastyId: id, seasonId, awards } satisfies AwardsOutletContext} />
    </div>
  );
}
