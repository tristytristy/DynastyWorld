import type { MouseEvent as ReactMouseEvent } from 'react';
import { CoachPortrait } from './CoachPortrait';
import type { Coach } from '../../../shared/types';
import { EditIcon } from './ActionIcons';

/** Shared 6×6 pencil icon-button. `onClick` receives the mouse event so call sites inside clickable rows can stopPropagation. */
export function EditButton({
  onClick,
  label,
}: {
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300/80 bg-white/90 text-slate-500 transition hover:border-[var(--team-primary)] hover:text-[var(--team-accent-text)] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400"
    >
      <EditIcon className="h-3.5 w-3.5" />
    </button>
  );
}

/** "OffensiveCoordinator" -> "Offensive Coordinator", "HotSeat" -> "Hot Seat" — camelCase spaced, same convention as formatArchetype in extract-roster.ts. */
export function spaceCamelCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export type CoachResume = {
  seasons: number;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  firstSeason: number;
  lastSeason: number;
  /** Every imported season this coach was on this staff. */
  staffYears: number[];
  /** Their estimated first year at this school — the anchor the tenure line counts from (see tenureYearFor). */
  firstYearWithTeam: number | null;
  positions: string[];
};

/**
 * The season's per-game yards and points on each side of the ball. A
 * coordinator's card shows THEIR side of it (see below) — a conference record is
 * the head coach's number, and it told you nothing about the person whose job is
 * the offence.
 */
export type UnitStats = {
  offenseYardsPerGame: number | null;
  pointsPerGame: number | null;
  defenseYardsPerGame: number | null;
  pointsAgainstPerGame: number | null;
};

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th"… */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function perGame(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}/g`;
}

export function coachKey(coach: Pick<Coach, 'firstName' | 'lastName'>): string {
  return `${coach.firstName} ${coach.lastName}`.trim().toLowerCase();
}

export function CoachCard({
  coach,
  resume,
  onEdit,
  teamName,
  tenureYear,
  unitStats,
}: {
  coach: Coach;
  resume: CoachResume | null;
  onEdit: () => void;
  /** The school they're on staff at — the tenure line reads "3rd year with Auburn". */
  teamName?: string | null;
  /**
   * Which year of their run this is, for the season being viewed — counted by
   * the app (see tenureYearFor in CoachHub). The card can't work it out itself:
   * `coach.seasonsWithTeam` is the save's frozen counter, and it doesn't move
   * from one season to the next.
   */
  tenureYear?: number;
  /** This season's team per-game numbers; the card picks the pair that belongs to the coach's side of the ball. */
  unitStats?: UnitStats | null;
}) {
  // A coordinator is shown their own unit's per-game yards and points. Anyone
  // else (a head coach on a browsed staff, an analyst) keeps the record pair —
  // there's no single unit that belongs to them.
  // Driven by the POSITION, not by whether the numbers exist yet: a coordinator
  // in week 0 shows "Off. yards —", not a conference record. Falling back to the
  // old pair would put the head coach's number back on their card exactly when
  // the season hasn't given them one of their own.
  const isOffense = coach.position === 'OffensiveCoordinator';
  const isDefense = coach.position === 'DefensiveCoordinator';
  const unitPair = isOffense
    ? [
        { label: 'Off. yards', value: perGame(unitStats?.offenseYardsPerGame ?? null) },
        { label: 'Points', value: perGame(unitStats?.pointsPerGame ?? null) },
      ]
    : isDefense
      ? [
          { label: 'Yards allowed', value: perGame(unitStats?.defenseYardsPerGame ?? null) },
          { label: 'Points allowed', value: perGame(unitStats?.pointsAgainstPerGame ?? null) },
        ]
      : null;

  return (
    /*
      No drop shadow. The old `0 20px 70px -44px` bloom was invisible on the
      light theme it was designed for and, on the black ground, read as a grey
      smudge sitting BEHIND the card — an element the user could see but not
      identify. The border carries the edge on its own, which is how every other
      surface in the app already works.
    */
    <div className="flex h-full flex-col gap-3 rounded-xl border border-white/65 bg-white/76 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CoachPortrait coach={coach} size="md" />
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-slate-950 dark:text-white">
              <EditButton onClick={onEdit} label={`Edit ${coach.firstName} ${coach.lastName}`} />
              {coach.firstName} {coach.lastName}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {spaceCamelCase(coach.position)}
            </p>
            {/* Tenure sits with the identity, under the role — the same shape
                the head coach's masthead uses (role, then "Nth year with X").
                It was buried in the record block below, where it read as a
                statistic rather than as who this person is. */}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {ordinal(tenureYear ?? coach.seasonsWithTeam + 1)} year{teamName ? ` with ${teamName}` : ''}
            </p>
          </div>
        </div>
        <span className="border border-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {coach.yearsCoaching} {coach.yearsCoaching === 1 ? 'yr' : 'yrs'}
        </span>
      </div>
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Alma Mater
        </p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          {coach.almaMaterName ?? 'Unknown'}
        </p>
      </div>
      {resume && (
        <div className="mt-auto rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
          <p className="font-semibold text-slate-900 dark:text-white">
            {resume.wins}-{resume.losses}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
            {unitPair ? (
              unitPair.map((stat) => (
                <span key={stat.label}>
                  {stat.label}: {stat.value}
                </span>
              ))
            ) : (
              <>
                <span>Conf: {resume.conferenceWins}-{resume.conferenceLosses}</span>
                <span>
                  Range: {resume.firstSeason}
                  {resume.firstSeason === resume.lastSeason ? '' : `-${resume.lastSeason}`}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
