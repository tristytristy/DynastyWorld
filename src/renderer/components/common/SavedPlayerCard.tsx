import { useLayoutEffect, useRef, useState } from 'react';
import { PlayerCard } from './PlayerCard';
import { mediaFileUrl } from './MediaGallery';
import { useTeamThemeVars } from '../../lib/cardTheme';
import type { PlayerCardRecord } from '../../../shared/types';

/** The card's design size. Everything scaled is scaled from this. */
export const CARD_DESIGN_W = 330;
export const CARD_DESIGN_H = 496;

/**
 * A SAVED card, drawn from its row rather than from live data.
 *
 * Everything comes off the record — the player as they were, the stat line as it
 * stood, which layers that card shows, the photo and its framing, and the school
 * whose colours it wears. That is what lets the card book show a card whose
 * player left the roster two seasons ago, and what makes a card of a player's
 * old school still look like that school.
 */
export function SavedPlayerCard({
  dynastyId,
  card,
  className = '',
  layerOverrides,
  hideMark = false,
}: {
  dynastyId: string;
  card: PlayerCardRecord;
  className?: string;
  /** Drops the DynastyOS mark — see PlayerCard. */
  hideMark?: boolean;
  /**
   * Layers to force OFF (or on) on top of the card's own choices — for the
   * hover preview, which shows a trimmed version of the card rather than a
   * different card. Applied over `card.layers`, so anything the user switched
   * off on their card stays off.
   */
  layerOverrides?: Partial<PlayerCardRecord['layers']>;
}) {
  const colorVars = useTeamThemeVars(dynastyId, card.teamName);
  return (
    <div className={`w-full ${className}`} style={colorVars}>
      <PlayerCard
        player={card.player}
        teamName={card.teamName}
        seasonYear={card.seasonYear}
        stats={card.stats}
        layers={{ ...card.layers, ...layerOverrides }}
        statSource={card.statSource}
        hideMark={hideMark}
        photoUrl={
          card.photoPath
            ? // Busted on updatedAt. Replacing a card's photo reuses the same
              // filename, so an un-busted src keeps drawing the image that was
              // replaced — the grid tile behind the editor would still show the
              // old shot after the big card had moved on.
              `${mediaFileUrl(card.photoPath)}?v=${encodeURIComponent(card.updatedAt)}`
            : null
        }
        photoTransform={card.photoTransform}
        scrim={card.scrim}
      />
    </div>
  );
}

/**
 * The same card at any width. It is rendered at its real 330px design width and
 * SCALED — not laid out at the target size: its type is fixed pixels (a 46px
 * surname), so a narrow container would give a full-size name on a postage
 * stamp, and a wide one would leave the name unchanged on a big card.
 *
 * Used small in the card grid and the book's pages, and LARGE in the expanded
 * view — which is why it isn't called "thumb".
 */
export function ScaledSavedPlayerCard({
  dynastyId,
  card,
  width = 78,
}: {
  dynastyId: string;
  card: PlayerCardRecord;
  width?: number;
}) {
  const scale = width / CARD_DESIGN_W;
  return (
    <div
      className="pointer-events-none relative overflow-hidden"
      style={{ width, height: Math.round((width * CARD_DESIGN_H) / CARD_DESIGN_W) }}
    >
      <div style={{ width: CARD_DESIGN_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <SavedPlayerCard dynastyId={dynastyId} card={card} />
      </div>
    </div>
  );
}

/**
 * The scaled card, sized by whatever box it lands in.
 *
 * The card grid wants three EQUAL cards to a row across a modal whose width the
 * cards don't get to choose, and `ScaledSavedPlayerCard` needs a number. So this
 * measures the box and hands that number over — the one place a card is laid out
 * by its container rather than the other way round.
 *
 * It reserves its height from the aspect ratio rather than from the measurement,
 * so the grid has its final shape on the first paint and doesn't reflow once the
 * observer fires.
 */
export function FluidSavedPlayerCard({ dynastyId, card }: { dynastyId: string; card: PlayerCardRecord }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setWidth(box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: `${CARD_DESIGN_W} / ${CARD_DESIGN_H}` }}
    >
      {/* ABSOLUTE, and that is not decoration. `transform: scale()` doesn't
          change layout, so a card left in normal flow still occupies its full
          496px however small it's drawn — which is what put a 140px hole under
          every row of the grid the first time this ran. Out of flow, the box
          keeps exactly the height its aspect ratio says. */}
      {width > 0 && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{ width: CARD_DESIGN_W, transform: `scale(${width / CARD_DESIGN_W})` }}
        >
          <SavedPlayerCard dynastyId={dynastyId} card={card} />
        </div>
      )}
    </div>
  );
}
