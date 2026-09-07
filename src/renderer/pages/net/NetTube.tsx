import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { MediaItemWithPath } from '../../../shared/types';
import type { NetAccount, NetPost } from '../../../shared/netTypes';
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

/**
 * YouTube-shaped stats, deterministic and storage-free: seeded by the clip's
 * id and grown from its real upload time, so numbers are identical on every
 * machine and every visit — and higher on the next one. Some clips draw a
 * viral seed and blow up; tagging (game, players, plays) boosts reach, which
 * quietly rewards doing the fun part.
 */
function statSeed(seed: number): () => number {
  let t = (seed * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function tubeStats(item: MediaItemWithPath): { views: number; likes: number; age: string } {
  const rand = statSeed(item.id + 7);
  const uploadedAt = new Date(item.createdAt).getTime();
  const hours = Math.max(1, (Date.now() - uploadedAt) / 3_600_000);
  const roll = rand();
  // Heavy tail: most uploads are normal, a few go stupid numbers.
  const base = roll < 0.7 ? 30 + roll * 260 : roll < 0.93 ? 300 + rand() * 1800 : 3000 + rand() * 26000;
  const reach = 1 + item.plays.length * 0.35 + item.playerIds.length * 0.15 + (item.gameId !== null ? 0.5 : 0);
  const views = Math.round(base * reach * Math.pow(hours, 0.62));
  const likes = Math.round(views * (0.035 + rand() * 0.05));
  return { views, likes, age: ageLabel(uploadedAt) };
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function ageLabel(uploadedAt: number): string {
  const days = Math.floor((Date.now() - uploadedAt) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`;
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
    const fail = window.setTimeout(() => resolve(frames), 45000);
    video.onerror = () => {
      window.clearTimeout(fail);
      resolve(frames);
    };
    video.onloadedmetadata = () => {
      // Filmstrip: one frame roughly every 2 seconds - 6 at minimum, 16 at
      // most (the API call carries up to 16 images) - evenly spaced across
      // 5%..95% so the bots see the play develop, not three glimpses of it.
      const frameCount = Math.max(6, Math.min(16, Math.round(video.duration / 2)));
      const points = Array.from({ length: frameCount }, (_, i) =>
        video.duration * (0.05 + (0.9 * i) / Math.max(1, frameCount - 1)),
      );
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
  const { selectedSeasonId, seasons, setSelectedSeasonId } = useSelectedSeason();
  const teamName = seasons.find((s) => s.id === selectedSeasonId)?.teamName ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MediaItemWithPath[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, NetPost[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [channel, setChannel] = useState<NetAccount | null>(null);

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

  useEffect(() => {
    if (!id || selectedSeasonId === undefined) return;
    window.api.net.getFeed(id, selectedSeasonId).then((view) => setChannel(view.userAccount));
  }, [id, selectedSeasonId]);

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

  /*
    ?media=ID deep link (from The Historian's footage citations). If the clip
    is in the selected season, open it and scroll to it; if it belongs to
    another season, find its owner and switch the season — the effect then
    fires again with the right list. The param is cleared once handled so
    normal browsing isn't stuck on an old citation.
  */
  useEffect(() => {
    const raw = searchParams.get('media');
    if (!raw || !id || items.length === 0) return;
    const target = Number(raw);
    if (items.some((m) => m.id === target)) {
      setOpenId(target);
      setSearchParams({}, { replace: true });
      window.setTimeout(() => {
        document.getElementById(`tube-item-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const season of seasons) {
        if (season.id === selectedSeasonId) continue;
        const list = (await window.api.media.list(id, season.id).catch(() => null)) ?? [];
        if (cancelled) return;
        if (list.some((m) => m.id === target)) {
          setSelectedSeasonId(season.id);
          return;
        }
      }
      // Nobody owns it (deleted clip) — drop the param quietly.
      if (!cancelled) setSearchParams({}, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams, items, id, seasons, selectedSeasonId, setSelectedSeasonId]);

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

  const openItem = items.find((m) => m.id === openId) ?? null;
  // The channel's subscriber count rides the library's total reach — one more
  // number that visibly grows as the dynasty (and real time) rolls on.
  const totalViews = items.reduce((sum, m) => sum + tubeStats(m).views, 0);
  const subscribers = 1200 + Math.round(totalViews * 0.006);

  const watchPage = (item: MediaItemWithPath) => {
    const thread = comments[item.id] ?? [];
    const busy = busyId === item.id;
    const stats = tubeStats(item);
    return (
      <SurfaceCard id={`tube-item-${item.id}`}>
        <button
          className="mb-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          onClick={() => setOpenId(null)}
        >
          ← Back to uploads
        </button>
        {item.mediaType === 'video' ? (
          <video src={fileUrl(item.absolutePath)} controls autoPlay className="max-h-[480px] w-full rounded-xl bg-black" />
        ) : (
          <img src={fileUrl(item.absolutePath)} alt={item.description} className="max-h-[480px] w-full rounded-xl bg-black object-contain" />
        )}
        <h3 className="mt-3 text-lg font-bold leading-snug text-slate-950 dark:text-white">
          {item.tubeTitle || item.description || 'Untitled highlight'}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* channel row */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white dark:bg-slate-600">
              {(channel?.displayName ?? 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {channel?.displayName ?? 'Your channel'}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{formatCount(subscribers)} subscribers</p>
            </div>
            <span className="ml-2 rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
              Subscribed
            </span>
          </div>
          {/* like pill */}
          <div className="ml-auto flex items-center overflow-hidden rounded-full bg-slate-100 text-sm dark:bg-slate-800">
            <span className="flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-slate-800 dark:text-slate-200">
              👍 {formatCount(stats.likes)}
            </span>
            <span className="border-l border-slate-300/70 px-3.5 py-1.5 text-slate-500 dark:border-slate-600 dark:text-slate-400">👎</span>
          </div>
        </div>
        {/* description box */}
        <div className="mt-3 rounded-xl bg-slate-100/80 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {formatCount(stats.views)} views · {stats.age}
          </p>
          {item.tubeTitle && item.description && (
            <p className="mt-1 whitespace-pre-wrap">{item.description}</p>
          )}
          <p className="mt-1">
            {item.gameId !== null ? 'Tagged to a game' : 'No game tagged'}
            {item.playerIds.length > 0 && ` · ${item.playerIds.length} player${item.playerIds.length === 1 ? '' : 's'} tagged`}
            {item.plays.length > 0 && ` · ${item.plays.length} play${item.plays.length === 1 ? '' : 's'}`}
          </p>
          {item.plays.length > 0 && (
            <p className="mt-1">
              In this clip:{' '}
              {item.plays
                .map(
                  (p) =>
                    `Q${p.quarter} ${Math.floor(p.clockSeconds / 60)}:${String(p.clockSeconds % 60).padStart(2, '0')} ${p.teamName ?? ''} ${p.playType === 'touchdown' ? 'TD' : p.playType === 'fieldGoal' ? 'FG' : 'safety'}${p.scorerNames?.length ? ` — ${p.scorerNames.join(' → ')}` : ''} (${p.awayScore}-${p.homeScore})`,
                )
                .join(' · ')}
            </p>
          )}
        </div>
        {/* comments */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {thread.length > 0 ? `${thread.length} Comments` : 'Comments'}
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
        {notice && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{notice}</p>}
        <div className="mt-3 space-y-2">
          {thread.map((c) => (
            <PostCard key={c.id} post={c} compact />
          ))}
        </div>
      </SurfaceCard>
    );
  };

  return (
    <div className="space-y-5">
      <PageMasthead
        eyebrow="The Net"
        title="DynastyTube"
        description="Your channel, live on the Net. Every tagged upload is a video with views, likes, and a comment section — the regulars watch the clip before they argue about it."
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

      {openItem && watchPage(openItem)}

      {/* the home grid — thumbnails, titles, channel line, views · age */}
      <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {items
          .filter((item) => item.id !== openId)
          .map((item) => {
            const stats = tubeStats(item);
            return (
              <button
                key={item.id}
                className="group text-left"
                onClick={() => {
                  setOpenId(item.id);
                  window.setTimeout(() => {
                    document.getElementById(`tube-item-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 80);
                }}
              >
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                  {item.mediaType === 'video' ? (
                    // #t=0.5 nudges Chromium to paint a real frame as the poster.
                    <video
                      src={`${fileUrl(item.absolutePath)}#t=${item.thumbTime ?? 0.5}`}
                      preload="metadata"
                      muted
                      className="pointer-events-none h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <img
                      src={fileUrl(item.absolutePath)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="mt-2 flex gap-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white dark:bg-slate-600">
                    {(channel?.displayName ?? 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-950 dark:text-white">
                      {item.tubeTitle || item.description || 'Untitled highlight'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {channel?.displayName ?? 'Your channel'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCount(stats.views)} views · {stats.age}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
