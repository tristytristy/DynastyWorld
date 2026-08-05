import { useLayoutEffect, useRef, useState } from 'react';
import { PlayerPortrait } from './PlayerPortrait';
import { DynastyOSMark } from './DynastyOSMark';
import { TeamLogo } from './TeamLogo';
import { fullPositionName } from '../../lib/positionNames';
import { ALL_CARD_LAYERS, DEFAULT_CARD_SCRIM } from '../../../shared/types';
import type { CardLayers, CardScrim, CardStatSource, RosterPlayer } from '../../../shared/types';

/**
 * The opponent a card's stats came from, or null for a season card.
 *
 * READ OFF THE SOURCE THE CARD ALREADY STORES rather than added to the schema:
 * a game source's label is built as "Wk 5 · vs Georgia", so the opponent is the
 * segment after the separator and it is already the right words. Parsing is
 * deliberately forgiving — no separator, or a shape this doesn't recognise, and
 * the line simply doesn't render rather than printing something malformed.
 *
 * AWAY GAMES ARE WRITTEN "@", NOT "at". Every builder of this label spells the
 * away side `@` (PlayerProfileContent's `matchup`, Media's `gameLabel`,
 * database/media.ts) — so the original `vs|at` test accepted a form nothing
 * produces and rejected half of what does, and the opponent line silently never
 * appeared on a road-game card however the toggle was set. `@` is matched
 * without a word boundary because `\b` needs a word character beside it and `@`
 * is not one; `at` is kept only as forgiveness for a label shape that may exist
 * on cards already saved.
 *
 * A SEASON card returns null and can never show one: there is no opponent to
 * name, and inventing one is worse than leaving the row out.
 */
export function cardOpponent(source: CardStatSource | null | undefined): string | null {
  if (!source || source.kind !== 'game') return null;
  const tail = source.label.split('·').pop()?.trim();
  if (!tail) return null;
  return /^(?:vs\b|at\b|@)/i.test(tail) ? tail : null;
}

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
  statSource,
  scrim = DEFAULT_CARD_SCRIM,
  hideMark = false,
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
  /** Where the stats came from. A GAME source is what puts an opponent on the card. */
  statSource?: CardStatSource | null;
  /** The bottom fade. Omitted means the app default — see CardScrim. */
  scrim?: CardScrim;
  /**
   * Drops the DynastyOS mark.
   *
   * Not a layer, deliberately, and for the same reason the mark isn't in
   * CardLayers at all: it is the card's maker's mark, so it isn't the card
   * owner's to switch off. This is a property of the SURFACE — on the Hall board
   * the cards stand eleven at a time in a formation, where eleven copies of the
   * same mark stop being a signature and start being wallpaper.
   */
  hideMark?: boolean;
}) {
  const show = { ...ALL_CARD_LAYERS, ...layers };
  const opponent = cardOpponent(statSource);
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
          background:
            'linear-gradient(160deg, var(--team-primary), color-mix(in srgb, var(--team-primary) 48%, #000))',
          boxShadow: 'inset 0 0 0 3px color-mix(in srgb, var(--team-secondary) 32%, transparent)',
        }}
      >
        {/* Full-bleed photo — the player portrait+jersey by default, or the user's uploaded photo */}
        {/* `card-photo` is a HOOK, not a style — it carries no rules of its own.
          It exists so a surface can animate the photo without reaching for the
          <img>, which on a custom photo already carries an inline transform
          holding the user's own crop. Scaling the container scales whatever is
          inside it, portrait or photograph, and leaves that crop alone. */}
        <div
          onPointerDown={onPhotoPointerDown}
          className={`card-photo absolute inset-0 overflow-hidden ${onPhotoPointerDown ? 'cursor-move touch-none' : ''}`}
        >
          {photoUrl ? (
            // object-contain so a wide (16:9) photo arrives whole — the user zooms
            // in and drags to frame it, and overflow-hidden keeps it in the card.
            <img
              src={photoUrl}
              draggable={false}
              alt=""
              className="absolute inset-0 h-full w-full select-none object-contain"
              style={{
                transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
                transformOrigin: 'center',
              }}
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

        {/*
        BOTTOM FADE — how far up the card it reaches is the CARD's setting now
        (schema v18), not a constant.

        It was transparent at 42% and solid by 74%, which is fine over a
        generated portrait — a head on a flat background with nothing in the
        lower half worth seeing — and wrong over a photograph. Someone framing
        their own shot was composing against a fade covering more than half the
        card, so the moment they were trying to place either sat in the dark or
        had to be dragged up out of frame to escape it.

        The stops are derived from `height` rather than stored, so the shape of
        the fade stays the same at every setting and only its reach changes: it
        begins at the top of the band, is two-thirds down to full at 55% through
        it, and lands on the same two colours it always did. `height` is measured
        UP FROM THE BOTTOM, so 0.30 leaves the top 70% of the photograph clear.
      */}
        {scrim.enabled && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: `linear-gradient(180deg, transparent ${(1 - scrim.height) * 100}%, color-mix(in srgb, var(--team-primary) 55%, #000) ${(1 - scrim.height * 0.45) * 100}%, color-mix(in srgb, var(--team-primary) 40%, #000) 100%)`,
            }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(115deg, transparent 32%, rgba(255,255,255,0.12) 46%, rgba(255,255,255,0.02) 56%, transparent 72%)',
          }}
        />

        {/* Position + OVR */}
        {/* Where the position abbreviation used to sit. A brand mark in the top
          corner is the Topps/Fleer convention — present, not competing: the
          player is the card. The position moved to the bottom band, spelled
          out, where it reads as information rather than a badge. */}
        {!hideMark && (
          <DynastyOSMark className="pointer-events-none absolute left-4 top-4 z-10 h-5 w-auto opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
        )}
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
          {/*
          THE OPPONENT SITS ABOVE THE PROFILE LINE, in the name's own display
          face: a card made from one game is about that game, so the matchup
          outranks the position-and-school row it introduces.

          IT CLEARS THE VERTICAL NAME rather than starting at the card's edge.
          The surname runs bottom-up in its own column down the left side, and
          this line sits high enough in the band to collide with it — so it is
          indented past that column instead of being drawn over it. Tied to
          `show.name`: with the name layer off there is nothing to clear, and the
          indent would just be a gap.

          `truncate` on a block with `min-w-0` is what keeps a long school
          inside the card — "vs. Southern Mississippi" is nearly twice "vs.
          LSU", and the alternative to clipping is a second line that pushes
          the stat row off the bottom edge.
        */}
          {show.opponent && opponent && (
            <p
              className={`mb-1 min-w-0 truncate font-display text-lg font-bold leading-tight ${
                show.name ? 'pl-24' : ''
              }`}
            >
              {opponent}
            </p>
          )}
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
                    <p
                      className="text-[19px] font-extrabold leading-none"
                      style={{ color: 'var(--team-secondary)' }}
                    >
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
