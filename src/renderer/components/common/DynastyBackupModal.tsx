import { useEffect, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { formatBytes } from '../../lib/formatBytes';
import type { DynastyBackupContents, DynastyBackupEstimate } from '../../../shared/types';

/**
 * "Back up this dynasty" — picks what goes into a single portable `.zip` and
 * writes it wherever the user chooses.
 *
 * Sizes are shown per item with a running total, because the whole point is
 * that the user stays in control of what a backup costs: a 30-year dynasty with
 * a big media library and an archive-only backup are both one click away, and
 * neither is a surprise. Sizes appear HERE, in the one place someone is already
 * thinking about disk space, rather than on the dynasty card where a permanent
 * number would just be background anxiety.
 */

interface BackupItem {
  key: keyof DynastyBackupContents;
  label: string;
  detail: string;
  bytes: number;
  available: boolean;
  unavailableNote?: string;
}

export function DynastyBackupModal({
  open,
  onClose,
  dynastyId,
  teamName,
}: {
  open: boolean;
  onClose: () => void;
  dynastyId: string;
  teamName: string;
}) {
  const [estimate, setEstimate] = useState<DynastyBackupEstimate | null>(null);
  const [contents, setContents] = useState<DynastyBackupContents>({
    media: true,
    cardPhotos: true,
    saveGame: true,
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; step: string } | null>(null);
  const [result, setResult] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEstimate(null);
    setResult(null);
    setProgress(null);
    let cancelled = false;
    window.api.editor
      .estimateDynastyBackup(dynastyId)
      .then((value) => {
        if (cancelled) return;
        setEstimate(value);
        // Don't pre-tick a save file that isn't there to be backed up.
        if (value && !value.saveGameAvailable) setContents((c) => ({ ...c, saveGame: false }));
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dynastyId]);

  useEffect(() => {
    if (!open) return;
    return window.api.editor.onBackupProgress(setProgress);
  }, [open]);

  const items: BackupItem[] = estimate
    ? [
        {
          key: 'media',
          label: 'Photos and videos',
          detail: `${estimate.mediaFiles} file${estimate.mediaFiles === 1 ? '' : 's'} from the Media Hub`,
          bytes: estimate.mediaBytes,
          available: estimate.mediaFiles > 0,
          unavailableNote: 'Nothing added yet',
        },
        {
          key: 'cardPhotos',
          label: 'Trading-card photos',
          detail: `${estimate.cardPhotoFiles} card image${estimate.cardPhotoFiles === 1 ? '' : 's'}`,
          bytes: estimate.cardPhotoBytes,
          available: estimate.cardPhotoFiles > 0,
          unavailableNote: 'None yet',
        },
        {
          key: 'saveGame',
          label: 'Your latest game save',
          detail: estimate.saveGameName ?? 'Lets you carry on playing, not just browsing',
          bytes: estimate.saveGameBytes,
          available: estimate.saveGameAvailable,
          unavailableNote: "Can't find the save file where it used to be",
        },
      ]
    : [];

  const totalBytes = estimate
    ? estimate.archiveBytes +
      items.reduce((sum, item) => sum + (item.available && contents[item.key] ? item.bytes : 0), 0)
    : 0;

  async function handleBackup() {
    setBusy(true);
    setResult(null);
    setProgress({ percent: 0, step: 'Starting…' });
    try {
      const res = await window.api.editor.createDynastyBackup(dynastyId, contents);
      // An empty message means the user cancelled the save dialog — say nothing.
      if (!res.success && !res.message) return;
      setResult({
        text: res.success ? `${res.message} Saved to ${res.filePath}` : res.message,
        success: res.success,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const rowClass = 'flex items-start gap-3 border-b border-slate-200/70 py-3 dark:border-slate-800/70';

  return (
    <CenteredModalPanel open={open} onClose={onClose} widthRem={34} eyebrow={teamName} title="Back up this dynasty">
      {!estimate ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Measuring…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Saves everything below into one <strong>.zip</strong> file, wherever you choose — keep it somewhere safe and
            you can put this dynasty back on any computer, even years from now.
          </p>

          <div>
            <div className={rowClass}>
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-slate-400 bg-slate-300 text-[10px] font-bold text-slate-700 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-200"
              >
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  The dynasty itself{' '}
                  <span className="font-normal text-slate-500 dark:text-slate-400">— always included</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {estimate.seasonCount} season{estimate.seasonCount === 1 ? '' : 's'} of history: stats, awards,
                  recruits, notes and photo captions
                </p>
              </div>
              <span className="tnum shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {formatBytes(estimate.archiveBytes)}
              </span>
            </div>

            {items.map((item) => (
              <label
                key={item.key}
                className={`${rowClass} ${item.available ? 'cursor-pointer' : 'cursor-default opacity-55'}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--team-primary)]"
                  checked={item.available && contents[item.key]}
                  disabled={!item.available || busy}
                  onChange={(event) => setContents((c) => ({ ...c, [item.key]: event.target.checked }))}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.available ? item.detail : item.unavailableNote}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {item.available ? formatBytes(item.bytes) : '—'}
                </span>
              </label>
            ))}

            <div className="flex items-baseline justify-between gap-4 pt-3">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Backup size</span>
              <span className="tnum text-sm font-semibold text-slate-900 dark:text-white">
                about {formatBytes(totalBytes)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Usually smaller — the dynasty history compresses well.
            </p>
          </div>

          {busy && progress && (
            <div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-[var(--team-primary)] transition-[width] duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{progress.step}</p>
            </div>
          )}

          {result && (
            <p
              className={`break-all text-xs ${
                result.success ? 'text-slate-600 dark:text-slate-300' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {result.text}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {result?.success ? 'Done' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleBackup}
              disabled={busy}
              className="corner-cut-sm border border-[var(--team-primary)] bg-[var(--team-primary)] px-4 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Backing up…' : 'Choose location & back up'}
            </button>
          </div>
        </div>
      )}
    </CenteredModalPanel>
  );
}
