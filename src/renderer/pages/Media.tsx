import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useGameModal } from '../data/GameModalProvider';
import type { MediaFraming, MediaItemPatch, MediaItemWithPath, RosterPlayer, ScheduleGame, ScheduleOverview } from '../../shared/types';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useConfirm } from '../data/ConfirmDialogProvider';
import { TrashIcon } from '../components/common/ActionIcons';
import { ModalCloseButton } from '../components/common/ModalCloseButton';
import { ZoomableImage, framingTransform } from '../components/common/ZoomableImage';

const DELETE_MEDIA_CONFIRM = {
  eyebrow: 'Delete media',
  title: 'Delete this media?',
  message: 'The file is removed from this dynasty’s library and cannot be undone.',
  confirmLabel: 'Delete',
  tone: 'danger' as const,
};

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
    const raw = playerQuery.trim();
    let matches: RosterPlayer[];
    if (raw.startsWith('#')) {
      // Jersey-number search — for when you recognize the number in the shot
      // but not the name. Exact match on the digits after "#", so a shared
      // number (two players can wear the same one in CFB) surfaces everyone.
      const numQuery = raw.slice(1).trim();
      matches = numQuery === '' ? roster : roster.filter((p) => String(p.jerseyNumber) === numQuery);
    } else if (raw) {
      const q = raw.toLowerCase();
      matches = roster.filter((p) => playerLabel(p).toLowerCase().includes(q) || p.position.toLowerCase() === q);
    } else {
      matches = roster;
    }
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
        <Select
          value={gameId === null ? '' : String(gameId)}
          onChange={(next) => setGameId(next === '' ? null : Number(next))}
          ariaLabel="Game this media is from"
          className="mt-1.5 w-full"
          options={[
            { value: '', label: 'Not from a specific game' },
            ...games.map((game) => ({ value: String(game.gameId), label: gameLabel(game) })),
          ]}
        />
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
          placeholder="Search roster, or #number..."
          aria-label="Search players to tag — start with # to search by jersey number"
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
                <span className="min-w-0 flex-1 truncate">
                  <span className={`tnum mr-1.5 ${tagged ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                    #{player.jerseyNumber}
                  </span>
                  {playerLabel(player)}
                </span>
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
  onFramed,
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
  onFramed: (item: MediaItemWithPath, framing: MediaFraming | null) => void;
  onDeleted: (item: MediaItemWithPath) => void;
}) {
  const { openPlayerModal } = usePlayerModal();
  const { openGameModal } = useGameModal();
  const confirm = useConfirm();
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

  // Portal to <body>: the Media page lives inside the app shell's backdrop-blur
  // <main>, which creates a containing block that would trap a `fixed` overlay
  // and load it off-center (top/bottom) instead of centered in the viewport.
  return createPortal(
    <div
      className="modal-scrim modal-scrim-deep fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        className="corner-cut flex max-h-full w-full max-w-6xl flex-col overflow-hidden modal-panel lg:flex-row"
      >
        {/* overflow-hidden because a zoomed photo has to be clipped by
            something, and the stage is what it lives in. */}
        <div className="relative flex min-h-[16rem] flex-1 items-center justify-center overflow-hidden bg-slate-950 lg:min-h-[32rem]">
          {item.mediaType === 'video' ? (
            <video
              key={item.id}
              src={fileUrl(item.absolutePath)}
              controls
              autoPlay={false}
              className="max-h-[70vh] max-w-full"
            />
          ) : (
            <ZoomableImage
              key={item.id}
              src={fileUrl(item.absolutePath)}
              alt={item.description || 'Dynasty media'}
              saved={item.framing}
              onSave={(framing) => onFramed(item, framing)}
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
            <ModalCloseButton label="media viewer" onClick={onClose} />
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
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openGameModal(dynastyId, game.gameId, seasonId);
                      }}
                      className="mt-1.5 inline-block border border-slate-200/80 bg-slate-50/85 px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
                    >
                      {gameLabel(game)} →
                    </button>
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
                    onClick={async () => {
                      if (await confirm(DELETE_MEDIA_CONFIRM)) onDeleted(item);
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
    </div>,
    document.body,
  );
}

export function Media() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [items, setItems] = useState<MediaItemWithPath[] | null | undefined>(undefined);
  const [schedule, setSchedule] = useState<ScheduleOverview | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchGameId, setBatchGameId] = useState('');
  const dragIndexRef = useRef<number | null>(null);

  const seasonYear = seasons.find((s) => s.id === seasonId)?.seasonYear;
  const importing = importProgress !== null;

  const refresh = useCallback(() => {
    if (!id) return;
    window.api.media.list(id, seasonId).then((result) => setItems(result ?? null));
  }, [id, seasonId]);

  useEffect(() => {
    if (!id) return;
    setItems(undefined);
    setLightboxIndex(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    refresh();
    window.api.db.getSchedule(id, seasonId).then((result) => setSchedule(result ?? null));
    window.api.db.getRoster(id, seasonId).then((result) => setRoster(result ?? []));
  }, [id, seasonId, refresh]);

  // File-by-file import so a real progress bar is possible (file copies are fast;
  // the extra IPC round-trips for a batch of screenshots are negligible). Shared
  // by the picker button and the drag-and-drop drop zone.
  const importFiles = useCallback(
    async (paths: string[]) => {
      if (!id || seasonId === undefined || importing || paths.length === 0) return;
      setImportProgress({ done: 0, total: paths.length });
      try {
        for (let i = 0; i < paths.length; i++) {
          await window.api.media.addFiles(id, seasonId, [paths[i]]);
          setImportProgress({ done: i + 1, total: paths.length });
        }
        refresh();
      } finally {
        setImportProgress(null);
      }
    },
    [id, seasonId, importing, refresh],
  );

  async function handleUpload() {
    const picked = await window.api.media.pickFiles();
    if (picked) importFiles(picked);
  }

  // --- Drag-and-drop upload (drop OS files anywhere on the grid) ---
  function onGridDragOver(event: ReactDragEvent) {
    if (!importing && event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      setDragOverUpload(true);
    }
  }
  function onGridDrop(event: ReactDragEvent) {
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return; // an internal reorder drop — handled on the tile
    event.preventDefault();
    setDragOverUpload(false);
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    if (paths.length) importFiles(paths);
  }

  // --- Drag-to-reorder (normal mode) ---
  async function onTileDrop(event: ReactDragEvent, index: number) {
    if (Array.from(event.dataTransfer.files ?? []).length > 0) return; // file drop → let the grid upload
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index || !items || !id || seasonId === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setItems(next);
    await window.api.media.reorder(id, seasonId, next.map((m) => m.id));
  }

  // --- Batch selection ---
  function toggleSelect(mediaId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchGameId('');
  }

  async function batchSetGame() {
    if (!items || selectedIds.size === 0) return;
    const gid = batchGameId === '' ? null : Number(batchGameId);
    for (const m of items.filter((it) => selectedIds.has(it.id))) {
      await window.api.media.update(m.id, { gameId: gid, description: m.description, playerIds: m.playerIds });
    }
    refresh();
    exitSelectMode();
  }
  async function batchDelete() {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      ...DELETE_MEDIA_CONFIRM,
      title: `Delete ${selectedIds.size} item${selectedIds.size === 1 ? '' : 's'}?`,
      message: 'These files are removed from this dynasty’s library and cannot be undone.',
    });
    if (!ok) return;
    for (const mediaId of selectedIds) await window.api.media.remove(mediaId);
    refresh();
    exitSelectMode();
  }

  function handleSaved(item: MediaItemWithPath, patch: MediaItemPatch) {
    window.api.media.update(item.id, patch).then(refresh);
    // Optimistic local update so the lightbox reflects the save instantly.
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, ...patch } : m)) ?? prev);
  }

  /**
   * Framing is saved on its own, not through `handleSaved`: it comes from
   * dragging the photo rather than from submitting the details form, and it
   * changes nothing else about the item. Local state updates optimistically so
   * the tile behind the viewer re-crops the moment you save.
   */
  function handleFramed(item: MediaItemWithPath, framing: MediaFraming | null) {
    void window.api.media.setFraming(item.id, framing);
    setItems((prev) => prev?.map((m) => (m.id === item.id ? { ...m, framing } : m)) ?? prev);
  }

  function handleDeleted(item: MediaItemWithPath) {
    window.api.media.remove(item.id).then(refresh);
    setLightboxIndex(null);
  }

  if (!id) return null;

  const games = schedule?.games ?? [];
  const hasItems = !!items && items.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media"
        title="The season, in pictures."
        description={`Game-day screenshots and clips for ${seasonYear !== undefined ? `the ${seasonYear} season` : 'this season'} — tag the game and the players, and everything links back to their pages. Drag to reorder, drop files in to add, and use Select for batch edits.`}
        actions={
          <div className="flex items-center gap-2">
            {hasItems && (
              <Button variant="secondary" onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}>
                {selectMode ? 'Cancel' : 'Select'}
              </Button>
            )}
            <Button onClick={handleUpload} disabled={importing || seasonId === undefined}>
              {importing ? 'Importing…' : 'Add photos / videos'}
            </Button>
          </div>
        }
      />

      {/* Import progress bar */}
      {importProgress && (
        <SurfaceCard className="py-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Importing photos…</span>
            <span className="tnum">
              {importProgress.done} / {importProgress.total}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-full bg-[var(--team-primary)] transition-all duration-base"
              style={{ width: `${importProgress.total ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%` }}
            />
          </div>
        </SurfaceCard>
      )}

      {/* Batch toolbar (Select mode) */}
      {selectMode && (
        <SurfaceCard className="flex flex-wrap items-center gap-3 py-3">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set((items ?? []).map((m) => m.id)))}
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Select all
          </button>
          <div className="h-5 w-px bg-slate-300/70 dark:bg-slate-700/70" aria-hidden="true" />
          {/* A span, not a <label>: a label wrapping a BUTTON doesn't forward
              clicks the way it does for a native control, so the text would look
              clickable and do nothing. */}
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Set game
            <Select
              value={batchGameId}
              onChange={setBatchGameId}
              disabled={selectedIds.size === 0}
              ariaLabel="Game to assign to the selected media"
              options={[
                { value: '', label: 'Not from a specific game' },
                ...games.map((game) => ({ value: String(game.gameId), label: gameLabel(game) })),
              ]}
            />
          </span>
          <Button onClick={batchSetGame} disabled={selectedIds.size === 0}>
            Apply to {selectedIds.size}
          </Button>
          <button
            type="button"
            onClick={batchDelete}
            disabled={selectedIds.size === 0}
            className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-red-400 dark:hover:bg-red-950/60"
          >
            Delete selected
          </button>
          <div className="ml-auto">
            <Button variant="secondary" onClick={exitSelectMode}>
              Done
            </Button>
          </div>
        </SurfaceCard>
      )}

      {items === undefined && (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">Loading media...</SurfaceCard>
      )}

      {items !== undefined && (items === null || items.length === 0) && (
        <div onDragOver={onGridDragOver} onDragLeave={() => setDragOverUpload(false)} onDrop={onGridDrop}>
          <SurfaceCard
            className={`py-14 text-center transition ${dragOverUpload ? 'outline outline-2 outline-offset-2 outline-[var(--team-primary)]' : ''}`}
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No media for this season yet. Add screenshots or clips — or drag &amp; drop them here — to build the season&apos;s
              story.
            </p>
            <div className="mt-4">
              <Button onClick={handleUpload} disabled={importing || seasonId === undefined}>
                {importing ? 'Importing…' : 'Add photos / videos'}
              </Button>
            </div>
          </SurfaceCard>
        </div>
      )}

      {items && items.length > 0 && (
        <div
          onDragOver={onGridDragOver}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragOverUpload(false);
          }}
          onDrop={onGridDrop}
          className={`grid grid-cols-2 gap-3 rounded p-1 transition md:grid-cols-3 xl:grid-cols-4 ${
            dragOverUpload ? 'outline-dashed outline-2 outline-offset-2 outline-[var(--team-primary)]' : ''
          }`}
        >
          {items.map((item, index) => {
            const game = item.gameId !== null ? games.find((g) => g.gameId === item.gameId) : undefined;
            const caption = game ? gameLabel(game) : item.description || 'Add details';
            const selected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                draggable={!selectMode}
                onDragStart={(e) => {
                  dragIndexRef.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                }}
                onDragOver={(e) => {
                  if (dragIndexRef.current !== null) e.preventDefault();
                }}
                onDrop={(e) => onTileDrop(e, index)}
                onClick={() => (selectMode ? toggleSelect(item.id) : setLightboxIndex(index))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (selectMode) toggleSelect(item.id);
                    else setLightboxIndex(index);
                  }
                }}
                aria-label={selectMode ? `Select media: ${caption}` : `Open media: ${caption}`}
                className={`group relative aspect-video overflow-hidden border bg-slate-950 text-left transition ${
                  selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                } ${
                  selected
                    ? 'border-[var(--team-primary)] outline outline-2 outline-[var(--team-primary)]'
                    : 'border-slate-200/80 hover:border-[var(--team-primary)] dark:border-slate-800'
                }`}
              >
                {item.mediaType === 'video' ? (
                  <>
                    <video src={fileUrl(item.absolutePath)} preload="metadata" muted className="pointer-events-none h-full w-full object-cover" />
                    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/60 bg-slate-950/60 px-3 py-1.5 text-sm font-semibold text-white">
                      ▶ Video
                    </span>
                  </>
                ) : (
                  <img
                    src={fileUrl(item.absolutePath)}
                    alt={caption}
                    loading="lazy"
                    /* A framed photo shows its framing here too — a crop you
                       saved and then didn't see anywhere would read as not
                       having saved. The tile stays object-cover (so nothing
                       letterboxes and un-framed tiles look exactly as before)
                       and the framing rides on top, which lands on the same
                       part of the photo cropped to the tile's shape. */
                    className={`pointer-events-none h-full w-full object-cover ${item.framing ? '' : 'transition duration-base ease-standard group-hover:scale-[1.03]'}`}
                    style={{ transform: framingTransform(item.framing) }}
                    draggable={false}
                  />
                )}

                {selectMode && (
                  <span
                    className={`pointer-events-none absolute left-2 top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                      selected
                        ? 'border-[var(--team-primary)] bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                        : 'border-white/70 bg-slate-950/50 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-6">
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (await confirm(DELETE_MEDIA_CONFIRM)) handleDeleted(item);
                      }}
                      aria-label={`Delete media: ${caption}`}
                      title="Delete"
                      className="pointer-events-auto shrink-0 border border-white/25 bg-slate-950/70 p-1.5 text-slate-200 transition hover:border-red-400/70 hover:bg-red-950/70 hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]"
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100">{caption}</span>
                  {item.playerIds.length > 0 && (
                    <span className="tnum shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {item.playerIds.length} tagged
                    </span>
                  )}
                </div>
              </div>
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
          onFramed={handleFramed}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
