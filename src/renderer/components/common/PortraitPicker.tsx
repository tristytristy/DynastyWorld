import { Select } from '../ui/Select';
import { useEffect, useState } from 'react';
import { BUILD_LABELS, SKIN_TONE_LABELS } from '../../../shared/portraitTaxonomy';
import type { PortraitBuild, PortraitSkinTone, PortraitType } from '../../../shared/portraitTaxonomy';
import type { PortraitFilters, PortraitSearchResult } from '../../../shared/types';
import { getPlayerPortraitCandidates } from '../../lib/playerAssetMapping';
import { getCoachPortraitPath } from '../../lib/coachAssetMapping';
import { ModalOverlay } from './ModalOverlay';

const PAGE_SIZE = 60;

/**
 * Resolves a portrait through the SAME `cfbmedia://` scheme every other
 * portrait in the app uses (see playerAssetMapping / coachAssetMapping), which
 * serves from the real image-data folder wherever it's installed.
 *
 * This used to build a plain relative `assets/...` path, which only resolves
 * when the art sits inside the app itself. That stopped being true at the
 * two-installer split, so on a packaged build every image here was a broken
 * icon — while the identical portraits rendered fine everywhere else in the
 * app, because everywhere else already used cfbmedia://.
 *
 * Going through the shared helpers also brings the de-dash fallback along: a
 * small number of players carry a truncation dash in their asset name that the
 * exported files don't have.
 */
function portraitPath(kind: 'player' | 'coach', assetName: string): string | null {
  if (kind === 'coach') return getCoachPortraitPath(assetName);
  return getPlayerPortraitCandidates(assetName)[0] ?? null;
}

function CurrentPortraitImage({ kind, assetName }: { kind: 'player' | 'coach'; assetName: string }) {
  const src = portraitPath(kind, assetName);
  // An unresolvable name shows the neutral placeholder rather than a broken
  // image icon — the same thing the user was staring at when this was reported.
  if (!src) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        None
      </div>
    );
  }
  return <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover object-top" draggable={false} />;
}

