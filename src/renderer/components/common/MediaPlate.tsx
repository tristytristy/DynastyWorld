import type { ReactNode } from 'react';
import { TeamLogo } from './TeamLogo';
import { ZoomableImage, framingTransform } from './ZoomableImage';
import { getRivalryLogoPath } from '../../lib/rivalryAssetMapping';
import { getGameTypeImagePath } from '../../lib/scheduleFormat';
import { filterCss, resolveMediaLook, vignetteCss, washStyle, type MediaLook } from '../../../shared/mediaLook';
import type { MediaFraming, ScheduleGame } from '../../../shared/types';

/**
 * THE PLATE — one photograph, presented the same way everywhere it appears.
 *
 * User direction (2026-08-07): "instead of showing a new style of image preview
 * can we use the image preview style from the media page across the board...
 * The goal would be more visual cohesion and less like it was built by separate
 * people." It genuinely was: the Media page had grown a gallery plate — the
 * photo, its caption underneath, a program mark and an occasion mark in the
 * bottom corners, everything else hover chrome — while the player profile's
 * Showcase and the Game Info media section still used an older viewer with a
 * 320px sidebar of labelled boxes headed PHOTO DETAILS.
 *
 * Both drew the same photo and the same three facts. This is now the only thing
 * that draws them; the Media page adds its editing chrome through `actions` and
 * `children`, and nothing else has to know that editing exists.
 *
 * WHY THE CAPTION GOES UNDERNEATH rather than beside: a gallery print doesn't
 * put its label in a sidebar. Players, then description, then the game — the
 * order a caption reads: who, what, where. Anything absent simply isn't printed.
 */

/** A tagged player as the caption prints them. Structural, so both the Media page's roster rows and the resolved gallery items satisfy it. */
export interface PlateTaggedPlayer {
  id: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
}

/**
 * The occasion mark for a game — bowl logo, playoff round, conference
 * championship mark, rivalry shield, or the plain conference logo, in that order
 * of occasion. Absent for a plain non-conference game, which has no emblem worth
 * inventing.
 *
 * Exported because the Media page resolves it for its own grouping headers too,
 * and two implementations would drift the first time either was touched.
 */
export function occasionMarkSrc(game: ScheduleGame, appearance: 'light' | 'dark'): string | null {
  if (game.gameType !== 'bowl') {
    const rivalry = getRivalryLogoPath(game.teamName, game.opponent, game.isRivalryGame);
    if (rivalry) return rivalry;
  }
  return getGameTypeImagePath(game, appearance);
}

/**
 * The game as a SENTENCE rather than a scoreboard fragment.
 *
 * "21-14 win vs Eastern Michigan in week 0." is what a caption says; "Wk 0 @
 * E. Michigan W 21-14 →" is what a button says. This is a caption, so the
 * abbreviations go.
 */
export function gameSentence(game: ScheduleGame): string {
  const where = game.isHome ? 'vs' : 'at';
  const week = `week ${game.week}`;
  if (game.teamScore === null || game.opponentScore === null) {
    return `${where} ${game.opponent} in ${week}.`;
  }
  const outcome = game.result === 'W' ? 'win' : game.result === 'L' ? 'loss' : 'tie';
  return `${game.teamScore}-${game.opponentScore} ${outcome} ${where} ${game.opponent} in ${week}.`;
}

