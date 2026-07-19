import { useEffect, useState } from 'react';
import { getCoachPortraitPath } from '../../lib/coachAssetMapping';

export function CoachPortrait({
  coach,
  size = 'md',
  className = '',
}: {
  coach: { firstName: string; lastName: string; portraitAssetName: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = getCoachPortraitPath(coach.portraitAssetName);

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

  return (
    <img
      src={src}
      alt={`${coach.firstName} ${coach.lastName}`}
      onError={() => setFailed(true)}
      className={`${sizeClass} ${className} shrink-0 ${fitClass}`}
      draggable={false}
    />
  );
}
