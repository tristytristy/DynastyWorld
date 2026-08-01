import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { PlayerNote } from '../../../shared/types';
import { useConfirm } from '../../data/ConfirmDialogProvider';
import { Button } from '../ui/Button';

const TITLE_LIST_ID = 'player-note-title-suggestions';

const inputClass =
  'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * DECLARED AT MODULE SCOPE, and it has to stay that way.
 *
 * This form used to be defined inside PlayerNotesTab. The draft text lives in
 * that component's state, so every keystroke re-rendered it — and because a
 * nested function declaration produces a NEW function identity each time, React
 * saw a different component type, threw the old subtree away and mounted a fresh
 * one. The <input> being typed into was destroyed and rebuilt on every
 * character, so focus and the caret went with it: you got one letter, then had
 * to click back in. Hoisting it out keeps the element identity stable across
 * renders, which is the whole fix.
 *
 * Everything it needs arrives as props for the same reason — closing over the
 * parent's state would put the declaration back inside.
 */
function NoteForm({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSave,
  onCancel,
  saving,
  canSave,
  isNew,
}: {
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  canSave: boolean;
  isNew: boolean;
}) {
  /*
    Keyboard, so writing a note never needs the mouse: Ctrl/Cmd+Enter commits
    from either field, Escape backs out. Escape stops propagating on purpose —
    the player modal closes on Escape, and losing the whole profile when you
    meant to abandon a note is the wrong outcome.
  */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSave();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-white/5">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Title (e.g. Injury history, Position change)"
        list={TITLE_LIST_ID}
        spellCheck={false}
        aria-label="Note title"
        // Opening the form puts the caret where you'd start typing anyway.
        autoFocus
        className={inputClass}
      />
      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={5}
        placeholder="Write your note..."
        aria-label="Note body"
        className={`${inputClass} mt-2 resize-y`}
      />
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={onSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : isNew ? 'Add note' : 'Save'}
        </Button>
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'}+Enter to save
        </span>
      </div>
    </div>
  );
}

/**
 * Notes tab — freeform, per-player notes that persist across sessions (schema
 * v7, scoped by dynasty + player, kept out of season snapshots). The title
 * field recalls previously-used titles via a datalist so recurring note kinds
 * come back with one keystroke. Notes are user data, so unlike attribute
 * editing they're editable in any season.
 */
export function PlayerNotesTab({ dynastyId, playerId }: { dynastyId: string; playerId: number }) {
  const confirm = useConfirm();
  const [notes, setNotes] = useState<PlayerNote[] | undefined>(undefined);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  // null = not editing; 'new' = the create form; a number = editing that note.
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    window.api.notes.list(dynastyId, playerId).then(setNotes);
    window.api.notes.titleSuggestions(dynastyId).then(setTitleSuggestions);
  }, [dynastyId, playerId]);

  useEffect(() => {
    setNotes(undefined);
    setEditingId(null);
    refresh();
  }, [dynastyId, playerId, refresh]);

  function startNew() {
    setEditingId('new');
    setDraftTitle('');
    setDraftBody('');
  }
  function startEdit(note: PlayerNote) {
    setEditingId(note.id);
    setDraftTitle(note.title);
    setDraftBody(note.body);
  }
  function cancel() {
    setEditingId(null);
  }

  const canSave = draftTitle.trim().length > 0 || draftBody.trim().length > 0;

  async function save() {
    if (!canSave || saving) return;
    const title = draftTitle.trim();
    const body = draftBody.trim();
    setSaving(true);
    try {
      if (editingId === 'new') {
        await window.api.notes.create(dynastyId, playerId, title, body);
      } else if (typeof editingId === 'number') {
        await window.api.notes.update(editingId, title, body);
      }
      setEditingId(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(note: PlayerNote) {
    const ok = await confirm({
      eyebrow: 'Delete note',
      title: `Delete "${note.title.trim() || 'Untitled note'}"?`,
      message: 'This note will be permanently removed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      await window.api.notes.remove(note.id);
      refresh();
    }
  }

  if (notes === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading notes...</p>;
  }

  return (
    <div className="space-y-4">
      <datalist id={TITLE_LIST_ID}>
        {titleSuggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="flex items-center justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Notes {notes.length > 0 ? `(${notes.length})` : ''}
        </p>
        {editingId !== 'new' && (
          <Button variant="primary" compact onClick={startNew}>
            + Add note
          </Button>
        )}
      </div>

      {editingId === 'new' && (
        <NoteForm
          title={draftTitle}
          body={draftBody}
          onTitleChange={setDraftTitle}
          onBodyChange={setDraftBody}
          onSave={save}
          onCancel={cancel}
          saving={saving}
          canSave={canSave}
          isNew={editingId === 'new'}
        />
      )}

      {notes.length === 0 && editingId !== 'new' ? (
        <div className="border border-dashed border-slate-300/80 px-5 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No notes on this player yet. Jot down anything you want to remember — scouting reads, position ideas,
            recruiting angles. They&apos;re saved to this player and stick around across seasons.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) =>
            editingId === note.id ? (
              <NoteForm
                key={note.id}
                title={draftTitle}
                body={draftBody}
                onTitleChange={setDraftTitle}
                onBodyChange={setDraftBody}
                onSave={save}
                onCancel={cancel}
                saving={saving}
                canSave={canSave}
                isNew={false}
              />
            ) : (
              <div key={note.id} className="border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {note.title.trim() || <span className="text-slate-400 dark:text-slate-500">Untitled note</span>}
                  </h4>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-[var(--team-primary)] dark:text-slate-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(note)}
                      className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {note.body.trim() && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {note.body}
                  </p>
                )}
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Updated {formatWhen(note.updatedAt)}
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
