import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { TeamLogo } from '../../components/common/TeamLogo';
import { PlayerNameButton } from './AwardsShared';
import { formatAwardLabel } from '../../lib/awardFormat';
import { useAwardsOverview } from '../../data/useAwardsOverview';

/** The user's own team's weekly honors — uses whichever weekly-award fields the save actually populates (see extract-awards.ts); no weekly category is invented that isn't real leaguewide extracted data. */
export function WeeklyHonors() {
  const { dynastyId, seasonId, awards } = useAwardsOverview();

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
