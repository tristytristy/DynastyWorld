import { useCallback, useEffect, useState } from 'react';
import type { PlayerNote } from '../../../shared/types';
import { useConfirm } from '../../data/ConfirmDialogProvider';

const TITLE_LIST_ID = 'player-note-title-suggestions';

const inputClass =
  'w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

  function NoteForm() {
    return (
      <div className="border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800 dark:bg-white/5">
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Title (e.g. Injury history, Position change)"
          list={TITLE_LIST_ID}
          spellCheck={false}
          aria-label="Note title"
          className={inputClass}
        />
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          rows={5}
          placeholder="Write your note..."
          aria-label="Note body"
          className={`${inputClass} mt-2 resize-y`}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saving}
            className="bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingId === 'new' ? 'Add note' : 'Save'}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
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
          <button
            type="button"
            onClick={startNew}
            className="corner-cut-sm border border-[var(--team-primary)]/60 bg-[var(--team-primary)]/[0.08] px-3 py-1.5 text-sm font-semibold text-[var(--team-primary)] transition hover:bg-[var(--team-primary)]/[0.16]"
          >
            + Add note
          </button>
        )}
      </div>

      {editingId === 'new' && <NoteForm />}

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
              <NoteForm key={note.id} />
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
