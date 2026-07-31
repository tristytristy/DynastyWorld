import { useLayoutEffect, useRef, useState } from 'react';
import { PlayerPortrait } from './PlayerPortrait';
import { DynastyOSMark } from './DynastyOSMark';
import { TeamLogo } from './TeamLogo';
import { fullPositionName } from '../../lib/positionNames';
import { ALL_CARD_LAYERS } from '../../../shared/types';
import type { CardLayers, RosterPlayer } from '../../../shared/types';

/** The big jersey number behind the art. Off at the user's request; see the block below. */
const SHOW_JERSEY_WATERMARK = false;

/** Humanize a dev-trait/scheme enum lightly (camelCase → spaced). */
function spaced(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/**
 * A premium, shareable player trading card — photo hero (portrait + team
 * jersey), the name running vertically up the left, OVR top-right, and a season
 * stat line along the bottom. Auto-themed to the active dynasty via the
 * --team-* CSS vars. `stats` are the same position-appropriate season tiles the
 * profile overview shows.
 */
export function PlayerCard({
  player,
  teamName,
  seasonYear,
  stats,
  photoUrl,
  photoTransform,
  onPhotoPointerDown,
  layers,
}: {
  player: RosterPlayer;
  teamName: string | null;
  seasonYear?: number | null;
  stats: { label: string; value: string }[];
  /** A user-supplied custom photo (file:// URL). When set, it replaces the portrait as the hero. */
  photoUrl?: string | null;
  photoTransform?: { x: number; y: number; scale: number };
  /** When provided, the photo area is draggable to reposition the custom photo. */
  onPhotoPointerDown?: (e: React.PointerEvent) => void;
  /** Which layers to draw. Omitted means all of them — the card as designed. */
  layers?: Partial<CardLayers>;
}) {
  const show = { ...ALL_CARD_LAYERS, ...layers };
  const line = stats.slice(0, 4);
  const t = photoTransform ?? { x: 0, y: 0, scale: 1 };

  // Auto-fit the vertical name: a pro card keeps the surname bold at a fixed
  // baseline and shrinks only names too long to fit (e.g. "Urionabarrenechea"),
  // so every card reads as intentional. Measured against the card's own height,
  // so it works at any size (full modal card or the small hover preview).
  const nameBoxRef = useRef<HTMLDivElement>(null);
  const nameInnerRef = useRef<HTMLDivElement>(null);
  const [nameScale, setNameScale] = useState(1);
  useLayoutEffect(() => {
    const box = nameBoxRef.current;
    const inner = nameInnerRef.current;
    if (!box || !inner) return;
    const measure = () => {
      const available = box.clientHeight;
      const needed = inner.scrollHeight; // vertical extent at base size (transform-independent)
      setNameScale(needed > available && needed > 0 ? Math.max(0.42, available / needed) : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [player.firstName, player.lastName]);
  return (
    // Wrapper carries the depth: a drop-shadow filter follows the clipped card's
    // cut-corner silhouette (box-shadow would be clipped away by clip-path).
    <div
      className="relative aspect-[330/496] w-full max-w-[340px]"
      style={{ filter: 'drop-shadow(0 20px 34px rgba(0,0,0,0.55))' }}
    >
    <div
      className="corner-cut absolute inset-0 overflow-hidden text-white"
      style={{
        background: 'linear-gradient(160deg, var(--team-primary), color-mix(in srgb, var(--team-primary) 48%, #000))',
        boxShadow: 'inset 0 0 0 3px color-mix(in srgb, var(--team-secondary) 32%, transparent)',
      }}
    >
      {/* Full-bleed photo — the player portrait+jersey by default, or the user's uploaded photo */}
      <div
        onPointerDown={onPhotoPointerDown}
        className={`absolute inset-0 overflow-hidden ${onPhotoPointerDown ? 'cursor-move touch-none' : ''}`}
      >
        {photoUrl ? (
          // object-contain so a wide (16:9) photo arrives whole — the user zooms
          // in and drags to frame it, and overflow-hidden keeps it in the card.
          <img
            src={photoUrl}
            draggable={false}
            alt=""
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`, transformOrigin: 'center' }}
          />
        ) : (
          <PlayerPortrait player={player} teamAssetName={teamName} size="lg" fill />
        )}
      </div>

      {/* Jersey-number watermark */}
      {/*
        Jersey watermark HIDDEN for now (user call). Left in place rather than
        deleted because it's a layout-sensitive element — the bottom-[62px] and
        z-2 values were both arrived at by measurement, and re-deriving them
        later would be redoing solved work. Flip SHOW_JERSEY_WATERMARK to bring
        it back exactly as it was.
      */}
      {SHOW_JERSEY_WATERMARK && (
        <span
          className="tnum pointer-events-none absolute bottom-[62px] right-1 z-[2] select-none font-black leading-none tracking-tighter"
          style={{ fontSize: '150px', color: 'rgba(255,255,255,0.5)' }}
        >
          {player.jerseyNumber}
        </span>
      )}

      {/* Bottom fade for legibility + foil sheen */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--team-primary) 55%, #000) 74%, color-mix(in srgb, var(--team-primary) 40%, #000) 100%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0.02) 56%, transparent 72%)' }}
      />

      {/* Position + OVR */}
      {/* Where the position abbreviation used to sit. A brand mark in the top
          corner is the Topps/Fleer convention — present, not competing: the
          player is the card. The position moved to the bottom band, spelled
          out, where it reads as information rather than a badge. */}
      <DynastyOSMark className="pointer-events-none absolute left-4 top-4 z-10 h-5 w-auto opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
      {show.ovr && (
        <div className="absolute right-4 top-3 z-10 text-right leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
          <span className="text-[44px] font-extrabold" style={{ color: 'var(--team-secondary)' }}>
            {player.overallRating}
          </span>
          <span className="block text-[10px] tracking-[0.3em] opacity-85">OVR</span>
        </div>
      )}

      {/* Vertical name — first (smaller) hugging the last (bigger), rising up from
          the bottom-left; auto-scaled to fit within the bounded box. */}
      <div
        ref={nameBoxRef}
        className={`absolute bottom-[98px] left-3 top-[58px] z-[4] flex items-end overflow-hidden ${show.name ? '' : 'hidden'}`}
      >
        <div
          ref={nameInnerRef}
          className="flex origin-bottom-left items-end will-change-transform"
          style={{ transform: `scale(${nameScale})` }}
        >
          <span className="[writing-mode:vertical-rl] mr-[-5px] rotate-180 pb-1.5 text-[20px] font-semibold tracking-wide drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]">
            {player.firstName}
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[46px] font-extrabold tracking-tight drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]">
            {player.lastName.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Bottom band — meta line, a wide single-line stat row, and the gold team logo */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-2">
        {/* Position leads the profile line rather than sitting above it in its
            own weight — one line of identity reads calmer than two, and nothing
            here should compete with the name. */}
        {show.profile && (
          <p className="mb-2 text-[11px] font-medium tracking-wide opacity-85">
            {[fullPositionName(player.position), teamName, spaced(player.schoolYear), seasonYear]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <div className="flex items-end justify-between gap-3">
          {show.stats && line.length > 0 && (
            <div className="flex flex-1 items-end justify-between gap-2 pr-1">
              {line.map((s) => (
                <div key={s.label} className="min-w-0">
                  <p className="text-[19px] font-extrabold leading-none" style={{ color: 'var(--team-secondary)' }}>
                    {s.value}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-[0.11em] opacity-70">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          )}
          {show.teamLogo && teamName && (
            <TeamLogo
              team={{ assetName: teamName, label: teamName }}
              size="lg"
              variant="gold"
              className="!h-12 !w-12 shrink-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            />
          )}
        </div>
      </div>
    </div>
    </div>
  );
}


/**
 * The star that puts a card in the card book.
 *
 * It sits just OUTSIDE the card's top-left corner rather than on the artwork,
 * and that placement is doing real work: the PNG export clips to the card
 * element's own bounding rect, so anything drawn inside the card has to be
 * hidden for the capture (as the Edit/Export rollover is). A control outside
 * that rect is simply never in the picture, which means it can stay visible all
 * the time — and a favourite you can't see isn't much of a favourite.
 */
export function FavoriteStar({
  on,
  onToggle,
  className = '',
}: {
  on: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? 'In your card book — click to remove' : 'Add this card to your card book'}
      className={`z-30 grid h-8 w-8 place-items-center transition ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" aria-hidden="true">
        {/* A fixed gold, deliberately NOT var(--team-secondary): the star means
            the same thing on every card, and half the league's secondary colour
            is a near-white that reads as "off" even when it's on. */}
        <path
          d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44l-5.81 3.06L7.3 14.03 2.6 9.45l6.5-.95L12 2.6z"
          fill={on ? '#f0b429' : 'none'}
          stroke={on ? '#f0b429' : 'currentColor'}
          strokeWidth={1.6}
          strokeLinejoin="round"
          className={on ? '' : 'text-slate-400 dark:text-slate-500'}
        />
      </svg>
      <span className="sr-only">{on ? 'Remove from card book' : 'Add to card book'}</span>
    </button>
  );
}
