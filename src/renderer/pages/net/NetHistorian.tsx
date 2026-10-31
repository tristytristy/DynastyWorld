import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { NetPost } from '../../../shared/netTypes';
import type { MediaItemWithPath } from '../../../shared/types';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * The Historian — ask anything about this dynasty's history and get a
 * long-form article researched from the whole archive. Articles cite
 * DynastyTube footage inline via [tube:ID] markers; this page renders each
 * marker as a "watch on DynastyTube" link that jumps to the clip, so a
 * retrospective can point at highlights that actually exist.
 */

const EXAMPLE_QUESTIONS = [
  'Which teams made multiple playoff runs but never won the title?',
  'Give me an ESPN-style year-by-year breakdown of the MAC.',
  'Rank every national champion by how dominant their season was.',
  'Which conference produced the most CFP appearances, and who carried it?',
];

/** Body text with [tube:123] markers turned into Tube links. */
function ArticleBody({ body, base, mediaById }: { body: string; base: string; mediaById: Map<number, string> }) {
  const parts = body.split(/\[tube:(\d+)\]/g);
  return (
    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const mediaId = Number(part);
        const label = mediaById.get(mediaId);
        return (
          <Link
            key={i}
            to={`${base}/net/tube?media=${mediaId}`}
            className="mx-1 inline-flex items-baseline gap-1 whitespace-nowrap text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
            title="Watch this highlight on DynastyTube"
          >
            ▶ {label ?? 'watch on DynastyTube'}
          </Link>
        );
      })}
    </p>
  );
}

export function NetHistorian() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [articles, setArticles] = useState<NetPost[]>([]);
  const [mediaById, setMediaById] = useState<Map<number, string>>(new Map());
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    window.api.net.getHistorianArticles(id).then(setArticles);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Clip descriptions for link labels — best-effort across the dynasty's
  // seasons; an unknown id still renders as a generic Tube link.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all(seasons.map((s) => window.api.media.list(id, s.id).catch(() => [] as MediaItemWithPath[]))).then(
      (lists) => {
        if (cancelled) return;
        const map = new Map<number, string>();
        for (const items of lists) {
          for (const m of items ?? []) map.set(m.id, m.description || m.fileName);
        }
        setMediaById(map);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, seasons]);

  if (!id) return null;
  const base = `/dynasty/${id}`;

  const ask = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await window.api.net.askHistorian(id, question.trim());
      if (result.message) setNotice(result.message);
      if (result.ok) setQuestion('');
      reload();
    } catch (err) {
      setNotice(`Something broke: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="The Historian"
        description="The archive's senior columnist. Ask anything about this dynasty's history — dominant runs, heartbreaks, conference eras, all-time rankings — and get a researched long-form answer, with links to DynastyTube footage where the film exists."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      <SurfaceCard>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder={`Ask the Historian… e.g. "${EXAMPLE_QUESTIONS[articles.length % EXAMPLE_QUESTIONS.length]}"`}
          className="w-full resize-y border border-slate-300/80 bg-transparent px-3 py-2 text-sm dark:border-slate-600"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Deep questions get deep answers — a full research pass can take a minute.
          </p>
          <button
            onClick={() => void ask()}
            disabled={busy || !question.trim()}
            className="border border-slate-300/80 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-950 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white"
          >
            {busy ? 'The Historian is researching…' : 'Ask'}
          </button>
        </div>
        {notice && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{notice}</p>}
      </SurfaceCard>

      {articles.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The Historian&rsquo;s desk is clear. Ask the first question — every answer is kept here as an article.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <SurfaceCard key={article.id}>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              The Historian · {new Date(article.createdAt).toLocaleDateString()}
            </p>
            <h3 className="mt-1.5 font-serif text-2xl font-bold leading-tight text-slate-950 dark:text-white">
              {article.title}
            </h3>
            <ArticleBody body={article.body} base={base} mediaById={mediaById} />
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
