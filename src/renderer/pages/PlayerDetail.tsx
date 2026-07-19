import { Link, useParams } from 'react-router-dom';
import { PlayerProfileContent } from '../components/common/PlayerProfileContent';

/**
 * Thin route wrapper around the shared PlayerProfileContent — kept for
 * deep-linking/bookmarking a specific player's page directly. Everywhere
 * else in the app (Roster, Awards, etc.), clicking a player name opens the
 * same content inside PlayerProfileModal instead of navigating here.
 */
export function PlayerDetail() {
  const { id, playerId } = useParams<{ id: string; playerId: string }>();

  if (!id || !playerId) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Player not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/dynasty/${id}/roster`}
        className="inline-flex text-sm font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
      >
        Back to Roster
      </Link>
      <PlayerProfileContent dynastyId={id} playerId={Number(playerId)} />
    </div>
  );
}