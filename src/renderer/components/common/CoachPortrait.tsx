import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { getCoachPortraitPath } from '../../lib/coachAssetMapping';
import { getCoachPoloPath } from '../../lib/coachPoloAssetMapping';

export function CoachPortrait({
  coach,
  size = 'md',
  className = '',
  teamAssetName,
}: {
  coach: { firstName: string; lastName: string; portraitAssetName: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /**
   * The team this coach is on staff at. When it maps to a polo, that program's
   * polo is overlaid on the portrait — the coaching-staff equivalent of the
   * player jersey overlay. Applied at render time, so taking a new job just
   * changes this value and the polo follows. Omitted or unmapped renders the
   * plain portrait.
   */
  teamAssetName?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const src = getCoachPortraitPath(coach.portraitAssetName);
  const poloSrc = getCoachPoloPath(teamAssetName);

  useEffect(() => {
    setFailed(false);
  }, [coach.portraitAssetName]);

  const sizeClass =
    size === 'sm'
      ? 'h-16 w-16'
      : size === 'lg'
        ? 'h-28 w-28'
        : size === 'xl'
          ? 'h-[17.5rem] w-[21rem]'
          : 'h-20 w-20';
  // The hero-sized portrait crops from the top only (cover + bottom-anchored
  // in a box shorter than the square source): the game's coach PNGs carry
  // transparent headroom above the head, which used to render as dead space
  // in the hero. Shoulders sit at the bottom edge, so nothing real is lost.
  const fitClass = size === 'xl' ? 'object-cover object-bottom' : 'object-cover object-top';

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} ${className} inline-flex shrink-0 items-center justify-center bg-slate-200 text-lg font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${size === 'xl' ? 'text-6xl' : ''}`}
      >
        {coach.firstName.charAt(0)}
        {coach.lastName.charAt(0)}
      </div>
    );
  }

  const portraitImg = (
    <img
      src={src}
      alt={`${coach.firstName} ${coach.lastName}`}
      onError={() => setFailed(true)}
      className={poloSrc ? `h-full w-full ${fitClass}` : `${sizeClass} ${className} shrink-0 ${fitClass}`}
      draggable={false}
    />
  );

  if (!poloSrc) return portraitImg;

  // Portrait + polo overlay: both share the 512x512 canvas, so they stack 1:1
  // with the same object-fit and anchor. A missing polo file hides only the
  // overlay, leaving the portrait intact rather than breaking the whole avatar.
  return (
    <span className={`${sizeClass} ${className} relative inline-block shrink-0 overflow-hidden`}>
      {portraitImg}
      <img
        src={poloSrc}
        alt=""
        aria-hidden
        draggable={false}
        onError={(event: SyntheticEvent<HTMLImageElement>) => {
          event.currentTarget.style.display = 'none';
        }}
        className={`pointer-events-none absolute inset-0 h-full w-full ${fitClass}`}
      />
    </span>
  );
}
