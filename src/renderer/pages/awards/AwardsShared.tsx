import { usePlayerModal } from '../../data/PlayerModalProvider';
import { TeamLogo } from '../../components/common/TeamLogo';
import { PlayerPortrait } from '../../components/common/PlayerPortrait';

/** Splits a "First Last" display name into (first, last) — award data only ever carries a combined display name, but PlayerPortrait needs the two split apart (for its own initials fallback, on the rare player with no portrait asset set). */
function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function PlayerNameButton({
  dynastyId,
  playerId,
  seasonId,
  name,
  position,
  teamDisplayName,
  className,
  showPortrait = false,
  portraitAssetName = null,
}: {
  dynastyId: string;
  playerId: number;
  seasonId?: number;
  name: string;
  /** Position/team, when known here, are passed through as a fallback so the modal can still show something useful if this player (e.g. an opposing team's award winner) isn't in the locally-extracted roster. */
  position?: string;
  teamDisplayName?: string;
  className: string;
  /** Renders a small PlayerPortrait (clickable, same handler) next to the name. Off by default so dense list rows aren't forced to grow. */
  showPortrait?: boolean;
  /** Real portrait asset — leaguewide award data (Heisman/All-America/Annual Awards) resolves this via a leaguewide playerId->portrait lookup (see getLeaguePortraits.ts), same as any roster player. */
  portraitAssetName?: string | null;
}) {
  const { openPlayerModal } = usePlayerModal();
  const fallback = position && teamDisplayName ? { name, position, teamDisplayName, portraitAssetName } : undefined;
  const open = () => openPlayerModal(dynastyId, playerId, seasonId, undefined, fallback);

  const nameButton = (
    <button type="button" onClick={open} className={`text-left hover:underline ${className}`}>
      {name}
    </button>
  );

  if (!showPortrait) return nameButton;

  return (
    <span className="flex items-center gap-2.5">
      <PlayerPortrait player={{ ...splitDisplayName(name), portraitAssetName }} size="sm" onClick={open} teamAssetName={teamDisplayName} />
      {nameButton}
    </span>
  );
}

export function TeamLine({ teamName }: { teamName: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
      <TeamLogo team={{ assetName: teamName, label: teamName }} size="sm" />
      <span>{teamName}</span>
    </div>
  );
}
