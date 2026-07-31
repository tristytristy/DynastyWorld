import { SurfaceCard } from '../ui/SurfaceCard';
import { PlayerPortrait } from './PlayerPortrait';
import { unitForPosition } from '../../lib/rosterOrder';

/** The minimal player shape both the user roster (RosterPlayer) and league roster (LeagueRosterPlayer) satisfy. */
export interface TopPlayerEntry {
  id: number;
  firstName: string;
  lastName: string;
  position: string;
  overallRating: number;
  portraitAssetName: string | null;
  schoolYear?: string;
}

/**
 * Shared "Top players" section used by BOTH the user's Team Hub and any browsed
 * league team (Phase 4 unification) — a single implementation so the two hubs
 * present rosters identically. Shows portrait + name + class + position +
 * rating, and opens the player modal on click.
 *
 * THE TWO COLUMNS ARE OFFENSE AND DEFENSE (2026-07-29, user direction), not one
 * overall list wrapped into two. A straight top-10 is usually lopsided — a good
 * team's ten best are often seven offensive players — so the reader can't see
 * their defense at all. Split, each side always shows its own best.
 *
 * Special-teams players (K, P) appear in neither column: they're a third unit
 * with two spots, and giving them a column would leave it mostly empty.
 */
export function TopPlayersCard({
  players,
  onSelect,
  limit = 10,
  title = 'Top players',
  teamAssetName,
}: {
  players: TopPlayerEntry[];
  onSelect: (player: TopPlayerEntry) => void;
  limit?: number;
  title?: string;
  /** The team these players belong to — dresses each portrait in that jersey. */
  teamAssetName?: string | null;
}) {
  const ranked = [...players].sort((a, b) => b.overallRating - a.overallRating);
  // `limit` stays the total across both columns, so an existing caller passing
  // 10 still gets ten names — five a side rather than ten in overall order.
  const perSide = Math.ceil(limit / 2);
  const offense = ranked.filter((p) => unitForPosition(p.position) === 'Offense').slice(0, perSide);
  const defense = ranked.filter((p) => unitForPosition(p.position) === 'Defense').slice(0, perSide);
  if (offense.length === 0 && defense.length === 0) return null;

  const row = (p: TopPlayerEntry) => (
    <button
      key={p.id}
      type="button"
      onClick={() => onSelect(p)}
      className="flex w-full items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <PlayerPortrait player={p} size="sm" className="!h-9 !w-9" teamAssetName={teamAssetName} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
        {p.firstName} {p.lastName}
      </span>
      {p.schoolYear && (
        <span className="type-meta shrink-0 text-slate-400 dark:text-slate-500">
          {p.schoolYear.replace(/([a-z])([A-Z])/g, '$1 $2')}
        </span>
      )}
      <span className="type-meta shrink-0 text-slate-500 dark:text-slate-400">{p.position}</span>
      <span className="type-stat-sm shrink-0 text-slate-950 dark:text-white">{p.overallRating}</span>
    </button>
  );

  const column = (heading: string, entries: TopPlayerEntry[]) => (
    <div>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{heading}</p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">No players on this side of the ball.</p>
      ) : (
        <div className="mt-3 space-y-2">{entries.map(row)}</div>
      )}
    </div>
  );

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {column('Offense', offense)}
        {column('Defense', defense)}
      </div>
    </SurfaceCard>
  );
}
