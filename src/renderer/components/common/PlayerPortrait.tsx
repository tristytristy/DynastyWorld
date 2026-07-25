import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { getPlayerPortraitCandidates } from '../../lib/playerAssetMapping';
import { getJerseyPath } from '../../lib/jerseyAssetMapping';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || 'P';
}

export function PlayerPortrait({
  player,
  size = 'md',
  className = '',
  large = false,
  onClick,
  teamAssetName,
}: {
  player: { firstName: string; lastName: string; portraitAssetName: string | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  large?: boolean;
  /** When provided, the portrait becomes a keyboard-accessible click target (e.g. to open the player modal) instead of a static image. */
  onClick?: () => void;
  /**
   * The player's CURRENT team. When it maps to a jersey, that team's uniform is
   * overlaid on the portrait (both are 512×512, so it's a 1:1 stack) — the
   * player appears dressed for the team they represent. Applied at render time,
   * so a transfer just changes this value and the jersey follows. Omitted or
   * unmapped → the portrait renders as-is.
   */
  teamAssetName?: string | null;
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
  const jerseySrc = getJerseyPath(teamAssetName);

  const interactiveClass = onClick
    ? 'cursor-pointer transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)]'
    : '';

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

  // No portrait → initials placeholder (no body to dress in a jersey).
  if (!src) {
    return (
      <div
        {...interactiveProps}
        className={`${large ? 'max-h-[22rem] max-w-full px-6 py-4' : sizeClass} ${className} inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-200 text-2xl font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${interactiveClass}`}
      >
        {initials(player.firstName, player.lastName)}
      </div>
    );
  }

  const fit = large ? 'object-contain' : 'object-cover';
  const imgClass = large
    ? `${className} max-h-[22rem] max-w-full rounded-xl ${fit} object-top`
    : `${sizeClass} ${className} shrink-0 rounded-xl ${fit} object-top`;

  const portraitImg = (
    <img
      src={src}
      alt={`${player.firstName} ${player.lastName}`}
      onError={() => setCandidateIndex((current) => current + 1)}
      className={imgClass}
      draggable={false}
    />
  );

  // No team jersey to apply → the plain portrait (unchanged from before).
  if (!jerseySrc) {
    return interactiveProps.onClick ? (
      <img
        {...interactiveProps}
        src={src}
        alt={`${player.firstName} ${player.lastName}`}
        onError={() => setCandidateIndex((current) => current + 1)}
        className={`${imgClass} ${interactiveClass}`}
        draggable={false}
      />
    ) : (
      portraitImg
    );
  }

  // Portrait + jersey overlay: the wrapper shrinks to the portrait, the jersey
  // sits in the same box with the same object-fit so the two register exactly.
  return (
    <span {...interactiveProps} className={`relative inline-block shrink-0 ${interactiveClass}`}>
      {portraitImg}
      <img
        src={jerseySrc}
        alt=""
        aria-hidden
        draggable={false}
        onError={(event: SyntheticEvent<HTMLImageElement>) => {
          event.currentTarget.style.display = 'none';
        }}
        className={`pointer-events-none absolute inset-0 h-full w-full rounded-xl ${fit} object-top`}
      />
    </span>
  );
}
