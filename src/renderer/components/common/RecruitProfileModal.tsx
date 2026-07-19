import { useEffect, useRef } from 'react';
import { useRecruitModal } from '../../data/RecruitModalProvider';
import { useEditorModal } from '../../data/EditorModalProvider';
import { TeamLogo } from './TeamLogo';
import { PlayerPortrait } from './PlayerPortrait';
import { EditButton } from './CoachCard';
import type { RecruitBoardEntry, RecruitBoardStage } from '../../../shared/types';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const STAGE_LABEL: Record<RecruitBoardStage, string> = {
  watching: 'Watching',
  offered: 'Offered',
  committed: 'Committed',
  signed: 'Signed',
  lost: 'Signed elsewhere',
};

const STAGE_DETAIL: Record<RecruitBoardStage, string> = {
  watching: 'On the board, no offer yet.',
  offered: 'This program has offered a scholarship.',
  committed: 'Committed to this program, not yet signing-day official.',
  signed: 'Locked in for this recruiting class.',
  lost: 'Signed with another school.',
};

function formatClassYear(raw: string): string {
  if (raw === 'HighSchool') return 'High school';
  if (raw.startsWith('JuniorCollege_')) return `Junior college (${raw.replace('JuniorCollege_', '')})`;
  return raw;
}

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

function Stars({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-sm text-slate-400 dark:text-slate-500">Unrated</span>;
  }
  return (
    <span className="text-lg text-amber-500 dark:text-amber-400" aria-label={`${count} star recruit`}>
      {'★'.repeat(count)}
      <span className="text-slate-300 dark:text-slate-700">{'★'.repeat(5 - count)}</span>
    </span>
  );
}

function BioTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function RankTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 text-center dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value > 0 ? `#${value}` : 'NR'}</p>
    </div>
  );
}

function RecruitModalContent({
  recruit,
  dynastyId,
  canEdit,
}: {
  recruit: RecruitBoardEntry;
  dynastyId: string | null;
  canEdit: boolean;
}) {
  const { openPlayerEditor } = useEditorModal();
  const showSignedSchool = (recruit.stage === 'signed' || recruit.stage === 'lost') && recruit.signedTeamDisplayName;
  const recruitLabel = `${recruit.firstName} ${recruit.lastName}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative shrink-0">
            <PlayerPortrait player={recruit} size="lg" />
          </div>
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              {recruit.position} recruit
            </p>
            <h2 className="mt-2 flex items-center justify-center gap-2 font-display text-page-title font-bold text-slate-950 dark:text-white sm:justify-start">
              {recruit.firstName} {recruit.lastName}
              {recruit.isFavorite && (
                <span className="text-amber-500 dark:text-amber-400" title="Favorite" aria-label="Favorite">
                  &#9733;
                </span>
              )}
              {canEdit && dynastyId && (
                <EditButton
                  onClick={() =>
                    openPlayerEditor({
                      dynastyId,
                      playerId: recruit.playerId,
                      playerLabel: recruitLabel,
                      isRecruit: true,
                    })
                  }
                  label={`Edit ${recruitLabel}`}
                />
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {recruit.hometown}, {recruit.homeState} | {formatClassYear(recruit.classYear)}
            </p>
            <div className="mt-3 flex justify-center sm:justify-start">
              <Stars count={recruit.stars} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 px-5 py-4 dark:border-slate-800 dark:bg-white/5">
          <p className="text-right type-eyebrow text-slate-400 dark:text-slate-500">
            Overall
          </p>
          <p className="mt-2 flex items-center justify-center type-stat-lg text-slate-950 dark:text-white">
            {recruit.overallRating}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <RankTile label="National Rank" value={recruit.nationalRank} />
        <RankTile label="Position Rank" value={recruit.positionRank} />
        <RankTile label="State Rank" value={recruit.stateRank} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <BioTile label="Height" value={formatHeight(recruit.heightInches)} />
        <BioTile label="Weight" value={`${recruit.weightPounds} lb`} />
        <BioTile label="Player style" value={recruit.archetype} />
        <BioTile label="Development trait" value={recruit.developmentTrait} />
        <BioTile label="Hometown" value={`${recruit.hometown}, ${recruit.homeState}`} />
        <BioTile label="Class" value={formatClassYear(recruit.classYear)} />
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-5 dark:border-slate-800 dark:bg-white/5">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Status</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-slate-950 dark:text-white">{STAGE_LABEL[recruit.stage]}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{STAGE_DETAIL[recruit.stage]}</p>
            {recruit.committedWeekNumber > 0 && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Committed week {recruit.committedWeekNumber}</p>
            )}
          </div>
          {showSignedSchool && recruit.signedTeamDisplayName && (
            <div className="flex shrink-0 flex-col items-center gap-2">
              <TeamLogo
                team={{ assetName: recruit.signedTeamDisplayName, label: recruit.signedTeamDisplayName }}
                size="lg"
                variant={recruit.stage === 'signed' ? 'gold' : undefined}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{recruit.signedTeamDisplayName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Global recruit-profile modal, mirroring PlayerProfileModal's shell (backdrop
 * blur, focus trap, Escape/close, mounted at the app root) but with simpler
 * data flow — the recruiting board already holds the full RecruitBoardEntry,
 * so there's no fetch here, just presentation.
 */
export function RecruitProfileModal() {
  const { recruit, dynastyId, canEdit, closeRecruitModal } = useRecruitModal();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const isOpen = recruit !== null;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRecruitModal();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen, closeRecruitModal]);

  if (!recruit) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRecruitModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recruit profile"
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-[0_60px_160px_-40px_rgba(2,6,23,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-end gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeRecruitModal}
            aria-label="Close recruit profile"
            className="border border-slate-300/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <RecruitModalContent recruit={recruit} dynastyId={dynastyId} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}
