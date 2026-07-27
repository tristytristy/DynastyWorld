import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamLink } from '../components/common/TeamLink';
import type { HeadToHeadOpponent } from '../../shared/types';

function seriesLine(o: HeadToHeadOpponent): string {
  return o.ties > 0 ? `${o.wins}-${o.losses}-${o.ties}` : `${o.wins}-${o.losses}`;
}

/** Green when the user is ahead in the series, red when behind, neutral when even. */
function seriesTone(o: HeadToHeadOpponent): string {
  if (o.wins > o.losses) return 'text-emerald-600 dark:text-emerald-400';
  if (o.losses > o.wins) return 'text-red-600 dark:text-red-400';
  return 'text-slate-700 dark:text-slate-200';
}

function StreakBadge({ o }: { o: HeadToHeadOpponent }) {
  if (!o.streakType || o.streakCount === 0) return null;
  const cls =
    o.streakType === 'W'
      ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : o.streakType === 'L'
        ? 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
        : 'border-slate-300/70 bg-slate-100/70 text-slate-700 dark:border-slate-600 dark:bg-white/5 dark:text-slate-300';
  return (
    <span className={`shrink-0 border px-2 py-0.5 text-xs font-bold ${cls}`}>
      {o.streakCount}{o.streakType} streak
    </span>
  );
}

function marginText(avg: number): { text: string; cls: string } {
  const rounded = avg.toFixed(1);
  if (avg > 0.05) return { text: `+${rounded}`, cls: 'text-emerald-600 dark:text-emerald-400' };
  if (avg < -0.05) return { text: rounded, cls: 'text-red-600 dark:text-red-400' };
  return { text: '±0.0', cls: 'text-slate-500 dark:text-slate-400' };
}

function GameList({ o }: { o: HeadToHeadOpponent }) {
  return (
    <div className="mt-3 space-y-1">
      {o.games.map((g, i) => (
        <div
          key={`${g.seasonYear}-${g.week}-${i}`}
          className="flex items-center justify-between gap-3 border border-slate-200/70 bg-slate-50/70 px-2.5 py-1.5 text-sm dark:border-slate-800 dark:bg-white/5"
        >
          <span className="tnum shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{g.seasonYear}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {g.neutral ? 'N' : g.isHome ? 'vs' : '@'} {g.bowlName ? g.bowlName : `Wk ${g.week}`}
          </span>
          <span
            className={`shrink-0 text-xs font-bold ${g.result === 'W' ? 'text-emerald-600 dark:text-emerald-400' : g.result === 'L' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}
          >
            {g.result}
          </span>
          <span className="tnum shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {g.teamScore}-{g.opponentScore}
          </span>
        </div>
      ))}
    </div>
  );
}

function RivalCard({ o }: { o: HeadToHeadOpponent }) {
  const margin = marginText(o.avgMargin);
  return (
    <SurfaceCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamLogo team={{ assetName: o.opponentName, label: o.opponentName }} size="md" className="!h-10 !w-10" />
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              <TeamLink teamIndex={o.opponentTeamIndex ?? undefined} teamName={o.opponentName} />
            </h3>
            {o.rivalryName && <p className="type-eyebrow text-[var(--team-accent-text)]">{o.rivalryName}</p>}
          </div>
        </div>
        <StreakBadge o={o} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`type-stat-sm ${seriesTone(o)}`}>{seriesLine(o)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">series</p>
        </div>
        <div>
          <p className={`type-stat-sm ${margin.cls}`}>{margin.text}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">avg margin</p>
        </div>
        <div>
          <p className="type-stat-sm text-slate-700 dark:text-slate-200">{o.games.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">meeting{o.games.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <GameList o={o} />
    </SurfaceCard>
  );
}

export function Rivalries() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<HeadToHeadOpponent[] | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setData(undefined);
    window.api.db.getHeadToHead(id).then((r) => {
      if (!cancelled) setData(r ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rivals = (data ?? []).filter((o) => o.isRival);
  const others = (data ?? []).filter((o) => !o.isRival);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rivalries & Head-to-Head"
        title="Every series you've built."
        description="All-time record vs every opponent you've played across your synced seasons — series record, current streak, and average margin. Your program's designated rivals lead the way. Only this app keeps the per-season schedule history that makes this possible."
      />

      {data === undefined ? (
        <p className="text-slate-500 dark:text-slate-400">Loading rivalries…</p>
      ) : data.length === 0 ? (
        <SurfaceCard className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No games recorded yet. Sync a season with played games and your head-to-head history fills in — and grows every year.
        </SurfaceCard>
      ) : (
        <>
          {rivals.length > 0 && (
            <div>
              <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">Your rivals</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rivals.map((o) => (
                  <RivalCard key={o.opponentTeamIndex ?? o.opponentName} o={o} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">All-time series</p>
            <SurfaceCard className="overflow-hidden p-0">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Opponent</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Series</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Streak</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Avg Margin</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((o) => {
                      const margin = marginText(o.avgMargin);
                      return (
                        <tr key={o.opponentTeamIndex ?? o.opponentName} className="border-b border-slate-200/60 dark:border-white/5">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <TeamLogo team={{ assetName: o.opponentName, label: o.opponentName }} size="sm" className="!h-5 !w-5 shrink-0" />
                              <TeamLink teamIndex={o.opponentTeamIndex ?? undefined} teamName={o.opponentName} nameClassName="truncate" />
                            </span>
                          </td>
                          <td className={`tnum px-3 py-2 text-right font-semibold ${seriesTone(o)}`}>{seriesLine(o)}</td>
                          <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                            {o.streakType ? `${o.streakCount}${o.streakType}` : '—'}
                          </td>
                          <td className={`tnum px-3 py-2 text-right ${margin.cls}`}>{margin.text}</td>
                          <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">{o.games.length}</td>
                        </tr>
                      );
                    })}
                    {others.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                          Only rivalry games recorded so far.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
}
