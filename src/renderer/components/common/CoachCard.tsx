import type { MouseEvent as ReactMouseEvent } from 'react';
import { CoachPortrait } from './CoachPortrait';
import type { Coach } from '../../../shared/types';

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M13.5 3.5a1.5 1.5 0 0 1 2.12 2.12l-8.5 8.5-3 .88.88-3 8.5-8.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-slate-300/80 bg-white/90 text-slate-500 transition hover:border-[var(--team-primary)] hover:text-[var(--team-primary)] dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400"
    >
      <EditIcon />
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
  positions: string[];
};

export function coachKey(coach: Pick<Coach, 'firstName' | 'lastName'>): string {
  return `${coach.firstName} ${coach.lastName}`.trim().toLowerCase();
}

export function CoachCard({ coach, resume, onEdit }: { coach: Coach; resume: CoachResume | null; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/65 bg-white/76 p-5 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.38)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
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
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Imported Resume
          </p>
          <p className="mt-2 font-semibold text-slate-900 dark:text-white">
            {resume.wins}-{resume.losses}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {resume.seasons} imported season{resume.seasons === 1 ? '' : 's'} on staff
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Conf: {resume.conferenceWins}-{resume.conferenceLosses}</span>
            <span>
              Range: {resume.firstSeason}
              {resume.firstSeason === resume.lastSeason ? '' : `-${resume.lastSeason}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
