import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CenteredModalPanel } from './CenteredModalPanel';
import { PlayerPortrait } from './PlayerPortrait';
import { CoachPortrait } from './CoachPortrait';
import { TeamLogo } from './TeamLogo';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useTeamModal } from '../../data/TeamModalProvider';
import { spaceCamelCase } from './CoachCard';
import type { GlobalSearchResults } from '../../../shared/types';

const EMPTY: GlobalSearchResults = { players: [], coaches: [], teams: [] };

/** Pull the active dynasty id out of the URL (/dynasty/:id/...). Null on the Dashboard. */
function useDynastyId(): string | null {
  const { pathname } = useLocation();
  return pathname.match(/^\/dynasty\/([^/]+)/)?.[1] ?? null;
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="mb-1.5 mt-4 flex items-center justify-between first:mt-0">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{children}</p>
      <span className="tnum text-xs font-semibold text-slate-400 dark:text-slate-500">{count}</span>
    </div>
  );
}

const ROW_CLASS =
  'flex w-full items-center gap-3 border border-transparent px-2.5 py-2 text-left transition hover:border-[var(--team-primary)]/50 hover:bg-[color:color-mix(in_srgb,var(--team-primary)_10%,transparent)]';

export function GlobalSearch({ triggerClassName }: { triggerClassName?: string }) {
  const dynastyId = useDynastyId();
  const { openPlayerModal } = usePlayerModal();
  const { openTeamModal } = useTeamModal();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd/Ctrl+K opens search from anywhere inside a dynasty.
  useEffect(() => {
    if (!dynastyId) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dynastyId]);

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(EMPTY);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open || !dynastyId) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(() => {
      window.api.db.globalSearch(dynastyId, q).then((r) => {
        if (!cancelled) {
          setResults(r ?? EMPTY);
          setLoading(false);
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, dynastyId]);

  const close = useCallback(() => setOpen(false), []);

  const openPlayer = useCallback(
    (p: GlobalSearchResults['players'][number]) => {
      if (!dynastyId) return;
      openPlayerModal(
        dynastyId,
        p.id,
        undefined,
        undefined,
        { name: `${p.firstName} ${p.lastName}`, position: p.position, teamDisplayName: p.teamName, portraitAssetName: p.portraitAssetName },
        p.teamIndex,
      );
      close();
    },
    [dynastyId, openPlayerModal, close],
  );

  const openTeam = useCallback(
    (teamIndex: number) => {
      if (!dynastyId) return;
      openTeamModal(dynastyId, teamIndex);
      close();
    },
    [dynastyId, openTeamModal, close],
  );

  // Enter opens the most relevant hit (player > team > coach).
  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    if (results.players[0]) openPlayer(results.players[0]);
    else if (results.teams[0]) openTeam(results.teams[0].teamIndex);
    else if (results.coaches[0]) openTeam(results.coaches[0].teamIndex);
  }

  if (!dynastyId) return null;

  const hasQuery = query.trim().length >= 2;
  const total = results.players.length + results.coaches.length + results.teams.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex items-center justify-between gap-2">
          <span>Search</span>
          <span className="hidden shrink-0 border border-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-600 dark:text-slate-500 sm:inline">
            Ctrl K
          </span>
        </span>
      </button>

      <CenteredModalPanel open={open} onClose={close} widthRem={38} eyebrow="Search" title="Find a player, coach, or team">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Type a name or team…"
          className="w-full border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
        />
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Searches the current season across every team in the country.
        </p>

        <div className="mt-2 max-h-[52vh] overflow-y-auto">
          {!hasQuery ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Start typing to search.</p>
          ) : loading && total === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Searching…</p>
          ) : total === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">No matches for “{query.trim()}”.</p>
          ) : (
            <>
              {results.players.length > 0 && (
                <>
                  <SectionLabel count={results.players.length}>Players</SectionLabel>
                  {results.players.map((p) => (
                    <button key={`p-${p.id}`} type="button" onClick={() => openPlayer(p)} className={ROW_CLASS}>
                      <PlayerPortrait player={p} size="sm" className="!h-8 !w-8 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {p.position} · {p.teamName}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500">{p.overallRating} OVR</span>
                    </button>
                  ))}
                </>
              )}

              {results.teams.length > 0 && (
                <>
                  <SectionLabel count={results.teams.length}>Teams</SectionLabel>
                  {results.teams.map((t) => (
                    <button key={`t-${t.teamIndex}`} type="button" onClick={() => openTeam(t.teamIndex)} className={ROW_CLASS}>
                      <TeamLogo team={{ assetName: t.displayName, label: t.displayName }} size="sm" className="!h-8 !w-8 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{t.displayName}</span>
                        {t.conferenceName && (
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t.conferenceName}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {results.coaches.length > 0 && (
                <>
                  <SectionLabel count={results.coaches.length}>Coaches</SectionLabel>
                  {results.coaches.map((c, i) => (
                    <button key={`c-${c.teamIndex}-${i}`} type="button" onClick={() => openTeam(c.teamIndex)} className={ROW_CLASS}>
                      <CoachPortrait coach={c} size="sm" className="!h-8 !w-8 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {c.firstName} {c.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {spaceCamelCase(c.position)}
                          {c.teamName ? ` · ${c.teamName}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </CenteredModalPanel>
    </>
  );
}
