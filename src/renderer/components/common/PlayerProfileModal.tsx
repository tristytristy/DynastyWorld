import { useEffect, useMemo, useRef, useState } from 'react';
import { useScrollLock } from '../../lib/useScrollLock';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { PlayerProfileContent, type ProfileTab } from './PlayerProfileContent';
import { PlayerPortrait } from './PlayerPortrait';
import { positionSortIndex, unitForPosition } from '../../lib/rosterOrder';
import type { RosterPlayer } from '../../../shared/types';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

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
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Closed by default: the rail is a jump-to-teammate convenience, not part of
  // reading a player, and opening every profile with it already out pushed the
  // actual content sideways before you'd asked for anything.
  const [railOpen, setRailOpen] = useState(false);
  // Held HERE, not inside PlayerProfileContent, because the content is keyed on
  // the player id to animate the swap — that remount would reset an internal
  // tab to Overview every time you stepped to the next player. Reading a card
  // and pressing → should give you the next player's card.
  const [tab, setTab] = useState<ProfileTab>('overview');

  const isOpen = state !== null;
  const playerIdForEffect = state?.playerId;
  const dynastyIdForEffect = state?.dynastyId;

  useEffect(() => {
    if (dynastyIdForEffect && playerIdForEffect !== undefined) pushRecent(dynastyIdForEffect, playerIdForEffect);
  }, [dynastyIdForEffect, playerIdForEffect]);

  // Back to Overview when the modal is OPENED, but not when stepping between
  // players inside it — opening a fresh profile shouldn't inherit whatever tab
  // was left showing in a previous session.
  useEffect(() => {
    if (isOpen) setTab('overview');
  }, [isOpen]);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    /*
      Focus the PANEL, not the close button. Those are both valid trap entries,
      but focusing a control means it lands in its focused state on every single
      open — and with a bare glyph the browser's ring reads as a box drawn
      around the X, which is the bordered look this stopped being. Focusing the
      dialog itself also announces its own label rather than "Close …, button".
      Needs tabIndex={-1} to be programmatically focusable.
    */
    panelRef.current?.focus();

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
      // Shift+Arrow belongs to the team switcher (see TeamSwitcher). Without
      // this guard the same keystroke stepped a player here AND a team on the
      // page behind, since neither handler knew about the other.
      if (event.shiftKey) return;
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
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
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
        tabIndex={-1}
        className="corner-cut relative flex outline-none h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden modal-panel md:h-[calc(100vh-4rem)]"
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
          <ModalCloseButton label="player profile" onClick={closePlayerModal} />
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
          {/* overflow-HIDDEN, not auto. The scroll moved inside
              PlayerProfileContent so the masthead and the destination bar can
              stay put while only the destination scrolls; a second scroller out
              here would give the panel two scrollbars and let the whole profile
              drift under its own header again. */}
          <div className="min-h-0 flex-1 overflow-hidden p-5 md:p-6">
            <div key={activePlayerId} className="content-enter h-full">
              <PlayerProfileContent
                tab={tab}
                onTabChange={setTab}
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
    </ModalOverlay>
  );
}
