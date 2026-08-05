import { useEffect, useMemo, useState } from 'react';
import { TeamLogo } from '../../components/common/TeamLogo';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { useCachedFetch, useCoachHubReady, useCoachResumes } from './coachData';
import { unitSnapshot } from './coachOverviewMetrics';
import { CoachingTreePanel } from './CoachingTreePanel';
import { StaffContinuity, StaffOrgChart, UnitComparison } from './CoachStaffOrg';
import type { Coach, CoachingTree, NationalTeamStatRow } from '../../../shared/types';

type StaffView = 'current' | 'tree';

/**
 * Coach Staff — "who is helping build the program, and where do they go next?".
 *
 * TWO VIEWS BEHIND ONE SWITCH (user direction 2026-08-02): the staff you have
 * now, and the coaching tree of the ones who left. They were separate
 * destinations for a day; they're the same question at two points in time, and
 * a mode switch is the app's own device for that — filled knob, team logo in
 * gold, exactly like Roster|Transfers.
 *
 * The tree is dynasty-level (a season-over-season staff diff) and ignores the
 * season selector, so it is fetched ONCE and only when the switch is first
 * thrown — opening Staff to look at this year's coordinators never pays for it.
 */
export function CoachStaff() {
  const { dynastyId, seasonId, overview, coaches, staff, userCoach, editCoach } = useCoachHubReady();
  const { seasons } = useSelectedSeason();
  const resumes = useCoachResumes();
  const cached = useCachedFetch();
  const [view, setView] = useState<StaffView>('current');
  const [national, setNational] = useState<NationalTeamStatRow[] | null>(null);
  const [priorNational, setPriorNational] = useState<NationalTeamStatRow[] | null>(null);
  const [tree, setTree] = useState<CoachingTree | null | undefined>(undefined);

  const selectedSeason = seasons.find((s) => s.id === seasonId) ?? seasons.find((s) => s.isCurrent);
  const prior = useMemo(() => {
    if (!selectedSeason) return undefined;
    return seasons
      .filter((s) => s.hasFullData && s.seasonYear < selectedSeason.seasonYear)
      .sort((a, b) => b.seasonYear - a.seasonYear)[0];
  }, [seasons, selectedSeason]);
  const priorSeasonYear = prior?.seasonYear;

  /*
    The unit numbers come from the NATIONAL table rather than the team's own
    stat snapshot, for the same reason Overview and Season do: it carries every
    team's totals, so the ranks beside each metric are a real computation over
    the league instead of a bare number. One source, three destinations, no
    chance of the three disagreeing about what the offence averaged.
  */
  useEffect(() => {
    if (!dynastyId) return;
    let cancelled = false;
    setNational(null);
    setPriorNational(null);
    cached(`national:${dynastyId}:${seasonId ?? 'current'}`, () =>
      window.api.db.getNationalTeamStats(dynastyId, seasonId),
    ).then((r) => {
      if (!cancelled) setNational(r);
    });
    if (prior) {
      cached(`national:${dynastyId}:${prior.id}`, () => window.api.db.getNationalTeamStats(dynastyId, prior.id)).then((r) => {
        if (!cancelled) setPriorNational(r);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, prior, cached]);

  const teamIndex = userCoach?.teamIndex ?? null;
  const units = unitSnapshot(national, teamIndex);
  const priorUnits = unitSnapshot(priorNational, teamIndex);

  // The org chart needs the real head coach, whoever that is — the user may BE
  // the coordinator, in which case `staff` has the head coach in it.
  const headCoach = coaches?.headCoach ?? null;
  const isHead = (c: Coach) => headCoach !== null && c.teamIndex === headCoach.teamIndex && c.position === headCoach.position;
  const allButHead = (coaches?.staff ?? []).filter((c) => !isHead(c));
  const coordinators = allButHead.filter(
    (c) => c.position === 'OffensiveCoordinator' || c.position === 'DefensiveCoordinator',
  );
  const others = allButHead.filter(
    (c) => c.position !== 'OffensiveCoordinator' && c.position !== 'DefensiveCoordinator',
  );

  // Deferred until the tree is actually asked for, then kept.
  useEffect(() => {
    if (!dynastyId || view !== 'tree' || tree !== undefined) return;
    let cancelled = false;
    window.api.db.getCoachingTree(dynastyId).then((r) => {
      if (!cancelled) setTree(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, view, tree]);

  return (
    <div className="space-y-6">
      <div className="pl-1">
        <ToggleSwitch
          value={view}
          onChange={(next) => setView(next as StaffView)}
          left={{ value: 'current', label: 'Current' }}
          right={{ value: 'tree', label: 'Tree' }}
          ariaLabel="Current staff or coaching tree"
          knob={
            <TeamLogo
              team={{ assetName: overview.teamName, label: overview.teamName }}
              size="sm"
              variant="gold"
              className="h-[35px] w-[35px]"
            />
          }
        />
      </div>

      <SurfaceCard>
        {view === 'current' ? (
          <>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">{overview.seasonYear} Coaching Staff</p>
            {staff.length === 0 && !headCoach ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No other coaches on staff this season.</p>
            ) : (
              <div className="mt-5 space-y-8">
                <StaffOrgChart
                  headCoach={headCoach}
                  coordinators={coordinators}
                  others={others}
                  teamName={overview.teamName}
                  seasonYear={overview.seasonYear}
                  resumes={resumes}
                  units={units}
                  onEdit={editCoach}
                />

                {units && (
                  <div>
                    <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">Unit comparison</p>
                    <UnitComparison units={units} prior={priorUnits} priorSeasonYear={priorSeasonYear ?? null} />
                  </div>
                )}

                <div>
                  <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">Continuity</p>
                  <StaffContinuity
                    staff={staff}
                    headCoach={headCoach}
                    resumes={resumes}
                    seasonYear={overview.seasonYear}
                  />
                </div>
              </div>
            )}
          </>
        ) : tree === undefined ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading coaching tree...</p>
        ) : tree === null ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No coaching tree available yet.</p>
        ) : (
          <CoachingTreePanel tree={tree} />
        )}
      </SurfaceCard>
    </div>
  );
}
