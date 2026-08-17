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
 * the clip's real game and tagged players — and, when the live engine runs,
 * still frames from the clip itself, so the bots have actually watched it.
 */

function fileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

const FRAME_WIDTH = 640;

function drawFrame(source: HTMLVideoElement | HTMLImageElement, width: number, height: number): string | null {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, FRAME_WIDTH / Math.max(1, width));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null; // canvas tainted or codec issue — comments still work, just unseen
  }
}

/** Stills for the model: the image itself, or four spread-out frames of a video. */
async function captureFrames(item: MediaItemWithPath): Promise<string[]> {
  const url = fileUrl(item.absolutePath);
  if (item.mediaType === 'image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const frame = drawFrame(img, img.naturalWidth, img.naturalHeight);
        resolve(frame ? [frame] : []);
      };
      img.onerror = () => resolve([]);
      img.src = url;
    });
  }
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    const frames: string[] = [];
    const fail = window.setTimeout(() => resolve(frames), 15000);
    video.onerror = () => {
      window.clearTimeout(fail);
      resolve(frames);
    };
    video.onloadedmetadata = () => {
      const points = [0.15, 0.5, 0.85].map((f) => video.duration * f);
      let at = 0;
      video.onseeked = () => {
        const frame = drawFrame(video, video.videoWidth, video.videoHeight);
        if (frame) frames.push(frame);
        at += 1;
        if (at < points.length) video.currentTime = points[at];
        else {
          window.clearTimeout(fail);
          resolve(frames);
        }
      };
      video.currentTime = points[0];
    };
    video.src = url;
  });
}

export function NetTube() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId, seasons } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [items, setItems] = useState<MediaItemWithPath[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, NetPost[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.media.list(id, selectedSeasonId).then((list) => setItems(list ?? []));
  }, [id, selectedSeasonId]);

  // Tags and games set over in the Media tab should show up the moment you
  // come back — refetch on mount AND whenever the window regains focus.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const loadThread = useCallback(
    async (mediaId: number) => {
      if (!id) return;
      const thread = await window.api.net.getMediaComments(id, mediaId);
      setComments((prev) => ({ ...prev, [mediaId]: thread }));
    },
    [id],
  );

  useEffect(() => {
    if (openId !== null) void loadThread(openId);
  }, [openId, loadThread]);

  if (!id || selectedSeasonId === undefined) return null;

  const generate = async (item: MediaItemWithPath, mode: 'more' | 'fresh') => {
    setBusyId(item.id);
    setNotice(null);
    try {
      // Let the bots watch the thing they're commenting on.
      const frames = await captureFrames(item);
      const result = await window.api.net.generateMediaComments(id, selectedSeasonId, item.id, mode, frames);
      if (result.message) setNotice(result.message);
      else if (result.ok && frames.length > 0 && result.engine === 'claude') {
        setNotice(`The commenters watched ${frames.length > 1 ? `${frames.length} frames of` : ''} the clip before posting.`);
      }
      await loadThread(item.id);
    } catch (err) {
      // A failure with no message is indistinguishable from "nothing
      // happened" — always say what broke.
      setNotice(`Something broke generating comments: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const buttonClass =
    'border border-slate-300/80 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400';

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="DynastyTube"
        description="Your Media uploads, live on the Net. Open one and load the comment section — the regulars watch the clip before they argue about it."
        mark={{ kind: 'logo', teamAssetName: teamName ?? '' }}
      />

      <div className="flex justify-end">
        <button className={buttonClass} onClick={refresh}>
          ⟳ Refresh uploads
        </button>
      </div>

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
          const busy = busyId === item.id;
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
                    {item.plays.length > 0 && ` · ${item.plays.length} play${item.plays.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button className={buttonClass} onClick={() => setOpenId(open ? null : item.id)}>
                  {open ? 'Close' : 'Watch'}
                </button>
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-slate-800">
                  {item.mediaType === 'video' ? (
                    <video src={fileUrl(item.absolutePath)} controls className="max-h-96 w-full bg-black" />
                  ) : (
                    <img src={fileUrl(item.absolutePath)} alt={item.description} className="max-h-96 w-full object-contain" />
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Comments ({thread.length})
                    </p>
                    <div className="ml-auto flex gap-2">
                      <button className={buttonClass} disabled={busyId !== null} onClick={() => void generate(item, 'more')}>
                        {busy ? 'The comment section is typing…' : thread.length ? 'More comments' : 'Load comments'}
                      </button>
                      {thread.length > 0 && (
                        <button
                          className={buttonClass}
                          disabled={busyId !== null}
                          onClick={() => void generate(item, 'fresh')}
                          title="Wipe this comment section and regenerate it with the clip's current game, tags, and frames"
                        >
                          Start over
                        </button>
                      )}
                    </div>
                  </div>
                  {item.plays.length > 0 && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      In this clip:{' '}
                      {item.plays
                        .map(
                          (p) =>
                            `Q${p.quarter} ${Math.floor(p.clockSeconds / 60)}:${String(p.clockSeconds % 60).padStart(2, '0')} ${p.teamName ?? ''} ${p.playType === 'touchdown' ? 'TD' : p.playType === 'fieldGoal' ? 'FG' : 'safety'} (${p.awayScore}-${p.homeScore})`,
                        )
                        .join(' · ')}
                    </p>
                  )}
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
