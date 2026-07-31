import { useEffect, useRef, useState } from 'react';
import { useScrollLock } from '../../lib/useScrollLock';
import { Button } from '../ui/Button';
import type { TeamBudgetData, TeamBudgetFields } from '../../../shared/types';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const MAX_BUDGET = 25000;

const FIELD_LABEL_CLASS = 'mb-1.5 block type-eyebrow text-slate-400 dark:text-slate-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function ContextTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 proportional-nums text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/**
 * Edits a team's program-points budget — the coach-HUD "Program Points" pool
 * that NIL is funded out of. Reads fresh from the Team record on open (like the
 * coach editor) and writes only ProgramPointBudget + RemainingProgramPoints
 * (the pair PocketScout's NIL-budget tool edits), auto-backing up first.
 */
export function TeamBudgetModal({
  dynastyId,
  teamIndex,
  teamLabel,
  onClose,
  onSaved,
}: {
  dynastyId: string;
  teamIndex: number;
  teamLabel: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<TeamBudgetData | null | undefined>(undefined);
  const [draft, setDraft] = useState<Pick<TeamBudgetFields, 'programPointBudget' | 'remainingProgramPoints'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setDraft(null);
    window.api.editor.getTeamBudget(dynastyId, teamIndex).then((result) => {
      if (cancelled) return;
      setData(result ?? null);
      if (result) {
        setDraft({
          programPointBudget: result.fields.programPointBudget,
          remainingProgramPoints: result.fields.remainingProgramPoints,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex]);

  useScrollLock(true);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setStatusMessage(null);
    const budget = clamp(Math.round(draft.programPointBudget), 0, MAX_BUDGET);
    const remaining = clamp(Math.round(draft.remainingProgramPoints), 0, budget);
    const result = await window.api.editor.saveTeamBudget(dynastyId, teamIndex, {
      programPointBudget: budget,
      remainingProgramPoints: remaining,
    });
    setStatusMessage({ text: result.message, success: result.success });
    setSaving(false);
    if (result.success) {
      setData((prev) => (prev ? { ...prev, fields: { ...prev.fields, programPointBudget: budget, remainingProgramPoints: remaining } } : prev));
      onSaved?.();
    }
  }

  const original = data?.fields ?? null;
  const changed =
    !!draft &&
    !!original &&
    (Math.round(draft.programPointBudget) !== original.programPointBudget ||
      Math.round(draft.remainingProgramPoints) !== original.remainingProgramPoints);

  return (
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${teamLabel} program budget`}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden modal-panel corner-cut md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Program Budget</p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{teamLabel}</h3>
          </div>
          <ModalCloseButton label="budget editor" onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {data === undefined && <p className="text-slate-500 dark:text-slate-400">Loading budget from save file...</p>}
          {data === null && <p className="text-slate-500 dark:text-slate-400">Could not find this team in the save file.</p>}
          {data && draft && original && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Program Points are the coach-HUD currency you spend in the Program Builder. NIL isn&apos;t a separate
                pool — it&apos;s a category funded from these points, so raising the budget lets this program afford
                bigger NIL deals. You then allocate the added points to NIL in-game.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <ContextTile label="NIL points allocated" value={String(original.nilProgramPointsSpent)} />
                <ContextTile label="Program prestige" value={String(original.teamPrestige)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={FIELD_LABEL_CLASS}>Total Program Points</span>
                  <input
                    type="number"
                    min={0}
                    max={MAX_BUDGET}
                    value={draft.programPointBudget}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, programPointBudget: Number(e.target.value) } : prev))}
                    className={INPUT_CLASS}
                  />
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                    was {original.programPointBudget} · max {MAX_BUDGET.toLocaleString()}
                  </span>
                </label>
                <label className="block">
                  <span className={FIELD_LABEL_CLASS}>Unspent (Remaining)</span>
                  <input
                    type="number"
                    min={0}
                    max={MAX_BUDGET}
                    value={draft.remainingProgramPoints}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, remainingProgramPoints: Number(e.target.value) } : prev))}
                    className={INPUT_CLASS}
                  />
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                    was {original.remainingProgramPoints} · the HUD&apos;s blue diamond · clamped ≤ total
                  </span>
                </label>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                Writes directly to the save file. A timestamped backup is made automatically before any change.
              </p>
            </div>
          )}
        </div>

        {data && draft && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4 dark:border-white/10">
            <p
              className={`text-sm ${
                statusMessage
                  ? statusMessage.success
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {statusMessage?.text ?? (changed ? 'Unsaved changes.' : 'Adjust the values, then save.')}
            </p>
            <Button variant="primary" onClick={handleSave} disabled={saving || !changed} className="px-6">
              {saving ? 'Saving...' : 'Save Budget'}
            </Button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
