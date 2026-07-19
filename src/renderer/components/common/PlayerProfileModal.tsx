import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { PlayerProfileContent } from './PlayerProfileContent';
import { PlayerPortrait } from './PlayerPortrait';
import { positionSortIndex, unitForPosition } from '../../lib/rosterOrder';
import type { RosterPlayer } from '../../../shared/types';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** Session-scoped recently-viewed players, newest first, deduped, capped. Module-level on purpose — survives modal close/reopen without persisting anywhere. */
const recentPlayers: { playerId: number; dynastyId: string }[] = [];
function pushRecent(dynastyId: string, playerId: number) {
  const existing = recentPlayers.findIndex((r) => r.playerId === playerId && r.dynastyId === dynastyId);
  if (existing !== -1) recentPlayers.splice(existing, 1);
  recentPlayers.unshift({ dynastyId, playerId });
  if (recentPlayers.length > 8) recentPlayers.pop();
}

const UNIT_ORDER = ['Offense', 'Defense', 'Special Teams'] as const;

/**
 * Teammate rail (profile redesign, 2026-07-20): instant search + the roster
 * grouped by unit, click to swap the profile in place, plus recently-viewed.
 * Its own small roster fetch (per-page-fetch convention) so the shell doesn't
 * reach into PlayerProfileContent's internals.
 */
