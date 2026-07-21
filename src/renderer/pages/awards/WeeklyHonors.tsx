import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TeamLogo } from '../../components/common/TeamLogo';
import { PlayerNameButton } from './AwardsShared';
import { formatAwardLabel } from '../../lib/awardFormat';
import { useAwardsOverview } from '../../data/useAwardsOverview';
import { useViewedTeam } from '../../data/ViewedTeamProvider';

/** The user's own team's weekly honors — uses whichever weekly-award fields the save actually populates (see extract-awards.ts); no weekly category is invented that isn't real leaguewide extracted data. */
export function WeeklyHonors() {
  const { dynastyId, seasonId, awards } = useAwardsOverview();
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();

  // Weekly player honors are extracted for the user's own team only (the save
  // doesn't carry them leaguewide). When a non-user team is selected, show an
  // honest "your team only" notice instead of misleadingly rendering the user's
  // own honors under another program's Team Hub.
  if (viewedTeamIndex !== null) {
    const teamName = leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'This team';
    return (
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Weekly Honors</h3>
        <SurfaceCard className="mt-4 text-center text-sm text-slate-400 dark:text-slate-500">
          Weekly player honors are tracked for your own team only — {teamName}&apos;s weekly awards aren&apos;t recorded in
          the save&apos;s leaguewide data. Switch back to your team to see its weekly honors.
        </SurfaceCard>
      </div>
    );
  }

  if (awards === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading honors...</p>;
  if (awards === null) return <p className="text-slate-500 dark:text-slate-400">No honors recorded for this season yet.</p>;
  const { weeklyHonors } = awards;

  return (
    <div>
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Weekly Honors</h3>
      {weeklyHonors.length === 0 ? (
        <SurfaceCard className="mt-4 text-center text-sm text-slate-400 dark:text-slate-500">
          No weekly honors recorded for this season yet.
        </SurfaceCard>
      ) : (
        <SurfaceCard className="mt-4 divide-y divide-slate-200/70 p-0 dark:divide-white/5">
          {weeklyHonors.map((honor, index) => (
            <div key={`${honor.week}-${honor.awardType}-${honor.playerId}-${index}`} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Week {honor.week}
                </p>
                <p className="mt-0.5 font-semibold text-slate-950 dark:text-white">{formatAwardLabel(honor.awardType)}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  <PlayerNameButton
                    dynastyId={dynastyId}
                    playerId={honor.playerId}
                    seasonId={seasonId}
                    name={honor.playerName}
                    className="font-medium text-slate-700 dark:text-slate-200"
                    showPortrait
                    portraitAssetName={honor.portraitAssetName}
                  />
                  {' | '}
                  {honor.position}
                </p>
              </div>
              {honor.opponent && (
                <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>vs.</span>
                  <TeamLogo team={{ assetName: honor.opponent, label: honor.opponent }} size="sm" />
                  <span>{honor.opponent}</span>
                </div>
              )}
            </div>
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}
