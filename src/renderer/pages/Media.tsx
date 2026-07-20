import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MediaItemPatch, MediaItemWithPath, RosterPlayer, ScheduleGame, ScheduleOverview } from '../../shared/types';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Button } from '../components/ui/Button';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';

/** Absolute on-disk path → a URL the (file://-origin) renderer can load. */
function fileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

function gameLabel(game: ScheduleGame): string {
  const score =
    game.teamScore !== null && game.opponentScore !== null
      ? ` ${game.result ?? ''} ${game.teamScore}-${game.opponentScore}`
      : '';
  return `Wk ${game.week} ${game.isHome ? 'vs' : '@'} ${game.opponent}${score}`;
}

function playerLabel(player: RosterPlayer): string {
  return `${player.firstName} ${player.lastName}`;
}

/**
 * Metadata editor shown inside the lightbox sidebar — pick the game, tag
 * players from that season's roster, write a description.
 */
function MediaDetailsForm({
  item,
  games,
  roster,
  onSave,
  onCancel,
}: {
  item: MediaItemWithPath;
  games: ScheduleGame[];
  roster: RosterPlayer[];
  onSave: (patch: MediaItemPatch) => void;
  onCancel: () => void;
}) {
  const [gameId, setGameId] = useState<number | null>(item.gameId);
  const [description, setDescription] = useState(item.description);
  const [playerIds, setPlayerIds] = useState<number[]>(item.playerIds);
  const [playerQuery, setPlayerQuery] = useState('');

  const filteredRoster = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    const matches = q
      ? roster.filter((p) => playerLabel(p).toLowerCase().includes(q) || p.position.toLowerCase() === q)
      : roster;
    // Tagged players float to the top so the current selection is always visible.
    return [...matches].sort((a, b) => {
      const at = playerIds.includes(a.id) ? 0 : 1;
      const bt = playerIds.includes(b.id) ? 0 : 1;
      return at - bt || b.overallRating - a.overallRating;
    });
  }, [roster, playerQuery, playerIds]);

  const inputClass =
    'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className="space-y-4">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game</p>
        <select
          value={gameId ?? ''}
          onChange={(e) => setGameId(e.target.value === '' ? null : Number(e.target.value))}
          aria-label="Game this media is from"
          className={`${inputClass} mt-1.5`}
        >
          <option value="">Not from a specific game</option>
          {games.map((game) => (
            <option key={game.gameId} value={game.gameId}>
              {gameLabel(game)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Description</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What's happening in this shot?"
          aria-label="Media description"
          className={`${inputClass} mt-1.5 resize-none`}
        />
      </div>

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Players in this media {playerIds.length > 0 ? `(${playerIds.length})` : ''}
        </p>
        <input
          type="text"
          value={playerQuery}
          onChange={(e) => setPlayerQuery(e.target.value)}
          placeholder="Search roster..."
          aria-label="Search players to tag"
          className={`${inputClass} mt-1.5`}
        />
        <div className="mt-1.5 max-h-48 overflow-y-auto border border-slate-200/80 dark:border-slate-800">
          {filteredRoster.map((player) => {
            const tagged = playerIds.includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() =>
                  setPlayerIds((prev) => (tagged ? prev.filter((pid) => pid !== player.id) : [...prev, player.id]))
                }
                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition ${
                  tagged
                    ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{playerLabel(player)}</span>
                <span className={`shrink-0 text-xs ${tagged ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {player.position} {player.overallRating}
                </span>
              </button>
            );
          })}
          {filteredRoster.length === 0 && (
            <p className="px-2.5 py-3 text-xs text-slate-400 dark:text-slate-500">No matching players.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => onSave({ gameId, description: description.trim(), playerIds })}>Save details</Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Fullscreen lightbox — the media large, metadata + links beside it, prev/next navigation. */
function MediaLightbox({
  dynastyId,
  seasonId,
  items,
  index,
  games,
  roster,
  onNavigate,
  onClose,
  onSaved,
  onDeleted,
}: {
  dynastyId: string;
  seasonId: number | undefined;
  items: MediaItemWithPath[];
  index: number;
  games: ScheduleGame[];
  roster: RosterPlayer[];
  onNavigate: (index: number) => void;
  onClose: () => void;
  onSaved: (item: MediaItemWithPath, patch: MediaItemPatch) => void;
  onDeleted: (item: MediaItemWithPath) => void;
}) {
  const { openPlayerModal } = usePlayerModal();
  const [editing, setEditing] = useState(false);
  const item = items[index];

  const canGoPrevious = index > 0;
  const canGoNext = index < items.length - 1;

  // Reset edit mode when moving between items so a half-finished form never
  // silently carries over to a different photo.
  useEffect(() => {
    setEditing(false);
  }, [item?.id]);

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        onNavigate(index - 1);
      } else if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        onNavigate(index + 1);
      }
    }
    document.addEventListener('keydown', handleKeys);
    return () => document.removeEventListener('keydown', handleKeys);
  }, [index, canGoPrevious, canGoNext, onNavigate, onClose]);

  if (!item) return null;

  const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
  const taggedPlayers = item.playerIds
    .map((pid) => roster.find((p) => p.id === pid))
    .filter((p): p is RosterPlayer => !!p);

  const navButtonClass =
    'border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        className="corner-cut flex max-h-full w-full max-w-6xl flex-col overflow-hidden border border-white/70 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 lg:flex-row"
      >
        <div className="relative flex min-h-[16rem] flex-1 items-center justify-center bg-slate-950 lg:min-h-[32rem]">
          {item.mediaType === 'video' ? (
            <video
              key={item.id}
              src={fileUrl(item.absolutePath)}
              controls
              autoPlay={false}
              className="max-h-[70vh] max-w-full"
            />
          ) : (
            <img
              key={item.id}
              src={fileUrl(item.absolutePath)}
              alt={item.description || 'Dynasty media'}
              className="max-h-[70vh] max-w-full object-contain"
              draggable={false}
            />
          )}
          <button
            type="button"
            onClick={() => canGoPrevious && onNavigate(index - 1)}
            disabled={!canGoPrevious}
            aria-label="Previous media"
            title="Previous (←)"
            className={`${navButtonClass} absolute left-3 top-1/2 -translate-y-1/2`}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => canGoNext && onNavigate(index + 1)}
            disabled={!canGoNext}
            aria-label="Next media"
            title="Next (→)"
            className={`${navButtonClass} absolute right-3 top-1/2 -translate-y-1/2`}
          >
            →
          </button>
          <span className="tnum absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200">
            {index + 1} / {items.length}
          </span>
        </div>

        <div className="flex w-full shrink-0 flex-col border-t border-slate-200/80 dark:border-white/10 lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              {item.mediaType === 'video' ? 'Video' : 'Photo'} details
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close media viewer"
              className="border border-slate-300/80 bg-white/85 px-2.5 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {editing ? (
              <MediaDetailsForm
                item={item}
                games={games}
                roster={roster}
                onSave={(patch) => {
                  onSaved(item, patch);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">Description</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {item.description || <span className="text-slate-400 dark:text-slate-500">No description yet.</span>}
                  </p>
                </div>

                <div>
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game</p>
                  {game ? (
                    <Link
                      to={`/dynasty/${dynastyId}/schedule/${game.gameId}`}
                      onClick={onClose}
                      className="mt-1.5 inline-block border border-slate-200/80 bg-slate-50/85 px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
                    >
                      {gameLabel(game)} →
                    </Link>
                  ) : (
                    <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">Not linked to a game.</p>
                  )}
                </div>

                <div>
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">Players</p>
                  {taggedPlayers.length > 0 ? (
                    <div className="mt-1.5 space-y-1">
                      {taggedPlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => openPlayerModal(dynastyId, player.id, seasonId)}
                          className="flex w-full items-center gap-2.5 border border-slate-200/80 bg-slate-50/85 px-2.5 py-1.5 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
                        >
                          <PlayerPortrait player={player} size="sm" className="!h-7 !w-7" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {playerLabel(player)}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                            {player.position} {player.overallRating}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500">No players tagged.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-slate-200/60 pt-4 dark:border-slate-800/60">
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    Edit details
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this media? The file is removed from the library and cannot be undone.')) {
                        onDeleted(item);
                      }
                    }}
                    className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Media() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [items, setItems] = useState<MediaItemWithPath[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const seasonYear = seasons.find((s) => s.id === seasonId)?.seasonYear;

  const refresh = useCallback(() => {
    if (!id) return;
    window.api.media.list(id, seasonId).then((result) => setItems(result ?? null));
  }, [id, seasonId]);

  useEffect(() => {
    if (!id) return;
    setItems(undefined);
    setLightboxIndex(null);
    refresh();
    window.api.db.getSchedule(id, seasonId).then((result) => setSchedule(result ?? null));
    window.api.db.getRoster(id, seasonId).then((result) => setRoster(result ?? []));
  }, [id, seasonId, refresh]);

  async function handleUpload() {
    if (!id || seasonId === undefined || uploading) return;
    const picked = await window.api.media.pickFiles();
    if (!picked || picked.length === 0) return;
    setUploading(true);
    try {
      await window.api.media.addFiles(id, seasonId, picked);
      refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleSaved(item: MediaItemWithPath, patch: MediaItemPatch) {
    window.api.media.update(item.id, patch).then(refresh);
    // Optimistic local update so the lightbox reflects the save instantly.
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, ...patch } : m)) ?? prev);
  }

  function handleDeleted(item: MediaItemWithPath) {
    window.api.media.remove(item.id).then(refresh);
    setLightboxIndex(null);
  }

  if (!id) return null;

  const games = schedule?.games ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media"
        title="The season, in pictures."
        description={`Game-day screenshots and clips for ${seasonYear !== undefined ? `the ${seasonYear} season` : 'this season'} — tag the game and the players, and everything links back to their pages. Uploads are saved into this dynasty's own library.`}
        actions={
          <Button onClick={handleUpload} disabled={uploading || seasonId === undefined}>
            {uploading ? 'Adding...' : 'Add photos / videos'}
          </Button>
        }
      />

      {items === undefined && (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">Loading media...</SurfaceCard>
      )}

      {items !== undefined && (items === null || items.length === 0) && (
        <SurfaceCard className="py-14 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No media for this season yet. Add screenshots or clips and build the season&apos;s story.
          </p>
          <div className="mt-4">
            <Button onClick={handleUpload} disabled={uploading || seasonId === undefined}>
              {uploading ? 'Adding...' : 'Add photos / videos'}
            </Button>
          </div>
        </SurfaceCard>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => {
            const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
            const caption = game ? gameLabel(game) : item.description || 'Add details';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Open media: ${caption}`}
                className="group relative aspect-video overflow-hidden border border-slate-200/80 bg-slate-950 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800"
              >
                {item.mediaType === 'video' ? (
                  <>
                    <video src={fileUrl(item.absolutePath)} preload="metadata" muted className="h-full w-full object-cover" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/60 bg-slate-950/60 px-3 py-1.5 text-sm font-semibold text-white">
                      ▶ Video
                    </span>
                  </>
                ) : (
                  <img
                    src={fileUrl(item.absolutePath)}
                    alt={caption}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-base ease-standard group-hover:scale-[1.03]"
                    draggable={false}
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-6">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100">{caption}</span>
                  {item.playerIds.length > 0 && (
                    <span className="tnum shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {item.playerIds.length} tagged
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && items && items[lightboxIndex] && (
        <MediaLightbox
          dynastyId={id}
          seasonId={seasonId}
          items={items}
          index={lightboxIndex}
          games={games}
          roster={roster}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
