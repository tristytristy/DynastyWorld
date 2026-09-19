import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * 4th & Forever — the Net's podcast. One episode summary per generated week:
 * teams rising and falling, hot seats, and the weekly overreaction the two
 * hosts argue about.
 */
export function NetPods() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [episodes, setEpisodes] = useState<NetPost[]>([]);

  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getEditions(id, selectedSeasonId, 'podcast').then(setEpisodes);
  }, [id, selectedSeasonId]);

  if (!id || selectedSeasonId === undefined) return null;

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="4th & Forever"
        description="Two hosts, zero agreement. A new episode drops every generated week, reacting to the nation — including you."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      {episodes.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No episodes yet — generate a week of chatter on the Feed and the hosts hit record.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {episodes.map((ep) => (
          <SurfaceCard key={ep.id}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg dark:bg-white/10">
                🎙️
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Episode · Week {ep.week}
                </p>
                <h3 className="truncate text-lg font-bold text-slate-950 dark:text-white">{ep.title}</h3>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{ep.body}</p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
