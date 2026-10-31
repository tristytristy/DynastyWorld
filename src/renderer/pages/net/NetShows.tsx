import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { NetPost, Top10Topic } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';

/**
 * The Shows — Throwback Thursday (a past moment, resurfaced; links the
 * DynastyTube upload when one is tagged to that game) and The Top 10 (pick a
 * topic, the show ranks it from the archive). Both grow with the dynasty:
 * more seasons, deeper cuts.
 */
export function NetShows() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [throwbacks, setThrowbacks] = useState<NetPost[]>([]);
  const [top10s, setTop10s] = useState<NetPost[]>([]);
  const [topics, setTopics] = useState<Top10Topic[]>([]);
  const [topicKey, setTopicKey] = useState('');
  const [busy, setBusy] = useState<'tbt' | 'top10' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getEditions(id, selectedSeasonId, 'throwback').then(setThrowbacks);
    window.api.net.getEditions(id, selectedSeasonId, 'top10').then(setTop10s);
  }, [id, selectedSeasonId]);

  useEffect(() => {
    reload();
    window.api.net.getTop10Topics().then((list) => {
      setTopics(list);
      if (list.length) setTopicKey((k) => k || list[0].key);
    });
  }, [reload]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, Top10Topic[]>();
    for (const t of topics) {
      if (!byGroup.has(t.group)) byGroup.set(t.group, []);
      byGroup.get(t.group)!.push(t);
    }
    return [...byGroup.entries()];
  }, [topics]);

  if (!id || selectedSeasonId === undefined) return null;

  const runThrowback = async () => {
    setBusy('tbt');
    setNotice(null);
    try {
      const result = await window.api.net.generateThrowback(id);
      if (result.message) setNotice(result.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const runTop10 = async () => {
    if (!topicKey) return;
    setBusy('top10');
    setNotice(null);
    try {
      const result = await window.api.net.generateTop10(id, topicKey);
      if (result.message) setNotice(result.message);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const buttonClass =
    'border border-slate-300/80 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-950 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:text-white';

  const episode = (ep: NetPost, show: string) => (
    <SurfaceCard key={ep.id}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{show}</p>
      <h3 className="mt-1.5 font-serif text-xl font-bold leading-tight text-slate-950 dark:text-white">{ep.title}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{ep.body}</p>
      {ep.mediaId !== null && (
        <p className="mt-3 text-sm">
          <Link
            to={`/dynasty/${id}/net/tube`}
            className="font-semibold text-amber-700 hover:underline dark:text-amber-400"
          >
            🎞 Watch the highlight on DynastyTube
          </Link>
        </p>
      )}
    </SurfaceCard>
  );

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="The Shows"
        description="Long-form programming from the archive. Throwback Thursday relives real past moments; The Top 10 counts down whatever you ask it to — and both get deeper every season you sync."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Throwback Thursday</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              A real moment from the vault — title games, upsets, classics. Tagged uploads get linked automatically.
            </p>
          </div>
          <button className={`${buttonClass} ml-auto`} disabled={busy !== null} onClick={runThrowback}>
            {busy === 'tbt' ? 'Rolling the tape…' : 'New throwback'}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">The Top 10</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Pick a countdown. The show ranks it straight from your archive — the longer the dynasty, the deeper the list.
            </p>
            <select
              value={topicKey}
              onChange={(e) => setTopicKey(e.target.value)}
              className="mt-2 w-full border border-slate-300/80 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-black"
            >
              {groups.map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button className={buttonClass} disabled={busy !== null || !topicKey} onClick={runTop10}>
            {busy === 'top10' ? 'Producing the episode…' : 'Produce episode'}
          </button>
        </div>
      </SurfaceCard>

      {notice && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">{notice}</p>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {[...top10s.map((ep) => ({ ep, show: 'The Top 10' })), ...throwbacks.map((ep) => ({ ep, show: 'Throwback Thursday' }))]
          .sort((a, b) => b.ep.id - a.ep.id)
          .map(({ ep, show }) => episode(ep, show))}
      </div>

      {!throwbacks.length && !top10s.length && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No episodes yet. Air a throwback or produce a Top 10 — everything both shows say comes from your dynasty&apos;s
            real history.
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}
