import { useEffect, useRef, useState } from 'react';
import { PortraitPicker } from './PortraitPicker';
import { Button } from '../ui/Button';
import type { CoachEditFields } from '../../../shared/types';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type Tab = 'profile' | 'portrait';

const FIELD_LABEL_CLASS = 'mb-1.5 block type-eyebrow text-slate-400 dark:text-slate-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

export function CoachEditorModal({
  dynastyId,
  teamIndex,
  position,
  coachLabel,
  onClose,
  onSaved,
}: {
  dynastyId: string;
  teamIndex: number;
  position: string;
  coachLabel: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [draft, setDraft] = useState<CoachEditFields | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDraft(undefined);
    window.api.editor.getCoach(dynastyId, teamIndex, position).then((result) => {
      if (!cancelled) setDraft(result?.fields ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, position]);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<CoachEditFields>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setStatusMessage(null);
    const result = await window.api.editor.saveCoach(dynastyId, teamIndex, position, draft);
    setStatusMessage({ text: result.message, success: result.success });
    setSaving(false);
    if (result.success) onSaved?.();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${coachLabel}`}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-[0_60px_160px_-40px_rgba(2,6,23,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Edit Coach</p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{coachLabel}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close coach editor"
            className="border border-slate-300/80 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex shrink-0 gap-2 border-b border-slate-200/80 px-5 py-3 dark:border-white/10">
          {(['profile', 'portrait'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition ${
                tab === t
                  ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                  : 'border border-slate-200/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {t === 'profile' ? 'Coach Profile' : 'Portrait'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {draft === undefined && <p className="text-slate-500 dark:text-slate-400">Loading coach from save file...</p>}
          {draft === null && <p className="text-slate-500 dark:text-slate-400">Could not find this coach in the save file.</p>}
          {draft && tab === 'profile' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name">
                <input type="text" value={draft.firstName} onChange={(e) => update({ firstName: e.target.value })} className={INPUT_CLASS} />
              </Field>
              <Field label="Last Name">
                <input type="text" value={draft.lastName} onChange={(e) => update({ lastName: e.target.value })} className={INPUT_CLASS} />
              </Field>
              <Field label="Personality">
                <input type="text" value={draft.personality} onChange={(e) => update({ personality: e.target.value })} className={INPUT_CLASS} />
              </Field>
              <Field label="Coach Prestige">
                <input
                  type="number"
                  value={draft.coachPrestige}
                  onChange={(e) => update({ coachPrestige: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Contract Salary">
                <input
                  type="number"
                  value={draft.contractSalary}
                  onChange={(e) => update({ contractSalary: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Contract Length">
                <input
                  type="number"
                  value={draft.contractLength}
                  onChange={(e) => update({ contractLength: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Contract Years Remaining">
                <input
                  type="number"
                  value={draft.contractYearsRemaining}
                  onChange={(e) => update({ contractYearsRemaining: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          )}
          {draft && tab === 'portrait' && (
            <PortraitPicker kind="coach" currentAssetName={draft.portraitAssetName} onSelect={(assetName) => update({ portraitAssetName: assetName })} />
          )}
        </div>

        {draft && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4 dark:border-white/10">
            <p className={`text-sm ${statusMessage ? (statusMessage.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-slate-400 dark:text-slate-500'}`}>
              {statusMessage?.text ?? 'Edits write directly to the save file when saved.'}
            </p>
            <Button variant="primary" onClick={handleSave} disabled={saving} className="px-6">
              {saving ? 'Saving...' : 'Save Coach'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