function Lightbox({
  results,
  index,
  onIndexChange,
  onClose,
  onSelect,
  currentAssetName,
}: {
  results: PortraitSearchResult[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onSelect: (assetName: string) => void;
  currentAssetName: string | null;
}) {
  const portrait = results[index];
  const canPrev = index > 0;
  const canNext = index < results.length - 1;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [index, canPrev, canNext, onIndexChange, onClose]);

  if (!portrait) return null;

  return (
    <ModalOverlay
      className="modal-scrim modal-scrim-deep fixed inset-0 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${portrait.assetName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={() => canPrev && onIndexChange(index - 1)}
        disabled={!canPrev}
        aria-label="Previous portrait"
        className="absolute left-6 top-1/2 -translate-y-1/2 border border-white/30 bg-white/10 px-4 py-3 text-2xl text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => canNext && onIndexChange(index + 1)}
        disabled={!canNext}
        aria-label="Next portrait"
        className="absolute right-6 top-1/2 -translate-y-1/2 border border-white/30 bg-white/10 px-4 py-3 text-2xl text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
      >
        →
      </button>

      <div className="flex max-h-full max-w-lg flex-col items-center gap-4 rounded-xl border border-white/15 bg-slate-900/90 p-6">
        <img
          src={portrait.path}
          alt={portrait.assetName}
          className="h-72 w-72 rounded-xl object-cover object-top"
          draggable={false}
        />
        <div className="text-center">
          <p className="break-all text-sm font-medium text-white">{portrait.assetName}</p>
          <p className="mt-1 text-xs text-slate-400">
            {portrait.type === 'generic' ? 'Generic' : 'Unique'}
            {portrait.build && ` · ${BUILD_LABELS[portrait.build]}`}
            {portrait.skinTone && ` · ${SKIN_TONE_LABELS[portrait.skinTone]}`}
            {' · '}
            {index + 1} of {results.length} on this page
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-700"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onSelect(portrait.assetName);
              onClose();
            }}
            disabled={portrait.assetName === currentAssetName}
            className="bg-[var(--team-primary)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--team-on-primary)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {portrait.assetName === currentAssetName ? 'Current Portrait' : 'Use This Portrait'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/**
 * Lets the user reassign a player/coach's face by searching + filtering the
 * local portrait asset library (25k+ files for players) rather than typing a
 * raw asset key by hand. Filters run against the real, verified structure
 * baked into "Generic" portrait keys — see shared/portraitTaxonomy.ts — not
 * a guess. Search/filter/pagination all run in the main process (see
 * editorWrite.ts's searchPortraits) since the renderer has no filesystem
 * access and the full library is too large to ship over IPC at once.
 */
export function PortraitPicker({
  kind,
  currentAssetName,
  onSelect,
}: {
  kind: 'player' | 'coach';
  currentAssetName: string | null;
  onSelect: (assetName: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<PortraitType | 'all'>('all');
  const [build, setBuild] = useState<PortraitBuild | 'all'>('all');
  const [skinTone, setSkinTone] = useState<PortraitSkinTone | 'all'>('all');
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<PortraitSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setPage(0);
  }, [kind, query, type, build, skinTone]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const filters: PortraitFilters = { type, build, skinTone };
    const timeout = setTimeout(() => {
      window.api.editor.searchPortraits(kind, query, filters, page).then((response) => {
        if (!cancelled) {
          setResults(response.results);
          setTotalCount(response.totalCount);
          setLoading(false);
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [kind, query, type, build, skinTone, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i).filter(
    (p) => p === 0 || p === totalPages - 1 || Math.abs(p - page) <= 2,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Current portrait</p>
        <div className="mt-2 flex items-center gap-3">
          {currentAssetName ? (
            <CurrentPortraitImage key={`${kind}:${currentAssetName}`} kind={kind} assetName={currentAssetName} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              None
            </div>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 break-all">{currentAssetName ?? 'No portrait assigned'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search by name..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
        />
        <Select
          value={type}
          onChange={setType}
          ariaLabel="Portrait type"
          options={[
            { value: 'all' as PortraitType | 'all', label: 'All types' },
            { value: 'generic' as PortraitType | 'all', label: 'Generic' },
            { value: 'unique' as PortraitType | 'all', label: 'Unique' },
          ]}
        />
        <Select
          value={build}
          onChange={setBuild}
          ariaLabel="Portrait build"
          options={[
            { value: 'all' as PortraitBuild | 'all', label: 'All builds' },
            ...(Object.keys(BUILD_LABELS) as PortraitBuild[]).map((b) => ({
              value: b as PortraitBuild | 'all',
              label: BUILD_LABELS[b],
            })),
          ]}
        />
        <Select
          value={skinTone}
          onChange={setSkinTone}
          ariaLabel="Portrait skin tone"
          options={[
            { value: 'all' as PortraitSkinTone | 'all', label: 'All skin tones' },
            ...(Object.keys(SKIN_TONE_LABELS) as PortraitSkinTone[]).map((s) => ({
              value: s as PortraitSkinTone | 'all',
              label: SKIN_TONE_LABELS[s],
            })),
          ]}
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Searching...</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No portraits match these filters.</p>
      ) : (
        <>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Showing {page * PAGE_SIZE + 1}-{page * PAGE_SIZE + results.length} of {totalCount}. Click a portrait to preview it larger.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 xl:grid-cols-6">
            {results.map((r, i) => (
              <button
                key={r.assetName}
                type="button"
                onClick={() => setLightboxIndex(i)}
                title={r.assetName}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition hover:border-[var(--team-primary)] ${
                  r.assetName === currentAssetName
                    ? 'border-[var(--team-primary)] bg-[color:color-mix(in_srgb,var(--team-primary)_10%,transparent)]'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <img src={r.path} alt="" className="h-24 w-24 rounded-md object-cover object-top" draggable={false} />
                <span className="w-full truncate text-[10px] text-slate-500 dark:text-slate-400">{r.assetName}</span>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Prev
              </button>
              {pageNumbers.map((p, i) => (
                <span key={p} className="flex items-center gap-1.5">
                  {i > 0 && pageNumbers[i - 1] !== p - 1 && <span className="text-xs text-slate-400">...</span>}
                  <button
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-7 w-7 text-xs font-medium transition ${
                      p === page
                        ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                        : 'border border-slate-200/80 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    {p + 1}
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="border border-slate-200/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          results={results}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelect={onSelect}
          currentAssetName={currentAssetName}
        />
      )}
    </div>
  );
}