function TeammateRail({
  dynastyId,
  seasonId,
  leagueTeamIndex,
  activePlayerId,
  onPick,
}: {
  dynastyId: string;
  seasonId: number | undefined;
  /** Set when browsing another team via the team switcher — the rail then lists that team's league-snapshot roster, not the user's. */
  leagueTeamIndex: number | undefined;
  activePlayerId: number;
  onPick: (playerId: number) => void;
}) {
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRoster(undefined);
    const fetchRoster =
      leagueTeamIndex === undefined
        ? window.api.db.getRoster(dynastyId, seasonId)
        : window.api.db.getLeagueTeamRoster(dynastyId, leagueTeamIndex, seasonId).then((r) => r?.players ?? null);
    fetchRoster.then((result) => {
      if (!cancelled) setRoster(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, leagueTeamIndex]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLowerCase();
    const matches = q
      ? roster.filter(
          (p) =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
            p.position.toLowerCase() === q ||
            String(p.jerseyNumber) === q,
        )
      : roster;
    return [...matches].sort(
      (a, b) => positionSortIndex(a.position) - positionSortIndex(b.position) || b.overallRating - a.overallRating,
    );
  }, [roster, query]);

  const recents = recentPlayers
    .filter((r) => r.dynastyId === dynastyId && r.playerId !== activePlayerId)
    .map((r) => roster?.find((p) => p.id === r.playerId))
    .filter((p): p is RosterPlayer => !!p)
    .slice(0, 4);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200/80 dark:border-white/10">
      <div className="shrink-0 border-b border-slate-200/80 p-3 dark:border-white/10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, #, position..."
          aria-label="Search players"
          className="w-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {recents.length > 0 && !query && (
          <div className="mb-2">
            <p className="type-eyebrow px-2 py-1.5 text-slate-400 dark:text-slate-500">Recent</p>
            {recents.map((p) => (
              <RailRow key={`recent-${p.id}`} player={p} active={false} onPick={onPick} />
            ))}
          </div>
        )}
        {roster === undefined && <p className="px-2 py-3 text-xs text-slate-400">Loading roster...</p>}
        {roster === null && <p className="px-2 py-3 text-xs text-slate-400">No roster for this season.</p>}
        {UNIT_ORDER.map((unit) => {
          const unitPlayers = filtered.filter((p) => unitForPosition(p.position) === unit);
          if (unitPlayers.length === 0) return null;
          return (
            <div key={unit} className="mb-2">
              <p className="type-eyebrow px-2 py-1.5 text-slate-400 dark:text-slate-500">{unit}</p>
              {unitPlayers.map((p) => (
                <RailRow key={p.id} player={p} active={p.id === activePlayerId} onPick={onPick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RailRow({ player, active, onPick }: { player: RosterPlayer; active: boolean; onPick: (id: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(player.id)}
      className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition duration-fast ease-standard ${
        active
          ? 'corner-cut-sm bg-[var(--team-primary)] text-[var(--team-on-primary)]'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
      }`}
    >
      <PlayerPortrait player={player} size="sm" className="!h-8 !w-8" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {player.firstName} {player.lastName}
      </span>
      <span className={`tnum shrink-0 text-xs ${active ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
        {player.position} {player.overallRating}
      </span>
    </button>
  );
}

/**
 * The single global player-profile modal, rendered once near the app root
 * (see app.tsx) and driven entirely by PlayerModalProvider's state — every
 * "click a player name" spot in the app opens the same instance rather than
 * each page owning its own modal. Layers over the current page (no route
 * change), traps focus and Tab-cycling while open, closes on Escape or the
 * close button, and returns focus to whichever element opened it.
 * ArrowLeft/ArrowRight step through the opening context's player order
 * (unless focus is in a text input).
 */
export function PlayerProfileModal() {
  const { state, closePlayerModal, goToPlayer } = usePlayerModal();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [railOpen, setRailOpen] = useState(true);

  const isOpen = state !== null;
  const playerIdForEffect = state?.playerId;
  const dynastyIdForEffect = state?.dynastyId;

  useEffect(() => {
    if (dynastyIdForEffect && playerIdForEffect !== undefined) pushRecent(dynastyIdForEffect, playerIdForEffect);
  }, [dynastyIdForEffect, playerIdForEffect]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePlayerModal();
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
  }, [isOpen, closePlayerModal]);

  // Arrow-key player navigation — separate effect so it re-binds as the
  // active player/navigation list changes.
  const navigationIds = state?.navigationIds;
  const playerId = state?.playerId;
  useEffect(() => {
    if (!isOpen || !navigationIds || playerId === undefined) return;
    function handleArrows(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const index = navigationIds!.indexOf(playerId!);
      if (index === -1) return;
      const nextIndex = event.key === 'ArrowLeft' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= navigationIds!.length) return;
      event.preventDefault();
      goToPlayer(navigationIds![nextIndex]);
    }
    document.addEventListener('keydown', handleArrows);
    return () => document.removeEventListener('keydown', handleArrows);
  }, [isOpen, navigationIds, playerId, goToPlayer]);

  if (!state) return null;

  const { dynastyId, seasonId, fallback, leagueTeamIndex } = state;
  const activePlayerId = state.playerId;
  const navIndex = navigationIds?.indexOf(activePlayerId) ?? -1;
  const hasNavigation = navigationIds !== undefined && navIndex !== -1;
  const canGoPrevious = hasNavigation && navIndex > 0;
  const canGoNext = hasNavigation && navIndex < (navigationIds?.length ?? 0) - 1;

  const navButtonClass =
    'border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePlayerModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Player profile"
        className="corner-cut relative flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden border border-white/70 bg-white/95 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 md:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRailOpen((prev) => !prev)}
              aria-label={railOpen ? 'Hide teammate list' : 'Show teammate list'}
              className={`${navButtonClass} hidden xl:inline-flex`}
            >
              {railOpen ? '◧ Roster' : '◨ Roster'}
            </button>
            {hasNavigation && (
              <>
                <button
                  type="button"
                  onClick={() => canGoPrevious && navigationIds && goToPlayer(navigationIds[navIndex - 1])}
                  disabled={!canGoPrevious}
                  aria-label="Previous player"
                  title="Previous player (←)"
                  className={navButtonClass}
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={() => canGoNext && navigationIds && goToPlayer(navigationIds[navIndex + 1])}
                  disabled={!canGoNext}
                  aria-label="Next player"
                  title="Next player (→)"
                  className={navButtonClass}
                >
                  Next →
                </button>
              </>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closePlayerModal}
            aria-label="Close player profile"
            className="border border-slate-300/80 bg-white/85 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          {railOpen && (
            <div className="hidden xl:flex">
              <TeammateRail
                dynastyId={dynastyId}
                seasonId={seasonId}
                leagueTeamIndex={leagueTeamIndex}
                activePlayerId={activePlayerId}
                onPick={(id) => goToPlayer(id)}
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
            <div key={activePlayerId} className="content-enter">
              <PlayerProfileContent
                dynastyId={dynastyId}
                playerId={activePlayerId}
                seasonId={seasonId}
                fallback={fallback}
                leagueTeamIndex={leagueTeamIndex}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
