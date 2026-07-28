import { useEffect, useState } from 'react';
import { ScandalsModal } from '../components/common/ScandalsModal';
import { Link, useParams } from 'react-router-dom';
import { CoachCard, EditButton, coachKey, spaceCamelCase, type CoachResume } from '../components/common/CoachCard';
import { CoachPortrait } from '../components/common/CoachPortrait';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamLink } from '../components/common/TeamLink';
import { useEditorModal } from '../data/EditorModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { getBowlLogoPath, getConferenceChampionshipTrophyPath, getTrophyImagePath } from '../lib/trophyAssetMapping';
import type {
  Coach,
  CoachingTree,
  CoachOverview,
  ProgramHistoryOverview,
  ScheduleOverview,
  SeasonOverview,
} from '../../shared/types';

/** "'26" / "'26–'28" for a coach's tenure span. */
function yearsSpan(a: number, b: number): string {
  const y = (n: number) => `'${String(n).slice(-2)}`;
  return a === b ? y(a) : `${y(a)}–${y(b)}`;
}

/** The coaching-tree branches — where your former staffers went, head-coach promotions first. */
function CoachingTreeSection({ tree }: { tree: CoachingTree }) {
  if (tree.entries.length === 0) {
    return (
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Where your people go</h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          As assistants leave your staff for jobs elsewhere, they&apos;ll branch out here — with the role they held under
          you and where they landed. Sync each season and your tree grows.
        </p>
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Where your people went
          </h3>
        </div>
        <div className="flex gap-3">
          <StatTile label="Coaches produced" value={String(tree.coachesProduced)} />
          <StatTile label="Now head coaches" value={String(tree.headCoachesProduced)} />
        </div>
      </div>

      {/* Root node — you */}
      {tree.rootCoachName && (
        <div className="mt-4 inline-flex items-center gap-2 border border-[var(--team-primary)]/50 bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)] px-3 py-1.5">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{tree.rootCoachName}</span>
          {tree.rootTeamName && <span className="text-xs text-slate-500 dark:text-slate-400">· {tree.rootTeamName}</span>}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {tree.entries.map((e) => (
          <div
            key={e.presentationId}
            className={`flex flex-col gap-3 border-l-[3px] bg-slate-50/70 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between ${
              e.isHeadCoachNow
                ? 'border-l-amber-400 border-y border-r border-y-amber-300/40 border-r-amber-300/40 dark:border-y-amber-500/25 dark:border-r-amber-500/25'
                : 'border-l-[var(--team-primary)]/60 border-y border-r border-y-slate-200/70 border-r-slate-200/70 dark:border-y-slate-800 dark:border-r-slate-800'
            }`}
          >
            {/* Left: the coach + role under you */}
            <div className="flex min-w-0 items-center gap-3">
              <CoachPortrait
                coach={{ firstName: e.name.split(' ')[0] ?? '', lastName: e.name.split(' ').slice(1).join(' '), portraitAssetName: e.portraitAssetName }}
                size="sm"
                className="!h-10 !w-10 shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{e.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  Your {e.positionsUnderYou.map(spaceCamelCase).join(' / ')} · {yearsSpan(e.firstYearWithYou, e.lastYearWithYou)}
                </p>
              </div>
            </div>

            {/* Right: where they are now */}
            <div className="flex items-center gap-2.5 sm:justify-end">
              <span className="hidden text-slate-300 dark:text-slate-600 sm:inline" aria-hidden="true">→</span>
              {e.nowTeamName && (
                <TeamLogo team={{ assetName: e.nowTeamName, label: e.nowTeamName }} size="sm" className="!h-6 !w-6 shrink-0" />
              )}
              <div className="min-w-0 text-left sm:text-right">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white sm:justify-end">
                  {e.isHeadCoachNow && (
                    <span className="border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Head Coach
                    </span>
                  )}
                  <TeamLink teamIndex={e.nowTeamIndex ?? undefined} teamName={e.nowTeamName ?? 'Unknown'} nameClassName="truncate" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {e.nowPosition ? spaceCamelCase(e.nowPosition) : 'Coach'}
                  {e.nowSeasonYear ? ` · as of ${e.nowSeasonYear}` : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

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

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st"… */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
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
  const [scandalsOpen, setScandalsOpen] = useState(false);
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [coaches, setCoaches] = useState<CoachOverview | null | undefined>(undefined);
  const [history, setHistory] = useState<ProgramHistoryOverview | null | undefined>(undefined);
  const [coachResumes, setCoachResumes] = useState<Map<string, CoachResume> | undefined>(undefined);
  // The user coach's own position each synced season — the piece the program
  // timeline lacks, and what turns it into a career résumé (following the coach
  // across school changes, HC/OC/DC year to year).
  const [userPositionByYear, setUserPositionByYear] = useState<Map<number, string>>(new Map());
  const [coachingTree, setCoachingTree] = useState<CoachingTree | null>(null);
  const { openCoachEditor } = useEditorModal();

  // The coaching tree is dynasty-level (season-over-season staff diff), not per-season.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getCoachingTree(id).then((t) => {
      if (!cancelled) setCoachingTree(t);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      if (cancelled) return;
      setCoachResumes(buildCoachResumeMap(results));
      setUserPositionByYear(
        new Map(
          results
            .filter((r) => r.coaches?.userCoach)
            .map((r) => [r.seasonYear, r.coaches!.userCoach!.position] as const),
        ),
      );
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
        {/* Stretch rather than center, so the Scandals button can sit on the
            masthead's bottom edge instead of floating beside the name. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-5">
            <div className="flex items-center gap-5">
              {userCoach ? (
                <CoachPortrait coach={userCoach} teamAssetName={overview.teamName} size="xl" />
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
                  <p className="mt-2 text-sm font-semibold text-[var(--team-accent-text)]">
                    {spaceCamelCase(userCoach.position)}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {userCoach
                    ? `${ordinal(userCoach.seasonsWithTeam + 1)} year as ${spaceCamelCase(userCoach.position)} with ${overview.teamName}`
                    : overview.teamName}
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

          {/* User coaches only — Scandals writes to the save, and there's
              nothing to cheat on behalf of a CPU staff. */}
          {userCoach && id && (
            <div className="flex shrink-0 items-end">
              <button
                type="button"
                onClick={() => setScandalsOpen(true)}
                title="Off-the-books adjustments — writes to your save"
                className="corner-cut-sm border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 dark:border-red-500/40 dark:text-red-300"
              >
                Scandals
              </button>
            </div>
          )}
        </div>
      </SurfaceCard>

      {id && <ScandalsModal open={scandalsOpen} onClose={() => setScandalsOpen(false)} dynastyId={id} />}

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
                <StatTile label="Players developed to max" value={String(career.playersMaxProgressed)} />
                <StatTile label="Prestige gains" value={String(career.numPrestigeIncreases)} />
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
            Career Résumé
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}&apos;s coaching journey
          </h3>
          {(() => {
            const rs = history.seasons;
            const schools = [...new Map(rs.map((s) => [s.teamName, s.teamName])).keys()];
            const trackedWins = rs.reduce((sum, s) => sum + s.wins, 0);
            const trackedLosses = rs.reduce((sum, s) => sum + s.losses, 0);
            const natTitles = rs.filter((s) => s.nationalChampion).length;
            const confTitles = rs.filter((s) => s.conferenceChampion).length;
            return (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Seasons tracked" value={String(rs.length)} />
                  <StatTile label="Tracked record" value={recordLine(trackedWins, trackedLosses)} />
                  <StatTile label="National titles" value={String(natTitles)} />
                  <StatTile label="Conf. titles" value={String(confTitles)} />
                </div>
                {schools.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {schools.length === 1 ? 'School' : `${schools.length} schools`}:
                    </span>
                    {schools.map((school) => (
                      <span
                        key={school}
                        className="inline-flex items-center gap-1.5 border border-slate-200/80 bg-slate-50/85 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
                      >
                        <TeamLogo team={{ assetName: school, label: school }} size="sm" className="!h-4 !w-4" />
                        {school}
                      </span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
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
                        {(() => {
                          const pos = userPositionByYear.get(season.seasonYear);
                          if (!pos) return season.headCoachName ?? 'Unknown coach';
                          // If the user WAS the head coach, "HC: <self>" is redundant.
                          const showHc = pos !== 'HeadCoach' && season.headCoachName;
                          return `${spaceCamelCase(pos)}${showHc ? ` · HC: ${season.headCoachName}` : ''}`;
                        })()}
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

      {coachingTree && <CoachingTreeSection tree={coachingTree} />}
    </div>
  );
}
