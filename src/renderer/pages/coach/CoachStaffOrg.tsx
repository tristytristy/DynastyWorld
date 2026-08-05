import { CoachPortrait } from '../../components/common/CoachPortrait';
import { EditButton, coachKey, spaceCamelCase, type CoachResume } from '../../components/common/CoachCard';
import { ordinal, recordLine, tenureYearFor } from './coachMetrics';
import type { UnitSnapshot } from './coachOverviewMetrics';
import type { Coach } from '../../../shared/types';

/**
 * Staff as an ORGANISATION, not a grid of cards.
 *
 * The head coach sits above and the coordinators hang off him on a spine, which
 * is the one thing a generic three-column grid cannot say: that these people
 * report to someone, and that each coordinator owns one side of the ball. The
 * connectors are borders, not SVG — a vertical line and two elbows is exactly
 * what a border can draw.
 *
 * The whole staff still comes from the same `resumes` map every other
 * destination uses, so tenure and staff records are computed once and cannot
 * disagree between here and the tree or the hero.
 */
export function StaffOrgChart({
  headCoach,
  coordinators,
  others,
  teamName,
  seasonYear,
  resumes,
  units,
  onEdit,
}: {
  headCoach: Coach | null;
  coordinators: Coach[];
  others: Coach[];
  teamName: string;
  seasonYear: number;
  resumes: Map<string, CoachResume> | undefined;
  units: UnitSnapshot | null;
  onEdit: (coach: Coach) => void;
}) {
  const offense = coordinators.find((c) => c.position === 'OffensiveCoordinator') ?? null;
  const defense = coordinators.find((c) => c.position === 'DefensiveCoordinator') ?? null;

  return (
    <div className="flex flex-col items-center">
      {headCoach && (
        <OrgCard
          coach={headCoach}
          teamName={teamName}
          seasonYear={seasonYear}
          resume={resumes?.get(coachKey(headCoach)) ?? null}
          onEdit={() => onEdit(headCoach)}
          emphasis
        />
      )}

      {(offense || defense) && (
        <>
          {/* The spine. A border, not a graphic. */}
          <span className="h-6 w-px bg-[color:var(--section-divider)]" aria-hidden="true" />
          <div className="grid w-full gap-4 md:grid-cols-2">
            {[offense, defense].map((coach, i) =>
              coach ? (
                <div key={coach.position} className="flex flex-col items-center">
                  <span
                    className={`hidden h-6 w-px bg-[color:var(--section-divider)] md:block`}
                    aria-hidden="true"
                  />
                  <OrgCard
                    coach={coach}
                    teamName={teamName}
                    seasonYear={seasonYear}
                    resume={resumes?.get(coachKey(coach)) ?? null}
                    onEdit={() => onEdit(coach)}
                    unitLabel={i === 0 ? 'Offense' : 'Defense'}
                    unitValue={
                      units ? (i === 0 ? units.pointsPerGame : units.pointsAllowedPerGame).toFixed(1) : null
                    }
                    unitCaption={i === 0 ? 'points per game' : 'points allowed per game'}
                  />
                </div>
              ) : (
                <div key={`empty-${i}`} className="flex flex-col items-center">
                  <span className="hidden h-6 w-px bg-[color:var(--section-divider)] md:block" aria-hidden="true" />
                  <div className="corner-cut-sm flex w-full items-center justify-center border border-dashed border-slate-300/70 p-6 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                    No {i === 0 ? 'offensive' : 'defensive'} coordinator on staff
                  </div>
                </div>
              ),
            )}
          </div>
        </>
      )}

      {others.length > 0 && (
        <div className="mt-6 w-full">
          <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">Rest of staff</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((coach, i) => (
              <OrgCard
                key={`${coach.position}-${i}`}
                coach={coach}
                teamName={teamName}
                seasonYear={seasonYear}
                resume={resumes?.get(coachKey(coach)) ?? null}
                onEdit={() => onEdit(coach)}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrgCard({
  coach,
  teamName,
  seasonYear,
  resume,
  onEdit,
  emphasis = false,
  compact = false,
  unitLabel,
  unitValue,
  unitCaption,
}: {
  coach: Coach;
  teamName: string;
  seasonYear: number;
  resume: CoachResume | null;
  onEdit: () => void;
  emphasis?: boolean;
  compact?: boolean;
  unitLabel?: string;
  unitValue?: string | null;
  unitCaption?: string;
}) {
  const tenure = tenureYearFor(resume, seasonYear, coach.seasonsWithTeam);
  return (
    <div
      className={`corner-cut-sm w-full border bg-slate-50/85 p-4 dark:bg-white/5 ${
        emphasis
          ? 'border-[var(--team-primary)]/50 md:max-w-md'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <CoachPortrait
          coach={coach}
          teamAssetName={teamName}
          size={compact ? 'sm' : 'md'}
          className={compact ? '!h-10 !w-10' : ''}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold text-slate-950 dark:text-white">
            {coach.firstName} {coach.lastName}
          </p>
          <p className="truncate text-xs font-semibold text-[var(--team-accent-text)]">
            {spaceCamelCase(coach.position)}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {ordinal(tenure)} year here · {coach.yearsCoaching} yr coaching
          </p>
          {!compact && coach.almaMaterName && (
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{coach.almaMaterName}</p>
          )}
          {/* Their record for the seasons they have actually been on this staff —
              not the team's whole history, and not a career figure the save
              can't be trusted for. */}
          {resume && resume.seasons > 0 && (
            <p className="tnum mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {recordLine(resume.wins, resume.losses)}
              <span className="font-normal text-slate-400 dark:text-slate-500">
                {' '}
                on this staff ({resume.seasons} {resume.seasons === 1 ? 'season' : 'seasons'})
              </span>
            </p>
          )}
        </div>
        <EditButton onClick={onEdit} label={`Edit ${coach.firstName} ${coach.lastName}`} />
      </div>

      {unitLabel && unitValue && (
        <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--section-divider)] pt-3">
          <span className="type-eyebrow text-slate-400 dark:text-slate-500">{unitLabel}</span>
          <span className="text-right">
            <span className="tnum font-display text-xl font-bold text-slate-950 dark:text-white">{unitValue}</span>
            <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {unitCaption}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * ONE comparison surface for both units, which is what the spec asks for and
 * what stops offence and defence being argued from different tables.
 *
 * DIRECTION IS PER ROW, not per sign: conceding fewer points is an improvement
 * even though the number fell. Each row declares which way is better rather than
 * the table assuming more is good.
 */
export function UnitComparison({
  units,
  prior,
  priorSeasonYear,
}: {
  units: UnitSnapshot;
  prior: UnitSnapshot | null;
  priorSeasonYear: number | null;
}) {
  const rows: { label: string; now: number; was: number | null; higherIsBetter: boolean; rank: number | null }[] = [
    { label: 'Points / game', now: units.pointsPerGame, was: prior?.pointsPerGame ?? null, higherIsBetter: true, rank: units.pointsRank },
    { label: 'Yards / game', now: units.yardsPerGame, was: prior?.yardsPerGame ?? null, higherIsBetter: true, rank: units.yardsRank },
    { label: 'Points allowed / game', now: units.pointsAllowedPerGame, was: prior?.pointsAllowedPerGame ?? null, higherIsBetter: false, rank: units.pointsAllowedRank },
    { label: 'Yards allowed / game', now: units.yardsAllowedPerGame, was: prior?.yardsAllowedPerGame ?? null, higherIsBetter: false, rank: units.yardsAllowedRank },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="border-b border-[color:var(--section-divider)]">
            <th className="type-eyebrow py-2 text-left text-slate-400 dark:text-slate-500">Unit metric</th>
            <th className="type-eyebrow py-2 text-right text-slate-400 dark:text-slate-500">Current</th>
            <th className="type-eyebrow py-2 text-right text-slate-400 dark:text-slate-500">
              {priorSeasonYear ?? 'Previous'}
            </th>
            <th className="type-eyebrow py-2 text-right text-slate-400 dark:text-slate-500">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const delta = row.was === null ? null : Math.round((row.now - row.was) * 10) / 10;
            const improved = delta === null || delta === 0 ? null : row.higherIsBetter ? delta > 0 : delta < 0;
            return (
              <tr key={row.label} className="border-b border-[color:var(--section-divider)] last:border-0">
                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                  {row.label}
                  {row.rank !== null && (
                    <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500">#{row.rank}</span>
                  )}
                </td>
                <td className="tnum py-2.5 text-right font-semibold text-slate-950 dark:text-white">
                  {row.now.toFixed(1)}
                </td>
                <td className="tnum py-2.5 text-right text-slate-500 dark:text-slate-400">
                  {row.was === null ? '—' : row.was.toFixed(1)}
                </td>
                <td
                  className={`tnum py-2.5 text-right font-semibold ${
                    delta === null || delta === 0
                      ? 'text-slate-400 dark:text-slate-500'
                      : improved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Staff continuity — the facts that only exist because the app has watched
 * several seasons: how long this group has been together, who has been here
 * longest, and what they have done as a unit.
 */
export function StaffContinuity({
  staff,
  headCoach,
  resumes,
  seasonYear,
}: {
  staff: Coach[];
  headCoach: Coach | null;
  resumes: Map<string, CoachResume> | undefined;
  seasonYear: number;
}) {
  const everyone = headCoach ? [headCoach, ...staff] : staff;
  const withResumes = everyone
    .map((c) => ({ coach: c, resume: resumes?.get(coachKey(c)) ?? null }))
    .filter((e) => e.resume !== null) as { coach: Coach; resume: CoachResume }[];

  if (withResumes.length === 0) return null;

  // Seasons this exact group has been together: the years every one of them
  // appears in. An intersection, not a maximum — one new hire resets it, which
  // is the honest answer to "how long have THESE people been together".
  const shared = withResumes.reduce<number[]>((acc, e, i) => {
    const years = e.resume.staffYears;
    return i === 0 ? [...years] : acc.filter((y) => years.includes(y));
  }, []);

  const longest = withResumes.reduce((a, b) => (b.resume.seasons > a.resume.seasons ? b : a));
  const combinedExperience = everyone.reduce((sum, c) => sum + c.yearsCoaching, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Fact label="Together" value={`${shared.length} ${shared.length === 1 ? 'season' : 'seasons'}`} />
      <Fact
        label="Longest serving"
        value={`${longest.coach.lastName}`}
        detail={`${longest.resume.seasons} ${longest.resume.seasons === 1 ? 'season' : 'seasons'}`}
      />
      <Fact label="Combined experience" value={`${combinedExperience} yrs`} />
      <Fact label="Staff size" value={`${everyone.length} in ${seasonYear}`} />
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="tnum mt-1.5 truncate font-display text-lg font-bold text-slate-950 dark:text-white">{value}</p>
      {detail && <p className="truncate text-xs text-slate-400 dark:text-slate-500">{detail}</p>}
    </div>
  );
}