export function MediaPlate({
  src,
  mediaType,
  description,
  framing,
  look: rawLook,
  taggedPlayers,
  omitPlayerId,
  game,
  teamName,
  goldMark = false,
  appearance,
  index,
  total,
  onPrevious,
  onNext,
  onOpenPlayer,
  onOpenGame,
  /** Hover-chrome buttons for the top-right corner — close, and whatever the surface can do to this item. */
  actions,
  /** Replaces the plain <img> stage (the Media page swaps in a zoomable one while framing). */
  stage,
  plateRef,
  /** Suppresses the hover chrome outright — used while capturing an export, so it can't be baked into the PNG. */
  chromeHidden = false,
}: {
  src: string;
  mediaType: 'image' | 'video';
  description: string;
  framing: MediaFraming | null;
  look: Partial<MediaLook> | null;
  taggedPlayers: PlateTaggedPlayer[];
  /** The player whose own page this is — their chip is redundant there and is dropped. */
  omitPlayerId?: number;
  game: ScheduleGame | null;
  teamName: string | null;
  goldMark?: boolean;
  appearance: 'light' | 'dark';
  index: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenPlayer?: (playerId: number) => void;
  onOpenGame?: (gameId: number) => void;
  actions?: ReactNode;
  stage?: ReactNode;
  plateRef?: React.RefObject<HTMLDivElement>;
  chromeHidden?: boolean;
}) {
  const look = resolveMediaLook(rawLook);
  const players = taggedPlayers.filter((p) => p.id !== omitPlayerId);
  const occasionSrc = game ? occasionMarkSrc(game, appearance) : null;
  // What CAN be printed, and what the photo says to print — both have to be true.
  const showTeamMark = look.showTeamMark && !!teamName;
  const showOccasionMark = look.showOccasionMark && !!occasionSrc;

  const canGoPrevious = !!onPrevious && index > 0;
  const canGoNext = !!onNext && index < total - 1;

  /*
    `!transition-none` under `chromeHidden` is what makes an export honest, and
    it is not decoration: `!opacity-0` alone still ANIMATES to zero over 180ms,
    so the arrows and the counter were photographed around 80% opaque and baked
    into the PNG.
  */
  const chromeClass = `pointer-events-none absolute opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-within:opacity-100 ${
    chromeHidden ? '!opacity-0 !transition-none' : ''
  }`;

  return (
    <div ref={plateRef} className="flex min-h-0 flex-1 flex-col bg-slate-950">
      {/* group: the hover chrome hangs off this. overflow-hidden because a
          zoomed photo has to be clipped by something, and the stage is what it
          lives in. */}
      <div className="group relative flex min-h-[16rem] flex-1 items-center justify-center overflow-hidden lg:min-h-[30rem]">
        {stage ??
          (mediaType === 'video' ? (
            <video src={src} controls autoPlay={false} className="max-h-[74vh] max-w-full" />
          ) : (
            <img
              src={src}
              alt={description || 'Dynasty media'}
              draggable={false}
              className="max-h-[74vh] w-full select-none object-contain"
              style={{ transform: framingTransform(framing), filter: filterCss(look) || undefined }}
            />
          ))}

        {/*
          THE TREATMENT LAYERS, over the photo and under the chrome. Separate
          elements rather than more filter primitives because none of them IS a
          filter: a wash is a blended colour, a vignette is a gradient, and grain
          is a texture. All pointer-events-none so the photo underneath still
          takes a drag while it is being framed.
        */}
        {washStyle(look) && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: washStyle(look)?.background,
              mixBlendMode: washStyle(look)?.mixBlendMode as never,
              opacity: washStyle(look)?.opacity,
            }}
          />
        )}
        {vignetteCss(look) && (
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: vignetteCss(look) ?? undefined }} />
        )}
        {look.grain > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{
              opacity: look.grain / 100,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        )}

        {actions && <div className={`${chromeClass} right-3 top-3 flex items-center gap-1.5`}>{actions}</div>}

        {onPrevious && (
          <div className={`${chromeClass} left-3 top-1/2 -translate-y-1/2`}>
            <button
              type="button"
              onClick={() => canGoPrevious && onPrevious()}
              disabled={!canGoPrevious}
              aria-label="Previous media"
              title="Previous (←)"
              className={PLATE_CHROME_BUTTON}
            >
              ←
            </button>
          </div>
        )}
        {onNext && (
          <div className={`${chromeClass} right-3 top-1/2 -translate-y-1/2`}>
            <button
              type="button"
              onClick={() => canGoNext && onNext()}
              disabled={!canGoNext}
              aria-label="Next media"
              title="Next (→)"
              className={PLATE_CHROME_BUTTON}
            >
              →
            </button>
          </div>
        )}

        {total > 1 && (
          <span className={`${chromeClass} tnum bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/70 px-2.5 py-1 text-xs text-slate-300`}>
            {index + 1} / {total}
          </span>
        )}
      </div>

      {/*
        THE CAPTION, and the two marks flanking it — left is the program, right
        is the occasion, the reading order of a ticket stub: who, then what for.

        The marks are positioned absolutely against the caption row rather than
        placed in it, so a long caption wraps through the middle without ever
        pushing a mark off its corner; the caption keeps clear of them with its
        own horizontal padding.
      */}
      {(players.length > 0 || description || game || showTeamMark) && (
        <div className="relative shrink-0 px-28 py-6 text-center">
          {showTeamMark && teamName && (
            <TeamLogo
              team={{ assetName: teamName, label: teamName }}
              size="lg"
              variant={goldMark ? 'gold' : undefined}
              className="!absolute bottom-5 left-6 !h-[5.25rem] !w-[5.25rem] opacity-90"
            />
          )}
          {showOccasionMark && occasionSrc && (
            <img
              src={occasionSrc}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute bottom-5 right-6 h-[5.25rem] w-[5.25rem] object-contain opacity-90"
            />
          )}
          {players.length > 0 && (
            <p className="text-[15px] font-semibold leading-7 text-white">
              {players.map((player, i) => (
                <span key={player.id}>
                  {i > 0 && <span className="text-slate-500">, </span>}
                  <button
                    type="button"
                    onClick={() => onOpenPlayer?.(player.id)}
                    disabled={!onOpenPlayer}
                    className="transition hover:text-[var(--team-secondary)] disabled:cursor-default"
                  >
                    {player.jerseyNumber > 0 && <span className="tnum text-slate-400">#{player.jerseyNumber}</span>}{' '}
                    {player.firstName} {player.lastName}
                  </button>
                </span>
              ))}
            </p>
          )}
          {description && <p className="mt-1 text-[15px] leading-7 text-slate-200">{description}</p>}
          {game && (
            <button
              type="button"
              onClick={() => onOpenGame?.(game.gameId)}
              disabled={!onOpenGame}
              className="mt-1 text-[15px] leading-7 text-slate-300 transition hover:text-[var(--team-secondary)] disabled:cursor-default"
            >
              {gameSentence(game)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The plate's hover-chrome button — exported so a surface's own actions match the nav arrows exactly. */
export const PLATE_CHROME_BUTTON =
  'pointer-events-auto flex h-9 w-9 items-center justify-center border border-white/15 bg-slate-950/70 text-slate-200 backdrop-blur-sm transition hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

export { ZoomableImage };
