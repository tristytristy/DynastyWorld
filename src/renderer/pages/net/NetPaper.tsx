import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * The Crystal Football — the Net's paper of record. One front-page story per
 * generated week, written from the week's real results. Newest edition first.
 */
export function NetPaper() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [articles, setArticles] = useState<NetPost[]>([]);

  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getEditions(id, selectedSeasonId, 'article').then(setArticles);
  }, [id, selectedSeasonId]);

  if (!id || selectedSeasonId === undefined) return null;

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="The Crystal Football"
        description="The nation's paper of record. Each generated week writes a new front page from your save's biggest story."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      {articles.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No editions yet — generate a week of chatter on the Feed and the front page writes itself.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <SurfaceCard key={article.id}>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              The Crystal Football · Week {article.week}
            </p>
            <h3 className="mt-1.5 font-serif text-2xl font-bold leading-tight text-slate-950 dark:text-white">
              {article.title}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {article.body}
            </p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
