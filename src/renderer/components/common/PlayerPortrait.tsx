import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getPlayerPortraitCandidates } from '../../lib/playerAssetMapping';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || 'P';
}

export function PlayerPortrait({
  player,
  size = 'md',
  className = '',
  large = false,
  onClick,
}: {
  player: { firstName: string; lastName: string; portraitAssetName: string | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  large?: boolean;
  /** When provided, the portrait becomes a keyboard-accessible click target (e.g. to open the player modal) instead of a static image. */
  onClick?: () => void;
}) {
  const candidates = useMemo(
    () => getPlayerPortraitCandidates(player.portraitAssetName),
    [player.portraitAssetName],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [player.portraitAssetName]);

  const sizeClass =
    size === 'sm'
      ? 'h-16 w-16'
      : size === 'lg'
        ? 'h-28 w-28'
        : 'h-20 w-20';

  const src = candidates[candidateIndex] ?? null;

  const interactiveProps = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        },
      }
    : {};

  if (!src) {
    return (
      <div
        {...interactiveProps}
        className={`${large ? 'max-h-[22rem] max-w-full px-6 py-4' : sizeClass} ${className} inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-200 text-2xl font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${onClick ? 'cursor-pointer transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]' : ''}`}
      >
        {initials(player.firstName, player.lastName)}
      </div>
    );
  }

  return (
    <img
      {...interactiveProps}
      src={src}
      alt={`${player.firstName} ${player.lastName}`}
      onError={() => setCandidateIndex((current) => current + 1)}
      className={
        (large
          ? `${className} max-h-[22rem] max-w-full rounded-xl object-contain object-top`
          : `${sizeClass} ${className} shrink-0 rounded-xl object-cover object-top`) +
        (onClick ? ' cursor-pointer transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]' : '')
      }
      draggable={false}
    />
  );
}
