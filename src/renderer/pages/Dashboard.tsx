import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeamLogo } from '../components/common/TeamLogo';
import { CoachPortrait } from '../components/common/CoachPortrait';
import { FALLBACK_LOGO_PATH } from '../lib/assetMapping';
import { buildTeamColorVars } from '../lib/teamTheme';
import { angledClip } from '../components/ui/angledClip';
import { EXTRACTION_STEPS } from '../../shared/types';
import type { DynastySummary, ExtractionStep, ExtractionStepStatus } from '../../shared/types';
import { useConfirm } from '../data/ConfirmDialogProvider';

const ANGLED_PANEL = angledClip('1.1rem');

const IMPORT_BUTTON_CLASS =
  'inline-flex items-center justify-center bg-[var(--team-primary)] px-5 py-3 text-sm font-medium text-[var(--team-on-primary)] shadow-[0_20px_45px_-24px_rgba(37,99,235,0.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60';

const STEP_LABELS: Record<ExtractionStep, string> = {
  league: 'League',
  teams: 'Teams',
  coaches: 'Coaches',
  roster: 'Roster',
  schedule: 'Schedule',
  recruits: 'Recruiting',
  stats: 'Stats',
  gamelog: 'Game logs',
  trophies: 'Trophies',
  rivalries: 'Rivalries',
  awards: 'Awards',
};

type StepState = ExtractionStepStatus | 'pending';

