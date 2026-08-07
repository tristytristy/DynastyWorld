import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaFraming, MediaItemResolved } from '../../../shared/types';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useGameModal } from '../../data/GameModalProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { ModalOverlay } from './ModalOverlay';
import { MediaPlate, PLATE_CHROME_BUTTON } from './MediaPlate';
import { framingTransform } from './ZoomableImage';

/**
 * Absolute on-disk path → a URL the (file://-origin) renderer can load. Shared
 * with the Media page and the player card.
 *
 * Handles UNC paths (`\\NAS\share\shot.png` → `file://NAS/share/shot.png`)
 * separately from local ones: the library folder is user-chosen now, so a
 * network share is a real possibility, and the plain `file:///` + slash-swap
 * would turn one into `file://///NAS/...`, which doesn't resolve.
 */
export function mediaFileUrl(absolutePath: string): string {
  const slashed = absolutePath.replace(/\\/g, '/');
  return encodeURI(slashed.startsWith('//') ? `file:${slashed}` : `file:///${slashed}`);
}

/**
 * Read-only media gallery — thumbnail grid + lightbox with prev/next — for
 * the surfaces that auto-populate from tags: the Media tab on player bios and
 * the media section on the Game info page. Uses the server-resolved display
 * fields (gameLabel, taggedPlayers) so items render correctly against their
 * OWN season, wherever they're shown. Managing items (game/tags/description,
 * delete) stays on the season's Media page.
 *
 * FRAMING IS THE EXCEPTION, and deliberately: how a photo is cropped is
 * presentation, not metadata. Re-tagging which game a shot belongs to from a
 * player's bio would be confusing — the item spans seasons and the bio isn't
 * where it's managed — but "this photo should be cropped like THIS" is
 * unambiguous wherever you're looking at it, and refusing it here would mean
 * walking to the Media page to fix a crop you're staring at.
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
  const { appearance } = useTheme();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /*
    FRAMING IS NO LONGER EDITED HERE. This gallery used to offer a crop, and
    kept a local overlay of saved framings because the parent owns `items` and
    doesn't refetch after one. Adopting the shared plate (see MediaPlate) made
    it read-only — the same call the plate's own note makes: an item's game,
    tags and now its crop are managed on the Media page of its season, and a
    viewer reached from a player's profile is not that place. Saved framings are
    still SHOWN, exactly as saved.
  */
  const framingFor = (media: MediaItemResolved): MediaFraming | null => media.framing;

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
                  /* A framed photo shows its framing here too — a crop you saved
                     and then didn't see anywhere would read as not having saved.
                     Stays object-cover so nothing letterboxes and un-framed
                     tiles look exactly as before. */
                  className={`h-full w-full object-cover ${framingFor(mediaItem) ? '' : 'transition duration-base ease-standard group-hover:scale-[1.03]'}`}
                  style={{ transform: framingTransform(framingFor(mediaItem)) }}
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
        <ModalOverlay
          className="modal-scrim modal-scrim-deep fixed inset-0 flex items-center justify-center p-4 md:p-8"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Media viewer"
            className="corner-cut flex max-h-full w-full max-w-5xl flex-col overflow-hidden modal-panel"
          >
            {/*
              THE SAME PLATE THE MEDIA PAGE DRAWS (user direction 2026-08-07).
              What stood here was a photo beside a 320px column of labelled boxes
              — DESCRIPTION, GAME, PLAYERS — which was every fact the plate puts
              in its caption, drawn as a form instead of as a label under a
              print. Two surfaces, two designs, one subject.

              READ-ONLY, which is the honest difference between the surfaces
              rather than a second design: this gallery is reached from a
              player's profile or a game's page, where an item's game and tags
              are managed somewhere else entirely. So it passes no `actions`
              beyond Close, and framing/treatment are shown as saved. The note
              telling the reader where to manage it sits under the plate.
            */}
            <MediaPlate
              key={item.id}
              src={mediaFileUrl(item.absolutePath)}
              mediaType={item.mediaType}
              description={item.description}
              framing={framingFor(item)}
              look={item.look}
              taggedPlayers={item.taggedPlayers.map((p) => ({
                id: p.playerId,
                firstName: p.firstName,
                lastName: p.lastName,
                jerseyNumber: p.jerseyNumber,
              }))}
              omitPlayerId={omitPlayerId}
              game={hideGameChip ? null : item.game}
              teamName={item.game?.teamName ?? null}
              appearance={appearance}
              index={lightboxIndex}
              total={items.length}
              onPrevious={() => setLightboxIndex(lightboxIndex - 1)}
              onNext={() => setLightboxIndex(lightboxIndex + 1)}
              onOpenPlayer={(playerId) => {
                setLightboxIndex(null);
                openPlayerModal(dynastyId, playerId, item.seasonId);
              }}
              onOpenGame={(gameId) => {
                setLightboxIndex(null);
                openGameModal(dynastyId, gameId, item.seasonId);
              }}
              actions={
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  aria-label="Close media viewer"
                  title="Close (Esc)"
                  className={PLATE_CHROME_BUTTON}
                >
                  ✕
                </button>
              }
            />
            <p className="shrink-0 border-t border-white/10 bg-slate-950 px-4 py-2.5 text-center text-xs text-slate-500">
              Manage this item (game, tags, description) on the Media page of its season.
            </p>
          </div>
        </ModalOverlay>,
        document.body,
      )}
    </>
  );
}
