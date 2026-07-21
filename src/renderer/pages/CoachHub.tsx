import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoachCard, EditButton, coachKey, spaceCamelCase, type CoachResume } from '../components/common/CoachCard';
import { CoachPortrait } from '../components/common/CoachPortrait';
import { TeamLogo } from '../components/common/TeamLogo';
import { useEditorModal } from '../data/EditorModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { getBowlLogoPath, getConferenceChampionshipTrophyPath, getTrophyImagePath } from '../lib/trophyAssetMapping';
import type {
  Coach,
  CoachOverview,
  ProgramHistoryOverview,
  ScheduleOverview,
  SeasonOverview,
} from '../../shared/types';

const nationalChampionshipTrophyPath = getTrophyImagePath({
  kind: 'national-championship',
  label: 'National Champions',
  assetKey: null,
});

/** JobSecurityStatus enum -> a short career-status line for the hero. */
function jobSecurityLabel(status: string): string {
  if (status === 'HotSeat') return 'On the Hot Seat';
  if (status === 'SafeForNow') return 'Safe For Now';
  return spaceCamelCase(status);
}

function recordLine(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

/** Each staff member's own win-loss record for the seasons they've actually been on this staff, keyed by coach name across every imported season. */
function buildCoachResumeMap(
  seasons: { seasonYear: number; coaches: CoachOverview | null; schedule: ScheduleOverview | null }[],
): Map<string, CoachResume> {
  const map = new Map<string, CoachResume>();

  for (const season of seasons) {
    const wins = season.schedule?.record.wins ?? 0;
    const losses = season.schedule?.record.losses ?? 0;
    const conferenceWins = season.schedule?.conferenceRecord.wins ?? 0;
    const conferenceLosses = season.schedule?.conferenceRecord.losses ?? 0;

    for (const coach of season.coaches?.staff ?? []) {
      const key = coachKey(coach);
      const existing = map.get(key);
      if (existing) {
        existing.seasons += 1;
        existing.wins += wins;
        existing.losses += losses;
        existing.conferenceWins += conferenceWins;
        existing.conferenceLosses += conferenceLosses;
        existing.firstSeason = Math.min(existing.firstSeason, season.seasonYear);
        existing.lastSeason = Math.max(existing.lastSeason, season.seasonYear);
        if (!existing.positions.includes(coach.position)) existing.positions.push(coach.position);
      } else {
        map.set(key, {
          seasons: 1,
          wins,
          losses,
          conferenceWins,
          conferenceLosses,
          firstSeason: season.seasonYear,
          lastSeason: season.seasonYear,
          positions: [coach.position],
        });
      }
    }
  }

  return map;
}

/** JobSecurityStatus enum → a short performance evaluation for the contract card. */
function jobSecurityEvaluation(status: string): { label: string; tone: 'good' | 'ok' | 'warn' | 'bad' } {
  if (status === 'Safe') return { label: 'Exceeding expectations', tone: 'good' };
  if (status === 'SafeForNow') return { label: 'Meeting expectations', tone: 'ok' };
  if (status === 'Low') return { label: 'At risk', tone: 'warn' };
  if (status === 'HotSeat') return { label: 'Critical — on the hot seat', tone: 'bad' };
  return { label: spaceCamelCase(status), tone: 'ok' };
}

export function CoachHub() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [coaches, setCoaches] = useState<CoachOverview | null | undefined>(undefined);
  const [history, setHistory] = useState<ProgramHistoryOverview | null | undefined>(undefined);
  const [coachResumes, setCoachResumes] = useState<Map<string, CoachResume> | undefined>(undefined);
  const { openCoachEditor } = useEditorModal();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getCoaches(id, seasonId).then((result) => {
      if (!cancelled) setCoaches(result);
    });
    window.api.db.getHistory(id).then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  useEffect(() => {
    if (!id || seasons.length === 0) return;
    let cancelled = false;
    setCoachResumes(undefined);

    Promise.all(
      seasons.map(async (season) => ({
        seasonYear: season.seasonYear,
        coaches: await window.api.db.getCoaches(id, season.id),
        schedule: await window.api.db.getSchedule(id, season.id),
      })),
    ).then((results) => {
      if (!cancelled) setCoachResumes(buildCoachResumeMap(results));
    });

    return () => {
      cancelled = true;
    };
  }, [id, seasons]);

  function refreshCoaches() {
    if (!id) return;
    window.api.db.getCoaches(id, seasonId).then(setCoaches);
  }

  function editCoach(coach: Coach) {
    if (!id) return;
    openCoachEditor({
      dynastyId: id,
      teamIndex: coach.teamIndex,
      position: coach.position,
      coachLabel: `${coach.firstName} ${coach.lastName}`,
      onSaved: refreshCoaches,
    });
  }

  if (overview === undefined || coaches === undefined || history === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Coach Hub...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // The hero centers on whoever the user actually controls — Head Coach,
  // Offensive Coordinator, or Defensive Coordinator — not always the HC.
  // "Current Coaching Staff" then shows everyone else on staff, so the user
  // is never listed twice.
  const userCoach = coaches?.userCoach ?? null;
  const staff = coaches?.staff.filter((c) => !(c.teamIndex === userCoach?.teamIndex && c.position === userCoach?.position)) ?? [];
  const career = userCoach?.careerStats ?? null;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-5">
            <div className="flex items-center gap-5">
              {userCoach ? (
                <CoachPortrait coach={userCoach} size="xl" />
              ) : (
                <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="lg" />
              )}
              <div>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Coach Hub
                </p>
                <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
                  {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}
                </h2>
                {userCoach && (
                  <p className="mt-2 text-sm font-semibold text-[var(--team-primary)]">
                    {spaceCamelCase(userCoach.position)}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {overview.teamName}
                  {userCoach ? ` — ${userCoach.seasonsWithTeam} ${userCoach.seasonsWithTeam === 1 ? 'year' : 'years'} with the program` : ''}
                </p>
                {userCoach && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {jobSecurityLabel(userCoach.currentJobSecurityStatus)}
                    {career && career.timesFired > 0
                      ? ` — fired ${career.timesFired} time${career.timesFired === 1 ? '' : 's'} previously`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {userCoach && (
        <SurfaceCard>
          <div className="flex items-center justify-between gap-4">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Coach Profile
            </p>
            <EditButton onClick={() => editCoach(userCoach)} label={`Edit ${userCoach.firstName} ${userCoach.lastName}`} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Age" value={String(userCoach.age)} />
            <StatTile label="Alma mater" value={userCoach.almaMaterName ?? 'Unknown'} />
            <StatTile label="Years coaching" value={String(userCoach.yearsCoaching)} />
            <StatTile label="Current position" value={spaceCamelCase(userCoach.position)} />
          </div>
        </SurfaceCard>
      )}

      {userCoach && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Contract</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {overview.teamName} — {spaceCamelCase(userCoach.position)}
          </h3>
          {(() => {
            const evalResult = jobSecurityEvaluation(userCoach.currentJobSecurityStatus);
            const toneClass =
              evalResult.tone === 'good'
                ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : evalResult.tone === 'warn'
                  ? 'border-amber-300/70 bg-amber-100/70 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                  : evalResult.tone === 'bad'
                    ? 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-slate-300/70 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300';
            const yearOf =
              userCoach.contractLength > 0
                ? Math.min(userCoach.contractLength, Math.max(1, userCoach.contractLength - userCoach.contractYearsRemaining + 1))
                : 0;
            return (
              <>
                <div className="mt-3 inline-flex items-center gap-2">
                  <span className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
                    {evalResult.label}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatTile
                    label="Contract year"
                    value={userCoach.contractLength > 0 ? `${yearOf} of ${userCoach.contractLength}` : 'Not available'}
                  />
                  <StatTile
                    label="Years remaining"
                    value={userCoach.contractLength > 0 ? String(userCoach.contractYearsRemaining) : '—'}
                  />
                  <StatTile
                    label="Contract length"
                    value={userCoach.contractLength > 0 ? `${userCoach.contractLength} yr${userCoach.contractLength === 1 ? '' : 's'}` : '—'}
                  />
                  <StatTile label="Job security" value={jobSecurityLabel(userCoach.currentJobSecurityStatus)} />
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  Contract terms are read straight from the save. AD-goal expectations and per-goal milestones aren&apos;t
                  exposed as readable targets in the save data, so the job-security status above is the game&apos;s own
                  standing evaluation of the coach.
                </p>
              </>
            );
          })()}
        </SurfaceCard>
      )}

      {userCoach && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Career Record
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            This coach&apos;s lifetime record, tracked by the save itself — may predate this dynasty.
          </p>
          {career ? (
            <>
              <div className="mt-4 overflow-hidden rounded-xl bg-[var(--team-primary)] p-5 text-[var(--team-on-primary)]">
                <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
                <p className="mt-2 type-stat-lg">
                  {recordLine(career.wins, career.losses)}
                </p>
                <p className="mt-1 text-sm opacity-80">
                  At {overview.teamName}: {recordLine(career.winsAtCurrentSchool, career.lossesAtCurrentSchool)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <StatTile label="Bowl record" value={recordLine(career.bowlWins, career.bowlLosses)} />
                <StatTile label="Conf. titles" value={recordLine(career.confChampWins, career.confChampLosses)} />
                <StatTile label="National titles" value={String(career.ncWins)} />
                <StatTile label="Playoff record" value={recordLine(career.playoffWins, career.playoffLosses)} />
                <StatTile label="Rivalry record" value={recordLine(career.rivalWins, career.rivalLosses)} />
                <StatTile label="Top 25 record" value={recordLine(career.top25Wins, career.top25Losses)} />
                <StatTile label="Draft picks" value={String(career.draftPicks)} />
                <StatTile label="1st round picks" value={String(career.firstRoundDraftPicks)} />
                <StatTile label="Top-5 recruit classes" value={String(career.top5RecruitClasses)} />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No career record available for this coach.</p>
          )}
        </SurfaceCard>
      )}

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Current Coaching Staff
        </p>
        {staff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No other coaches on staff this season.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((coach, index) => (
              <CoachCard
                key={`${coach.position}-${index}`}
                coach={coach}
                resume={coachResumes?.get(coachKey(coach)) ?? null}
                onEdit={() => editCoach(coach)}
              />
            ))}
          </div>
        )}
      </SurfaceCard>

      {history && history.seasons.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Previous Seasons
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Timeline
          </h3>
          <ul className="mt-4 space-y-2">
            {history.seasons.map((season) => {
              const bowlLogoPath = season.bowlAppearance ? getBowlLogoPath(season.bowlAssetName) : null;
              const confTrophyPath = season.conferenceChampion && season.conferenceChampionName
                ? getConferenceChampionshipTrophyPath(season.conferenceChampionName)
                : null;
              return (
                <li
                  key={season.seasonYear}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {season.seasonYear} — {season.teamName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {season.headCoachName ?? 'Unknown coach'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {season.nationalChampion && nationalChampionshipTrophyPath && (
                        <img
                          src={nationalChampionshipTrophyPath}
                          alt="National champions"
                          title="National champions"
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {confTrophyPath && (
                        <img
                          src={confTrophyPath}
                          alt={`${season.conferenceChampionName} champions`}
                          title={`${season.conferenceChampionName} champions`}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {bowlLogoPath && (
                        <img
                          src={bowlLogoPath}
                          alt={season.bowlAppearance ?? 'Bowl appearance'}
                          title={season.postseasonSummary ?? season.bowlAppearance ?? undefined}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                    </div>
                    <span className="proportional-nums font-semibold text-slate-700 dark:text-slate-200">
                      {recordLine(season.wins, season.losses)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </SurfaceCard>
      )}
    </div>
  );
}
