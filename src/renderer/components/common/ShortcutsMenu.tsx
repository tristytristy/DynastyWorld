import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { Button } from '../ui/Button';
import { useShortcuts } from '../../data/ShortcutsProvider';
import { BUILT_IN_SHORTCUTS, comboFromEvent, formatCombo, isBindableCombo } from '../../lib/shortcutPrefs';
import { SHORTCUT_TARGETS, shortcutTargetsByGroup } from '../../lib/shortcutTargets';

/**
 * The shortcut editor.
 *
 * THREE KINDS OF ROW, and the panel is honest about which is which:
 *
 *   • BUILT IN — Ctrl+K, Escape, the team arrows. Live since long before this
 *     panel existed and not rebindable, and until now not written down
 *     ANYWHERE, so the only way to learn them was to press them by accident.
 *     Listing them locked is the point: a shortcut you can't discover may as
 *     well not exist, and someone who tried to bind Ctrl+K got a refusal
 *     naming a shortcut they had never seen.
 *   • DEFAULTED — dark/light on Ctrl+Shift+Z. Arrives working, says so, and
 *     can be moved or taken away like anything else.
 *   • UNBOUND — every destination. Which page deserves a key is a question
 *     about how someone plays, so the app offers the list and the user spends
 *     the keys.
 *
 * Recording is the whole interaction: press the row's key field, then press the
 * combination you want. There is no text box to type "Ctrl+Shift+R" into,
 * because that invites spellings the dispatcher will never match.
 */
export function ShortcutsMenu({ triggerClassName, icon }: { triggerClassName?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { comboFor, bind, unbind, clearAll, boundCount, isCustomised, targetHolding, setCapturing } = useShortcuts();
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
              Dark / light mode arrives on a key; the rest are yours to spend. Click a shortcut field and press the
              combination you want. It needs <strong>Ctrl</strong>, <strong>Alt</strong> or <strong>Cmd</strong>,
              or a function key.
            </p>
            {isCustomised && (
              <Button variant="tertiary" compact onClick={clearAll}>
                Reset to defaults
              </Button>
            )}
          </div>

          {rejection && (
            <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {rejection}
            </p>
          )}

          {/*
            THE LOCKED LIST GOES FIRST, because it answers the question someone
            opens this panel with — "what already does something?" — before the
            catalogue of things that don't yet.
          */}
          <div>
            <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">Built in</p>
            <div className="space-y-1">
              {BUILT_IN_SHORTCUTS.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center justify-between gap-3 border border-dashed border-slate-200/80 px-3 py-2 dark:border-slate-800"
                >
                  <span className="text-sm text-slate-500 dark:text-slate-400">{entry.label}</span>
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {entry.combos.map(formatCombo).join('  ·  ')}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              These are fixed — they cannot be changed or reassigned.
            </p>
          </div>

          {shortcutTargetsByGroup().map(({ group, targets }) => (
            <div key={group}>
              <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">{group}</p>
              <div className="space-y-1">
                {targets.map((target) => {
                  const combo = comboFor(target.id);
                  const isRecording = recordingId === target.id;
                  // A default that is currently in force earns a quiet marker,
                  // so "why does this one already work?" answers itself.
                  const onDefault = combo !== null && combo === target.defaultCombo;
                  return (
                    <div
                      key={target.id}
                      className="flex items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 dark:border-slate-800 dark:bg-white/5"
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          {target.label}
                          {onDefault && (
                            <span className="shrink-0 border border-slate-300/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:border-slate-700 dark:text-slate-500">
                              Default
                            </span>
                          )}
                        </span>
                        {target.kind === 'action' && (
                          <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{target.hint}</span>
                        )}
                      </span>
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
                        {/* A default the user cleared or moved needs a way back
                            that doesn't cost them every other binding they set
                            — "Reset to defaults" at the top is all-or-nothing. */}
                        {!combo && !isRecording && target.defaultCombo && (
                          <button
                            type="button"
                            onClick={() => bind(target.id, target.defaultCombo as string)}
                            className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-[var(--team-accent-text)] dark:text-slate-500"
                            aria-label={`Restore the default shortcut for ${target.label}`}
                          >
                            Restore
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
            for. They never fire while you are typing — {boundCount} of {SHORTCUT_TARGETS.length} bound.
          </p>
        </div>
      </CenteredModalPanel>
    </>
  );
}
