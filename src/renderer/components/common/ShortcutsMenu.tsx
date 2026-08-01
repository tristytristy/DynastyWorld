import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { Button } from '../ui/Button';
import { useShortcuts } from '../../data/ShortcutsProvider';
import { comboFromEvent, formatCombo, isBindableCombo } from '../../lib/shortcutPrefs';
import { SHORTCUT_TARGETS, shortcutTargetsByGroup } from '../../lib/shortcutTargets';

/**
 * The shortcut editor.
 *
 * Every destination in the app is listed, and none of them arrive with a key.
 * Which page deserves a shortcut is a question about how someone plays, so the
 * app offers the list and the user spends the keys — rather than shipping
 * defaults that are wrong for most people and occupy combinations they'd
 * rather have themselves.
 *
 * Recording is the whole interaction: press the row's key field, then press the
 * combination you want. There is no text box to type "Ctrl+Shift+R" into,
 * because that invites spellings the dispatcher will never match.
 */
export function ShortcutsMenu({ triggerClassName, icon }: { triggerClassName?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { bindings, bind, unbind, clearAll, targetHolding, setCapturing } = useShortcuts();
  /** Which row is listening for a keypress, if any. */
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const recordingRef = useRef<HTMLButtonElement | null>(null);

  // Dispatch has to stand down while a row is listening, or the combo being
  // recorded would also navigate the moment it matched something.
  useEffect(() => {
    setCapturing(recordingId !== null);
    return () => setCapturing(false);
  }, [recordingId, setCapturing]);

  useEffect(() => {
    if (!recordingId) return;
    // Pinned here so the handler closes over a definite id rather than the
    // nullable state, which TypeScript can't narrow across the closure anyway.
    const targetId = recordingId;

    function onKeyDown(event: KeyboardEvent) {
      // Escape leaves the row alone rather than binding Escape to it.
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setRecordingId(null);
        setRejection(null);
        return;
      }
      const combo = comboFromEvent(event);
      if (!combo) return; // still holding modifiers down
      event.preventDefault();
      event.stopPropagation();
      const verdict = isBindableCombo(combo);
      if (!verdict.ok) {
        setRejection(verdict.reason);
        return;
      }
      // A combo can only mean one thing, so binding it here takes it off
      // whoever had it — say so, rather than letting a shortcut the user set
      // earlier quietly stop working.
      const previousHolder = targetHolding(combo);
      bind(targetId, combo);
      setRecordingId(null);
      setRejection(
        previousHolder && previousHolder !== targetId
          ? `${formatCombo(combo)} was on ${
              SHORTCUT_TARGETS.find((t) => t.id === previousHolder)?.label ?? 'another page'
            } — it's been moved here.`
          : null,
      );
    }
    // Capture phase: this has to win before anything else in the app reacts to
    // the key the user is trying to assign.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [recordingId, bind, targetHolding]);

  const assignedCount = Object.keys(bindings).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        {icon}
      </button>

      <CenteredModalPanel
        open={open}
        onClose={() => {
          setOpen(false);
          setRecordingId(null);
          setRejection(null);
        }}
        widthRem={44}
        eyebrow="Keyboard"
        title="Shortcuts"
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[30rem] text-sm text-slate-500 dark:text-slate-400">
              Nothing is bound to start with — the keys are yours to spend. Click a shortcut field and press the
              combination you want. It needs <strong>Ctrl</strong>, <strong>Alt</strong> or <strong>Cmd</strong>,
              or a function key.
            </p>
            {assignedCount > 0 && (
              <Button variant="tertiary" compact onClick={clearAll}>
                Clear all ({assignedCount})
              </Button>
            )}
          </div>

          {rejection && (
            <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {rejection}
            </p>
          )}

          {shortcutTargetsByGroup().map(({ group, targets }) => (
            <div key={group}>
              <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">{group}</p>
              <div className="space-y-1">
                {targets.map((target) => {
                  const combo = bindings[target.id];
                  const isRecording = recordingId === target.id;
                  return (
                    <div
                      key={target.id}
                      className="flex items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 dark:border-slate-800 dark:bg-white/5"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-200">{target.label}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          ref={isRecording ? recordingRef : undefined}
                          onClick={() => {
                            setRejection(null);
                            setRecordingId(isRecording ? null : target.id);
                          }}
                          className={`min-w-[7.5rem] border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition duration-fast ease-standard ${
                            isRecording
                              ? 'border-[var(--team-primary)] bg-[var(--team-primary)]/10 text-[var(--team-accent-text)]'
                              : combo
                                ? 'border-slate-300/80 text-slate-800 dark:border-slate-600 dark:text-white'
                                : 'border-dashed border-slate-300/80 text-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
                          }`}
                          aria-label={
                            combo ? `Change shortcut for ${target.label}` : `Set a shortcut for ${target.label}`
                          }
                        >
                          {isRecording ? 'Press keys…' : combo ? formatCombo(combo) : 'Not set'}
                        </button>
                        {combo && !isRecording && (
                          <button
                            type="button"
                            onClick={() => unbind(target.id)}
                            className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                            aria-label={`Remove shortcut for ${target.label}`}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Shortcuts to a page inside a dynasty do nothing on the Dashboard, where there is no dynasty to open it
            for. They never fire while you are typing — {SHORTCUT_TARGETS.length} destinations available.
          </p>
        </div>
      </CenteredModalPanel>
    </>
  );
}
