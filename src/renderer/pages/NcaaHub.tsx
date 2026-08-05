import { Link, useParams } from 'react-router-dom';
import { NcaaDashboard } from '../components/ncaa/NcaaDashboard';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';

/**
 * NCAA Overview — the national front page.
 *
 * The page itself is now a shell: the scoreboard ribbon and the dashboard.
 * Everything that used to live here as its own card (the
 * hero, Game of the Week, Top 25 table, National Notebook, Undefeated Watch,
 * One-Loss Radar, Saturday Watch, Coach Spotlight, Around the Conferences,
 * Playoff Picture, Recruiting Buzz) is inside NcaaDashboard now — as one dense
 * three-column read rather than eleven stacked sections saying the same things
 * in a longer page. Each of those facts still has exactly one home; they moved,
 * they were not duplicated.
 *
 * The league roster browser and the national pulse rail were REMOVED outright
 * (user direction 2026-08-04), not folded in — browsing another team's roster
 * belongs to the Players page and the Team modal, and the pulse rail was
 * repeating facts the three columns above it already carry.
 */
export function NcaaHub() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">NCAA Hub not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NcaaDashboard dynastyId={id} seasonId={seasonId} />
    </div>
  );
}
