import { useEffect, useState } from 'react';
import { CenteredModalPanel } from './CenteredModalPanel';
import { TeamLogo } from './TeamLogo';
import type { SaveFileInfo, SavePeek } from '../../../shared/types';

/**
 * "Import Dynasty" — shows the dynasties actually sitting in the user's saves
 * folder instead of dropping them into a file browser.
 *
 * The old flow opened a native picker straight onto a folder of files named
 * `DYNASTY-EVANZSYNC`, `PROFILE-COLLEGE`, `ROSTER-Official`, `TEAMBUILDER-001`
 * — no indication of which was a dynasty, let alone whose. Here each real save
 * is listed by SCHOOL and COACH, read from inside the file itself, with the
 * season and week it's paused at.
 *
 * Autosaves and backups are grouped under the dynasty they belong to and hidden
 * behind a toggle: they're the same dynasty, so listing them as peers would
 * triple the list, but someone recovering a bad save still needs them.
 */

interface SaveGroup {
  slug: string;
  main: SaveFileInfo;
  variants: SaveFileInfo[];
}

function groupSaves(files: SaveFileInfo[]): SaveGroup[] {
  const bySlug = new Map<string, SaveFileInfo[]>();
  for (const file of files) {
    const list = bySlug.get(file.slug) ?? [];
    list.push(file);
    bySlug.set(file.slug, list);
  }
  return [...bySlug.values()]
    .map((list) => {
      // Prefer the real save; if a folder somehow has only an autosave, that
      // becomes the primary rather than the dynasty vanishing from the list.
      const main = list.find((f) => f.kind === 'main') ?? list[0];
      return { slug: main.slug, main, variants: list.filter((f) => f !== main) };
    })
    .sort((a, b) => b.main.modifiedAt.localeCompare(a.main.modifiedAt));
}

function kindLabel(kind: SaveFileInfo['kind']): string {
  if (kind === 'autosave') return 'Autosave';
  if (kind === 'backup') return 'Backup';
  return 'Save';
}

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ImportDynastyModal({
  open,
  onClose,
  onPick,
  onRestore,
  importedPaths,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (filePath: string) => void;
  /** Restore a dynasty from a backup zip — the other way to get a dynasty in here. */
  onRestore: () => void;
  /** Save paths already on the dashboard, so re-importing is labelled rather than looking new. */
  importedPaths: string[];
}) {
  const [folder, setFolder] = useState<string | null>(null);
  const [groups, setGroups] = useState<SaveGroup[] | null>(null);
  const [peeks, setPeeks] = useState<Record<string, SavePeek | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function scan(dir: string) {
    setGroups(null);
    setPeeks({});
    const files = await window.api.fs.scanForSaves(dir);
    const grouped = groupSaves(files);
    setGroups(grouped);

    // Identify each dynasty in the background: the list appears immediately
    // with filenames, then fills in with real schools and coaches as each save
    // is read. Sequential on purpose — opening several save files at once just
    // makes them all slow.
    for (const group of grouped) {
      const peek = await window.api.fs.peekSave(group.main.path);
      setPeeks((current) => ({ ...current, [group.main.path]: peek }));
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    window.api.fs.getDefaultSavesDir().then((dir) => {
      if (cancelled) return;
      setFolder(dir);
      void scan(dir);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function changeFolder() {
    const chosen = await window.api.fs.chooseSavesFolder();
    if (!chosen) return;
    setFolder(chosen);
    void scan(chosen);
  }

  async function browseForFile() {
    const filePath = await window.api.fs.selectFile();
    if (filePath) onPick(filePath);
  }

  const rowClass =
    'flex w-full items-center gap-3 border border-slate-200/80 bg-white/70 p-3 text-left transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10';

  return (
    <CenteredModalPanel open={open} onClose={onClose} widthRem={38} title="Import a dynasty">
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {groups === null
              ? 'Looking for your saves…'
              : groups.length === 0
                ? 'No dynasty saves in this folder.'
                : `Found ${groups.length} ${groups.length === 1 ? 'dynasty' : 'dynasties'}.`}
          </p>
          <button
            type="button"
            onClick={changeFolder}
            className="text-xs font-semibold text-[var(--team-primary)] underline-offset-2 hover:underline"
          >
            Change folder…
          </button>
        </div>
        {folder && <p className="break-all font-mono text-[11px] text-slate-400 dark:text-slate-500">{folder}</p>}

        {groups !== null && groups.length === 0 && (
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Dynasty saves are named like <span className="font-mono">DYNASTY-YOURTEAM</span>. If yours are somewhere
            else, point the app at that folder above, or pick the file yourself below.
          </p>
        )}

        <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
          {groups?.map((group) => {
            const peek = peeks[group.main.path];
            const pending = !(group.main.path in peeks);
            const already = importedPaths.includes(group.main.path);
            return (
              <div key={group.slug} className="space-y-1">
                <button type="button" onClick={() => onPick(group.main.path)} className={rowClass}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    {peek?.teamName ? (
                      <TeamLogo team={{ assetName: peek.teamName, label: peek.teamName }} size="sm" className="h-9 w-9" />
                    ) : (
                      <div className="h-9 w-9 border border-dashed border-slate-300 dark:border-slate-700" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {peek?.teamName ?? group.main.name}
                      {already && (
                        <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                          · already imported
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {pending
                        ? 'Reading…'
                        : peek
                          ? [peek.coachName, `${peek.seasonYear}`, peek.weekLabel].filter(Boolean).join(' · ')
                          : group.main.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                    {whenLabel(group.main.modifiedAt)}
                  </span>
                </button>

                {group.variants.length > 0 && (
                  <div className="pl-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((c) => ({ ...c, [group.slug]: !c[group.slug] }))}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {expanded[group.slug] ? 'Hide' : 'Show'} {group.variants.length} older{' '}
                      {group.variants.length === 1 ? 'version' : 'versions'}
                    </button>
                    {expanded[group.slug] &&
                      group.variants.map((variant) => (
                        <button
                          key={variant.path}
                          type="button"
                          onClick={() => onPick(variant.path)}
                          className={`${rowClass} mt-1 py-2`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {kindLabel(variant.kind)}
                            </p>
                            <p className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                              {variant.name}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                            {whenLabel(variant.modifiedAt)}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={browseForFile}
              className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Pick a file myself…
            </button>
            {/* Restoring a backup belongs with the other ways INTO a dynasty,
                not competing with them on the Dashboard header. */}
            <button
              type="button"
              onClick={onRestore}
              className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Restore Backup
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </CenteredModalPanel>
  );
}
