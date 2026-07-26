import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLink } from '../components/common/TeamLink';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useGameModal } from '../data/GameModalProvider';
import type { LeagueScoreGame } from '../../shared/types';

function ScoreLine({ name, teamIndex, score, won, played }: { name: string; teamIndex: number; score: number | null; won: boolean; played: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${won ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
      <TeamLink teamIndex={teamIndex} teamName={name} size="sm" className="min-w-0" logoClassName="shrink-0" nameClassName="truncate" />
      <span className="proportional-nums shrink-0">{played ? score : '—'}</span>
    </div>
  );
}

export function Scores() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const { openGameModal } = useGameModal();
  const [games, setGames] = useState<LeagueScoreGame[] | null | undefined>(undefined);
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setGames(undefined);
    setPickedWeek(null);
    window.api.db.getLeagueScores(id, seasonId).then((result) => {
      if (!cancelled) setGames(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const weeks = useMemo(() => [...new Set((games ?? []).map((g) => g.week))].sort((a, b) => a - b), [games]);
  // Default to the latest week that actually has a played game (most recent
  // action), falling back to the first week if nothing's been played.
  const defaultWeek = useMemo(() => {
    const played = (games ?? []).filter((g) => g.homeScore !== null);
    if (played.length) return Math.max(...played.map((g) => g.week));
    return weeks[0] ?? null;
  }, [games, weeks]);
  const activeWeek = pickedWeek ?? defaultWeek;

  if (!id) return null;
  if (games === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading scores...</p>;
  if (games === null) {
    return (
      <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
        No league schedule for this season — re-sync this dynasty to capture it.
      </SurfaceCard>
    );
  }

  const weekGames = games.filter((g) => g.week === activeWeek);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Scores</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every game in the country — click any for the full box score.
          </p>
        </div>
        <select
          value={activeWeek ?? ''}
          onChange={(event) => setPickedWeek(Number(event.target.value))}
          className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      {weekGames.length === 0 ? (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">No games this week.</SurfaceCard>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {weekGames.map((g) => {
            const played = g.homeScore !== null && g.awayScore !== null;
            const awayWon = played && (g.awayScore ?? 0) > (g.homeScore ?? 0);
            const homeWon = played && (g.homeScore ?? 0) > (g.awayScore ?? 0);
            return (
              <div
                key={g.gameId}
                role="button"
                tabIndex={0}
                onClick={() => openGameModal(id, g.gameId, seasonId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openGameModal(id, g.gameId, seasonId);
                  }
                }}
                className="flex cursor-pointer flex-col gap-1.5 border border-slate-200/80 bg-white/70 p-3.5 text-left text-sm transition hover:border-slate-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                {g.bowlName && (
                  <span className="type-eyebrow text-[var(--team-primary)]">{g.bowlName}</span>
                )}
                <ScoreLine name={g.awayTeamName} teamIndex={g.awayTeamIndex} score={g.awayScore} won={awayWon} played={played} />
                <ScoreLine name={g.homeTeamName} teamIndex={g.homeTeamIndex} score={g.homeScore} won={homeWon} played={played} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
