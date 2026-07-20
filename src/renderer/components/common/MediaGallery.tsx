import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaItemResolved } from '../../../shared/types';
import { PlayerPortrait } from './PlayerPortrait';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useGameModal } from '../../data/GameModalProvider';

/** Absolute on-disk path → a URL the (file://-origin) renderer can load. Shared with the Media page. */
export function mediaFileUrl(absolutePath: string): string {
  return encodeURI(`file:///${absolutePath.replace(/\\/g, '/')}`);
}

/**
 * Read-only media gallery — thumbnail grid + lightbox with prev/next — for
 * the surfaces that auto-populate from tags: the Media tab on player bios and
 * the media section on the Game info page. Uses the server-resolved display
 * fields (gameLabel, taggedPlayers) so items render correctly against their
 * OWN season, wherever they're shown. Managing items (game/tags/description,
 * delete) stays on the season's Media page.
 */
export function MediaGallery({
  dynastyId,
  items,
  /** Set when the surface already IS the linked game (GameDetail) — the game chip becomes redundant there and is hidden. */
  hideGameChip = false,
  /** Player id whose bio this gallery is on — that player's own chip is hidden (linking to the page you're already on). */
  omitPlayerId,
}: {
  dynastyId: string;
  items: MediaItemResolved[];
  hideGameChip?: boolean;
  omitPlayerId?: number;
}) {
  const { openPlayerModal } = usePlayerModal();
  const { openGameModal } = useGameModal();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const item = lightboxIndex !== null ? items[lightboxIndex] : undefined;

  const canGoPrevious = lightboxIndex !== null && lightboxIndex > 0;
  const canGoNext = lightboxIndex !== null && lightboxIndex < items.length - 1;

  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setLightboxIndex(null);
      } else if (event.key === 'ArrowLeft' && canGoPrevious) {
        event.preventDefault();
        setLightboxIndex((prev) => (prev !== null ? prev - 1 : prev));
      } else if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        setLightboxIndex((prev) => (prev !== null ? prev + 1 : prev));
      }
    }
    document.addEventListener('keydown', handleKeys);
    return () => document.removeEventListener('keydown', handleKeys);
  }, [lightboxIndex, canGoPrevious, canGoNext]);

  const navButtonClass =
    'border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map((mediaItem, index) => {
          const caption = mediaItem.gameLabel ?? mediaItem.description ?? '';
          return (
            <button
              key={mediaItem.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`Open media${caption ? `: ${caption}` : ''}`}
              className="group relative aspect-video overflow-hidden border border-slate-200/80 bg-slate-950 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800"
            >
              {mediaItem.mediaType === 'video' ? (
                <>
                  <video src={mediaFileUrl(mediaItem.absolutePath)} preload="metadata" muted className="h-full w-full object-cover" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/60 bg-slate-950/60 px-3 py-1.5 text-sm font-semibold text-white">
                    ▶ Video
                  </span>
                </>
              ) : (
                <img
                  src={mediaFileUrl(mediaItem.absolutePath)}
                  alt={caption || 'Dynasty media'}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-base ease-standard group-hover:scale-[1.03]"
                  draggable={false}
                />
              )}
              {caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-slate-950/0 px-2.5 pb-2 pt-6">
                  <span className="block truncate text-xs font-medium text-slate-100">{caption}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Portaled to <body>: this gallery renders inside backdrop-blur surfaces (cards, the player modal), and backdrop-filter creates a containing block that would trap a fixed overlay inside the card instead of covering the viewport. */}
      {item && lightboxIndex !== null && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md md:p-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Media viewer"
            className="corner-cut flex max-h-full w-full max-w-6xl flex-col overflow-hidden border border-white/70 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 lg:flex-row"
          >
            <div className="relative flex min-h-[16rem] flex-1 items-center justify-center bg-slate-950 lg:min-h-[28rem]">
              {item.mediaType === 'video' ? (
                <video key={item.id} src={mediaFileUrl(item.absolutePath)} controls className="max-h-[70vh] max-w-full" />
              ) : (
                <img
                  key={item.id}
                  src={mediaFileUrl(item.absolutePath)}
                  alt={item.description || 'Dynasty media'}
                  className="max-h-[70vh] max-w-full object-contain"
                  draggable={false}
                />
              )}
              <button
                type="button"
                onClick={() => canGoPrevious && setLightboxIndex(lightboxIndex - 1)}
                disabled={!canGoPrevious}
                aria-label="Previous media"
                title="Previous (←)"
                className={`${navButtonClass} absolute left-3 top-1/2 -translate-y-1/2`}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => canGoNext && setLightboxIndex(lightboxIndex + 1)}
                disabled={!canGoNext}
                aria-label="Next media"
                title="Next (→)"
                className={`${navButtonClass} absolute right-3 top-1/2 -translate-y-1/2`}
              >
                →
              </button>
              <span className="tnum absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-200">
                {lightboxIndex + 1} / {items.length}
              </span>
            </div>

            <div className="flex w-full shrink-0 flex-col border-t border-slate-200/80 dark:border-white/10 lg:w-80 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  {item.mediaType === 'video' ? 'Video' : 'Photo'} details
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close media viewer"
                  className="border border-slate-300/80 bg-white/85 px-2.5 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {item.description && (
                  <div>
                    <p className="type-eyebrow text-slate-400 dark:text-slate-500">Description</p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-700 dark:text-slate-200">{item.description}</p>
                  </div>
                )}

                {!hideGameChip && item.gameLabel && item.gameId !== null && (
                  <div>
                    <p className="type-eyebrow text-slate-400 dark:text-slate-500">Game</p>
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxIndex(null);
                        openGameModal(dynastyId, item.gameId!, item.seasonId);
                      }}
                      className="mt-1.5 inline-block border border-slate-200/80 bg-slate-50/85 px-3 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
                    >
                      {item.gameLabel} →
                    </button>
                  </div>
                )}

                {item.taggedPlayers.filter((p) => p.playerId !== omitPlayerId).length > 0 && (
                  <div>
                    <p className="type-eyebrow text-slate-400 dark:text-slate-500">Players</p>
                    <div className="mt-1.5 space-y-1">
                      {item.taggedPlayers
                        .filter((p) => p.playerId !== omitPlayerId)
                        .map((player) => (
                          <button
                            key={player.playerId}
                            type="button"
                            onClick={() => {
                              setLightboxIndex(null);
                              openPlayerModal(dynastyId, player.playerId, item.seasonId);
                            }}
                            className="flex w-full items-center gap-2.5 border border-slate-200/80 bg-slate-50/85 px-2.5 py-1.5 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
                          >
                            <PlayerPortrait player={player} size="sm" className="!h-7 !w-7" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {player.firstName} {player.lastName}
                            </span>
                            {player.position && (
                              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{player.position}</span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <p className="border-t border-slate-200/60 pt-3 text-xs text-slate-400 dark:border-slate-800/60 dark:text-slate-500">
                  Manage this item (game, tags, description) on the Media page of its season.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
