import { useMemo } from 'react';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { PlayerNameButton, TeamLine } from './AwardsShared';
import { formatAwardLabel, sortAnnualAwards } from '../../lib/awardFormat';
import { getAwardTrophyPath } from '../../lib/trophyAssetMapping';
import { useAwardsOverview } from '../../data/useAwardsOverview';
import type { HeismanCandidate, LeagueAward } from '../../../shared/types';

/**
 * The Heisman — a RACE until the season decides it.
 *
 * `heismanRanking` updates every week and rank 0 moves with it, so this panel
 * was crowning whoever happened to lead in October and calling it the Heisman
 * Trophy. Same fact the Journey and the Trophy Room already act on: those
 * withhold the trophy until the season's awards exist (see seasonAwardsDecided),
 * and this page saying "winner" at the same moment made the app contradict
 * itself in two places.
 *
 * The candidates still show — a Heisman race IS the story in November. Only the
 * words change: Race/Leader/Contenders while it is live, Trophy/winner/Finalists
 * once it is settled.
 */
function HeismanSection({
  dynastyId,
  seasonId,
  winner,
  finalists,
  decided,
}: {
  dynastyId: string;
  seasonId?: number;
  winner: HeismanCandidate | null;
  finalists: HeismanCandidate[];
  decided: boolean;
}) {
  const trophyPath = getAwardTrophyPath('HEISMAN');

  return (
    <SurfaceCard>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex items-center gap-5">
          {trophyPath && <img src={trophyPath} alt="" className="h-28 w-28 shrink-0 object-contain" draggable={false} />}
          <div className="min-w-0">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              {decided ? 'Heisman Trophy' : 'Heisman Race'}
            </p>
            {winner ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <PlayerNameButton
                    dynastyId={dynastyId}
                    playerId={winner.playerId}
                    seasonId={seasonId}
                    name={winner.playerName}
                    position={winner.position}
                    teamDisplayName={winner.teamDisplayName}
                    className="block truncate font-display text-page-title font-bold text-slate-950 dark:text-white"
                    showPortrait
                    portraitAssetName={winner.portraitAssetName}
                  />
                  {winner.isUserTeam && (
                    <span className="shrink-0 bg-[var(--team-primary)] px-2.5 py-1 type-eyebrow text-[var(--team-on-primary)]">
                      Your team
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {winner.position}
                  {!decided && <span className="text-slate-400 dark:text-slate-500"> &middot; current leader</span>}
                </p>
                <div className="mt-2">
                  <TeamLine teamName={winner.teamDisplayName} />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">No Heisman race recorded for this season yet.</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200/80 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-slate-800">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">{decided ? 'Finalists' : 'Contenders'}</p>
          {finalists.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
              {decided ? 'No finalist data available.' : 'No other candidates ranked yet.'}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {finalists.map((finalist) => (
                <div key={finalist.playerId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PlayerNameButton
                        dynastyId={dynastyId}
                        playerId={finalist.playerId}
                        seasonId={seasonId}
                        name={finalist.playerName}
                        position={finalist.position}
                        teamDisplayName={finalist.teamDisplayName}
                        className="block truncate text-sm font-semibold text-slate-900 dark:text-white"
                        showPortrait
                        portraitAssetName={finalist.portraitAssetName}
                      />
                      {finalist.isUserTeam && (
                        <span className="shrink-0 bg-[var(--team-primary)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--team-on-primary)]">
                          Your team
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{finalist.position}</p>
                  </div>
                  <TeamLine teamName={finalist.teamDisplayName} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

function AnnualAwardRow({ dynastyId, seasonId, award }: { dynastyId: string; seasonId?: number; award: LeagueAward }) {
  const imagePath = getAwardTrophyPath(award.awardType);
  return (
    <div className="flex items-center gap-4 border-b border-slate-200/70 py-4 last:border-b-0 dark:border-white/5">
      {imagePath && <img src={imagePath} alt="" className="h-14 w-14 shrink-0 object-contain" draggable={false} />}
      <div className="min-w-0 flex-1">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          {formatAwardLabel(award.awardType)}
        </p>
        {award.playerId !== null ? (
          <PlayerNameButton
            dynastyId={dynastyId}
            playerId={award.playerId}
            seasonId={seasonId}
            name={award.winnerName}
            position={award.position}
            teamDisplayName={award.teamDisplayName}
            className="mt-0.5 block truncate font-semibold text-slate-950 dark:text-white"
            showPortrait
            portraitAssetName={award.portraitAssetName}
          />
        ) : (
          <p className="mt-0.5 truncate font-semibold text-slate-950 dark:text-white">{award.winnerName}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{award.position}</span>
          <span aria-hidden="true">&middot;</span>
          <TeamLine teamName={award.teamDisplayName} />
        </div>
      </div>
      {award.isUserTeam && (
        <span className="shrink-0 self-start bg-[var(--team-primary)] px-2.5 py-1 type-eyebrow text-[var(--team-on-primary)]">
          Your team
        </span>
      )}
    </div>
  );
}

/** National Heisman + the ~22 leaguewide annual awards — deliberately no All-American/All-Conference tables here (see AllTeams.tsx) or Team Awards (a separate, app-generated dataset). */
export function AnnualAwards() {
  const { dynastyId, seasonId, awards } = useAwardsOverview();
  const ordered = useMemo(() => sortAnnualAwards(awards?.leagueAwards ?? []), [awards]);
  const wonByTeam = useMemo(() => ordered.filter((a) => a.isUserTeam), [ordered]);

  if (awards === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading awards...</p>;
  if (awards === null) return <p className="text-slate-500 dark:text-slate-400">No awards recorded for this season yet.</p>;

  return (
    <div className="space-y-6">
      <HeismanSection dynastyId={dynastyId} seasonId={seasonId} winner={awards.heismanWinner} finalists={awards.heismanFinalists} decided={awards.heismanDecided} />

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Annual Awards</h3>
          <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            Annual Awards Won by <span className="font-semibold text-slate-900 dark:text-white">{awards.teamName}</span>
            <span className="bg-[var(--team-primary)] px-2.5 py-0.5 text-xs font-semibold text-[var(--team-on-primary)]">
              {wonByTeam.length}
            </span>
          </p>
        </div>

        {ordered.length === 0 ? (
          <SurfaceCard className="mt-4 text-center text-sm text-slate-400 dark:text-slate-500">
            No award winners recorded for this season yet.
          </SurfaceCard>
        ) : (
          <SurfaceCard className="mt-4">
            <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              {ordered.map((award) => (
                <AnnualAwardRow key={award.awardType} dynastyId={dynastyId} seasonId={seasonId} award={award} />
              ))}
            </div>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
