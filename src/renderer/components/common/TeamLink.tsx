import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { TeamLogo } from './TeamLogo';
import { canonicalKey } from '../../lib/assetMapping';
import { useTeamModalOptional } from '../../data/TeamModalProvider';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';
import { useSelectedSeasonOptional } from '../../data/SelectedSeasonProvider';
import type { LeagueTeamSummary } from '../../../shared/types';

/** The generic FCS pool (five buckets, all index 255) — never a real, browsable team. */
const FCS_POOL_TEAM_INDEX = 255;

/**
 * Resolve a team display name to its league index, tolerant of abbreviations
 * (schedule/box-score names) via the same canonicalKey + alias table logos use.
 * Returns null for the FCS pool or any unknown name. Exported for callers that
 * only have a name and want to decide clickability themselves.
 */
export function resolveTeamIndex(
  teamName: string,
  leagueTeams: LeagueTeamSummary[] | null | undefined,
): number | null {
  if (!leagueTeams) return null;
  const target = canonicalKey(teamName);
  for (const t of leagueTeams) {
    if (t.teamIndex === FCS_POOL_TEAM_INDEX) continue;
    if (canonicalKey(t.displayName) === target) return t.teamIndex;
  }
  return null;
}

/**
 * A clickable team name (+ optional logo) that opens the global Team modal — the
 * team counterpart to Awards' PlayerNameButton. Prefers an explicit `teamIndex`
 * (surfaces that already have it, e.g. Schedule/Scores/GameDetail); otherwise
 * resolves the name against the league list. Falls back to plain, non-clickable
 * text when it can't resolve, when it's the FCS pool, or when rendered outside a
 * dynasty/modal context — so it's always safe to drop in.
 */
export function TeamLink({
  teamIndex,
  teamName,
  dynastyId,
  seasonId,
  size = 'sm',
  showLogo = true,
  className = '',
  logoClassName = '',
  nameClassName = '',
  children,
}: {
  teamIndex?: number | null;
  teamName: string;
  /** Explicit dynasty id (e.g. from the app-root game modal, where the route :id param isn't in scope); falls back to the route param. */
  dynastyId?: string;
  /** Explicit season (e.g. from the app-root game modal, outside SelectedSeasonProvider); falls back to the selected season. */
  seasonId?: number;
  size?: 'sm' | 'md' | 'lg';
  showLogo?: boolean;
  className?: string;
  logoClassName?: string;
  nameClassName?: string;
  /** Override the rendered label (defaults to teamName). */
  children?: ReactNode;
}) {
  const modal = useTeamModalOptional();
  const viewed = useViewedTeamOptional();
  const season = useSelectedSeasonOptional();
  const { id: routeId } = useParams<{ id: string }>();

  const effectiveDynastyId = dynastyId ?? routeId;
  const effectiveSeasonId = seasonId ?? season?.selectedSeasonId;
  const resolvedIndex =
    teamIndex ?? resolveTeamIndex(teamName, viewed?.leagueTeams);
  const clickable =
    modal != null && effectiveDynastyId != null && resolvedIndex != null && resolvedIndex !== FCS_POOL_TEAM_INDEX;

  const inner = (
    <>
      {showLogo && (
        <TeamLogo team={{ assetName: teamName, label: teamName }} size={size} className={logoClassName} />
      )}
      <span className={`${clickable ? 'transition-colors group-hover:text-[var(--team-primary)] group-hover:underline underline-offset-2 decoration-1' : ''} ${nameClassName}`}>
        {children ?? teamName}
      </span>
    </>
  );

  if (!clickable) {
    return <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>{inner}</span>;
  }

  return (
    <button
      type="button"
      data-team-link={resolvedIndex}
      onClick={(e) => {
        e.stopPropagation();
        modal!.openTeamModal(effectiveDynastyId!, resolvedIndex!, effectiveSeasonId);
      }}
      className={`group inline-flex min-w-0 items-center gap-1.5 text-left ${className}`}
    >
      {inner}
    </button>
  );
}