function initialProgress(): Record<ExtractionStep, StepState> {
  return Object.fromEntries(EXTRACTION_STEPS.map((step) => [step, 'pending'])) as Record<ExtractionStep, StepState>;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M4 6h12" strokeLinecap="round" />
      <path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 6 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L14.5 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 9v5M11.5 9v5" strokeLinecap="round" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M15.5 8a5.5 5.5 0 0 0-9.7-3.3M4.5 12a5.5 5.5 0 0 0 9.7 3.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 3.5V8H11M4.5 16.5V12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackupIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M10 3v9.5M10 12.5 6.5 9M10 12.5 13.5 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13v1.5A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Export-history icon — an upward arrow leaving a tray, distinct from Backup's downward-into-tray shape. Replaces the standalone Exports page (removed); this is the one thing it did (a self-contained HTML export of the dynasty's history). */
function ExportIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <path d="M10 12.5V3M10 3 6.5 6.5M10 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13v1.5A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** DynastySummary only carries a combined display name — split it for CoachPortrait's initials fallback and alt text. */
function coachPortraitIdentity(
  coachName: string | null,
  portraitAssetName: string | null,
): { firstName: string; lastName: string; portraitAssetName: string | null } {
  const [firstName = '', ...rest] = (coachName ?? '').split(' ');
  return { firstName, lastName: rest.join(' '), portraitAssetName };
}

const CARD_ICON_BUTTON_CLASS =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300/80 bg-white/90 text-slate-600 shadow-[0_12px_30px_-14px_rgba(15,23,42,0.5)] backdrop-blur-md transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-300 dark:hover:bg-white/10';

export function Dashboard() {
  const confirm = useConfirm();
  const [dynasties, setDynasties] = useState<DynastySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [backingUpId, setBackingUpId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Record<ExtractionStep, StepState>>(initialProgress);
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api.db.getDynasties().then((result) => {
      if (!cancelled) {
        setDynasties(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Stops the click from also triggering the card's own `Link` navigation
   * (the trash button lives inside it) — same confirm-then-delete flow as
   * DynastyOverview.tsx's "Delete Dynasty" button, just reachable without
   * opening the dynasty first. Updates local state directly instead of
   * re-fetching the whole list, since we already know exactly what changed.
   */
  async function handleDelete(event: MouseEvent, dynastyId: string) {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = await confirm({
      eyebrow: 'Delete dynasty',
      title: 'Delete this dynasty?',
      message: 'This removes all imported data for this dynasty and cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    setDeletingId(dynastyId);
    await window.api.db.deleteDynasty(dynastyId);
    setDynasties((prev) => prev.filter((d) => d.id !== dynastyId));
    setDeletingId(null);
  }

  /**
   * Re-reads the save file at whatever path this dynasty is already tracked
   * under — no file picker, since we already know where it lives. The common
   * "I played more, refresh my data" action; picking a *different* file
   * (a rename/restore) is the separate checkDynastyMatch/relinkDynasty flow
   * in handleImportClick below.
   */
  async function handleSync(event: MouseEvent, dynastyId: string) {
    event.preventDefault();
    event.stopPropagation();
    setSyncingId(dynastyId);
    setStatusMessage(null);
    try {
      const result = await window.api.db.syncDynasty(dynastyId);
      setStatusMessage({ text: result.message, success: result.success });
      if (result.success) {
        const refreshed = await window.api.db.getDynasties();
        setDynasties(refreshed);
      }
    } catch {
      setStatusMessage({ text: 'Sync failed unexpectedly. Please try again.', success: false });
    } finally {
      setSyncingId(null);
    }
  }

  /** The one thing the removed standalone Exports page did — a self-contained HTML snapshot of the dynasty's history — now reachable as a per-card icon instead of its own page/nav item. */
  async function handleExportHistory(event: MouseEvent, dynastyId: string) {
    event.preventDefault();
    event.stopPropagation();
    setExportingId(dynastyId);
    setStatusMessage(null);
    const result = await window.api.export.historyToHtml(dynastyId);
    setStatusMessage({ text: result.success ? `Saved to ${result.filePath}` : result.message, success: result.success });
    setExportingId(null);
  }

  async function handleBackup(event: MouseEvent, dynastyId: string) {
    event.preventDefault();
    event.stopPropagation();
    setBackingUpId(dynastyId);
    setStatusMessage(null);
    const result = await window.api.editor.backupSaveFile(dynastyId);
    setStatusMessage({ text: result.message, success: result.success });
    setBackingUpId(null);
  }

  /**
   * Import now happens entirely on this page — no separate "setup" page to
   * navigate to first. Opens the native file picker directly; a canceled
   * pick (`filePath === null`) is a silent no-op, not an error.
   */
  async function handleImportClick() {
    if (importing) return;

    let filePath: string | null;
    try {
      filePath = await window.api.fs.selectFile();
    } catch {
      setStatusMessage({ text: 'Could not open the file browser. Please try again.', success: false });
      return;
    }
    if (!filePath) return;

    setImporting(true);
    setProgress(initialProgress());
    setStatusMessage(null);

    // Dynasties are matched by exact save-file path — a save renamed, moved,
    // or restored from backup between seasons would otherwise silently
    // create a second, unrelated dynasty instead of continuing this one.
    // checkDynastyMatch is a no-op fast path for the common case (an already-
    // tracked exact path); it only does real work when the path is new.
    const candidate = await window.api.db.checkDynastyMatch(filePath);
    if (candidate) {
      const shouldLink = await confirm({
        eyebrow: 'Link dynasty',
        title: `Link to "${candidate.label}"?`,
        message: `This looks like the same dynasty as "${candidate.label}" (currently season ${candidate.currentSeasonYear}), just from a different file. Link this file to that dynasty as season ${candidate.newSeasonYear} instead of creating a new one?`,
        confirmLabel: 'Link file',
      });
      if (shouldLink) {
        try {
          const result = await window.api.db.relinkDynasty(candidate.dynastyId, filePath);
          setStatusMessage({ text: result.message, success: result.success });
          if (result.success) {
            const refreshed = await window.api.db.getDynasties();
            setDynasties(refreshed);
          }
        } catch {
          setStatusMessage({ text: 'Link failed unexpectedly. Please try again.', success: false });
        } finally {
          setImporting(false);
        }
        return;
      }
    }

    const unsubscribe = window.api.extraction.onProgress(({ step, status }) => {
      setProgress((prev) => ({ ...prev, [step]: status }));
    });

    try {
      const result = await window.api.db.importDynasty(filePath);
      setStatusMessage({ text: result.message, success: result.success });
      if (result.success) {
        const refreshed = await window.api.db.getDynasties();
        setDynasties(refreshed);
      }
    } catch {
      setStatusMessage({ text: 'Import failed unexpectedly. Please try again.', success: false });
    } finally {
      unsubscribe();
      setImporting(false);
    }
  }

  if (loading) {
    return <p className="text-slate-500 dark:text-slate-400">Loading dynasties...</p>;
  }

  return (
    <div className="space-y-6">
      <section
        style={ANGLED_PANEL}
        className="border border-white/65 bg-white/76 p-6 shadow-[0_28px_90px_-44px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-page-title font-bold text-slate-950 dark:text-white">
              Track every program from one place
            </h2>
          </div>

          {dynasties.length > 0 && (
            <button
              type="button"
              onClick={handleImportClick}
              disabled={importing}
              style={ANGLED_PANEL}
              className={IMPORT_BUTTON_CLASS}
            >
              {importing ? 'Importing...' : 'Import Dynasty'}
            </button>
          )}
        </div>
      </section>

      {importing && (
        <section
          style={ANGLED_PANEL}
          className="border border-white/65 bg-white/76 p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76"
        >
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Importing dynasty...
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXTRACTION_STEPS.map((step) => {
              const status = progress[step];
              const classes =
                status === 'done'
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-300'
                  : status === 'start'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400';
              return (
                <span
                  key={step}
                  className={`border px-3 py-1 text-xs font-medium ${classes}`}
                >
                  {STEP_LABELS[step]}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {statusMessage && (
        <section
          style={ANGLED_PANEL}
          className={`flex items-center justify-between gap-3 border p-4 text-sm shadow-[0_20px_70px_-44px_rgba(15,23,42,0.38)] ${
            statusMessage.success
              ? 'border-green-200 bg-green-50/90 text-green-800 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-200'
              : 'border-amber-200 bg-amber-50/90 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <p>{statusMessage.text}</p>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] opacity-70 transition hover:opacity-100"
          >
            Dismiss
          </button>
        </section>
      )}

      {dynasties.length === 0 ? (
        <section
          style={ANGLED_PANEL}
          className="flex flex-col items-center justify-center gap-5 border border-dashed border-slate-300/80 bg-white/65 px-6 py-16 text-center shadow-[0_22px_70px_-44px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/55"
        >
          <img
            src={FALLBACK_LOGO_PATH}
            alt=""
            className="h-28 w-28 object-contain opacity-60"
            draggable={false}
          />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              No dynasties imported yet
            </h3>
            <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              Choose a save file to create the first workspace entry.
            </p>
          </div>
          <button type="button" onClick={handleImportClick} disabled={importing} style={ANGLED_PANEL} className={IMPORT_BUTTON_CLASS}>
            {importing ? 'Importing...' : 'Import Dynasty'}
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {dynasties.map((dynasty) => {
            const colorVars = buildTeamColorVars(dynasty.primaryColor, dynasty.secondaryColor);
            const primaryTint = colorVars['--team-primary-rgb'] ?? '37 99 235';

            return (
              <Link
                key={dynasty.id}
                to={`/dynasty/${dynasty.id}`}
                style={{
                  ...(colorVars as unknown as CSSProperties),
                  ...ANGLED_PANEL,
                }}
                className="group relative overflow-hidden border border-white/65 bg-white/78 p-5 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.42)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:shadow-[0_28px_90px_-42px_rgba(15,23,42,0.48)] dark:border-white/10 dark:bg-slate-950/74"
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `linear-gradient(270deg, rgb(${primaryTint} / 0.34) 0%, rgb(${primaryTint} / 0.2) 28%, rgb(${primaryTint} / 0.1) 56%, transparent 100%)`,
                  }}
                />
                <div className="pointer-events-none absolute inset-[1px] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />

                <div className="relative flex min-h-[15rem] items-stretch justify-between gap-6">
                  {/*
                    Own reserved column, stretched to the row's full height and
                    split top/bottom via justify-between — the action row lives
                    in real layout space here, not absolutely floated over the
                    portrait column. That's what makes it collision-proof: no
                    matter how tall the coach portrait gets, this column is a
                    structurally separate flex track, never underneath it.
                  */}
                  <div className="flex min-w-0 max-w-[13rem] flex-col justify-between">
                    <div>
                      <h3 className="font-display text-page-title font-bold text-slate-950 dark:text-white">
                        {dynasty.coachName ?? dynasty.teamName}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{dynasty.teamName}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {dynasty.seasonYear !== null ? `Season ${dynasty.seasonYear}` : 'Awaiting season sync'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 transition duration-200 focus-within:opacity-100 group-hover:opacity-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => handleSync(event, dynasty.id)}
                          disabled={syncingId === dynasty.id}
                          aria-label={`Sync ${dynasty.teamName} dynasty`}
                          title="Sync Dynasty"
                          className={CARD_ICON_BUTTON_CLASS}
                        >
                          <SyncIcon />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleExportHistory(event, dynasty.id)}
                          disabled={exportingId === dynasty.id}
                          aria-label={`Export ${dynasty.teamName} history as HTML`}
                          title="Export History (HTML)"
                          className={CARD_ICON_BUTTON_CLASS}
                        >
                          <ExportIcon />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleBackup(event, dynasty.id)}
                          disabled={backingUpId === dynasty.id}
                          aria-label={`Backup ${dynasty.teamName} save file`}
                          title="Backup"
                          className={CARD_ICON_BUTTON_CLASS}
                        >
                          <BackupIcon />
                        </button>
                      </div>
                      {/* A deliberate gap plus this divider separate destructive from maintenance actions, so reaching for Sync/Backup never lands on Delete by mistake. */}
                      <div className="h-5 w-px shrink-0 bg-slate-300/70 dark:bg-slate-700/70" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={(event) => handleDelete(event, dynasty.id)}
                        disabled={deletingId === dynasty.id}
                        aria-label={`Delete ${dynasty.teamName} dynasty`}
                        title="Delete dynasty"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300/80 bg-white/90 text-red-600 shadow-[0_12px_30px_-14px_rgba(15,23,42,0.5)] backdrop-blur-md transition hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950/90 dark:text-red-400 dark:hover:bg-red-950/60"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  <div className="flex h-[13.5rem] flex-1 items-center justify-end">
                    {dynasty.coachPortraitAssetName ? (
                      // Fixed-size box so the logo can be pinned outside the portrait's own bounds — clearly behind and above-right, never overlapping the coach's face.
                      <div className="relative h-[13.5rem] w-[10.5rem] shrink-0">
                        <TeamLogo
                          team={{ assetName: dynasty.teamName, label: dynasty.teamName }}
                          size="lg"
                          className="absolute -right-4 -top-6 h-16 w-16 opacity-90 drop-shadow-[0_14px_32px_rgba(15,23,42,0.26)] transition duration-300 group-hover:scale-[1.04]"
                        />
                        <CoachPortrait
                          coach={coachPortraitIdentity(dynasty.coachName, dynasty.coachPortraitAssetName)}
                          size="lg"
                          className="relative z-[1] h-[13.5rem] w-[10.5rem] drop-shadow-[0_20px_44px_rgba(15,23,42,0.3)] transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    ) : (
                      <TeamLogo
                        team={{ assetName: dynasty.teamName, label: dynasty.teamName }}
                        size="lg"
                        className="h-[11.75rem] w-auto max-w-[13.5rem] opacity-95 drop-shadow-[0_18px_40px_rgba(15,23,42,0.28)] transition duration-300 group-hover:scale-[1.04]"
                      />
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
