import { TeamLogo } from './TeamLogo';
import { useViewedTeam } from '../../data/ViewedTeamProvider';

/**
 * The team dropdown shared by the team-scoped pages (Team Hub / Roster /
 * Schedule / Statistics / History) — "My Team" plus every team in this
 * season's league snapshot, with the active team's logo beside it. Hidden
 * entirely when the season has no league snapshot (synced before the league
 * browse feature) so pages just behave as before.
 */
export function TeamSwitcher({ userTeamName: userTeamNameProp }: { userTeamName?: string | null } = {}) {
  const { viewedTeamIndex, setViewedTeamIndex, leagueTeams, userTeamName: contextTeamName } = useViewedTeam();
  if (!leagueTeams || leagueTeams.length === 0) return null;

  const userTeamName = userTeamNameProp ?? contextTeamName;
  const activeName =
    viewedTeamIndex === null
      ? (userTeamName ?? 'My Team')
      : (leagueTeams.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team');

  return (
    <div className="flex items-center gap-2.5">
      <TeamLogo team={{ assetName: activeName, label: activeName }} size="sm" />
      <select
        value={viewedTeamIndex === null ? '' : viewedTeamIndex}
        onChange={(e) => setViewedTeamIndex(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="Viewed team"
        className="border border-slate-200/80 bg-slate-50/90 px-3 py-2 font-display text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
      >
        <option value="">{userTeamName ?? 'My Team'}</option>
        {/* The user's team is the '' option above with full data — skip its league-snapshot twin. */}
        {leagueTeams.filter((t) => t.displayName !== userTeamName).map((t) => (
          <option key={t.teamIndex} value={t.teamIndex}>
            {t.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
