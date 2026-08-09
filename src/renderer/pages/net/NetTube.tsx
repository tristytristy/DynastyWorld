import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { MediaItemWithPath } from '../../../shared/types';
import type { NetPost } from '../../../shared/netTypes';
import { PageMasthead } from '../../components/common/PageMasthead';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { PostCard } from './NetPost';

/**
 * DynastyTube — the Media gallery reframed as a video site. Every tagged
 * screenshot/clip is an "upload"; open one and load its comment section,
 * where the cast argues about GOATs, clutch moments and worst calls using
 * the clip's real game and tagged players.
 */
export function NetTube() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [items, setItems] = useState<MediaItemWithPath[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, NetPost[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.media.list(id, selectedSeasonId).then((list) => setItems(list ?? []));
  }, [id, selectedSeasonId]);

  const loadComments = useCallback(
    async (mediaId: number, generate: boolean) => {
      if (!id || selectedSeasonId === undefined) return;
      if (generate) {
        setBusyId(mediaId);
        setNotice(null);
        try {
          const result = await window.api.net.generateMediaComments(id, selectedSeasonId, mediaId);
          if (result.message) setNotice(result.message);
        } finally {
          setBusyId(null);
        }
      }
      const thread = await window.api.net.getMediaComments(id, mediaId);
      setComments((prev) => ({ ...prev, [mediaId]: thread }));
    },
    [id, selectedSeasonId],
  );

  useEffect(() => {
    if (openId !== null) void loadComments(openId, false);
  }, [openId, loadComments]);

  if (!id || selectedSeasonId === undefined) return null;

  const buttonClass =
    'border border-slate-300/80 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400';

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="DynastyTube"
        description="Your Media uploads, live on the Net. Open one and load the comment section — the regulars have takes about every clip."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      {items.length === 0 && (
        <SurfaceCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No uploads yet. Add screenshots or clips in the Media tab (tag the game and the players!) and they show up
            here as videos with comment sections.
          </p>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const open = openId === item.id;
          const thread = comments[item.id] ?? [];
          return (
            <SurfaceCard key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {item.description || 'Untitled highlight'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {item.mediaType === 'video' ? 'Clip' : 'Screenshot'}
                    {item.gameId !== null ? ' · tagged to a game' : ' · no game tagged'}
                    {item.playerIds.length > 0 && ` · ${item.playerIds.length} player${item.playerIds.length === 1 ? '' : 's'} tagged`}
                  </p>
                </div>
                <button className={buttonClass} onClick={() => setOpenId(open ? null : item.id)}>
                  {open ? 'Close' : 'Watch'}
                </button>
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Comments ({thread.length})
                    </p>
                    <button
                      className={`${buttonClass} ml-auto`}
                      disabled={busyId !== null}
                      onClick={() => void loadComments(item.id, true)}
                    >
                      {busyId === item.id ? 'The comment section is typing…' : thread.length ? 'More comments' : 'Load comments'}
                    </button>
                  </div>
                  {notice && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{notice}</p>}
                  <div className="mt-3 space-y-2">
                    {thread.map((c) => (
                      <PostCard key={c.id} post={c} compact />
                    ))}
                  </div>
                </div>
              )}
            </SurfaceCard>
          );
        })}
      </div>
    </div>
  );
}
