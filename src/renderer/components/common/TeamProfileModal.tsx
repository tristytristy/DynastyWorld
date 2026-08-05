import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useScrollLock } from '../../lib/useScrollLock';
import { useTeamModal } from '../../data/TeamModalProvider';
import { useViewedTeam } from '../../data/ViewedTeamProvider';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { TeamLogo } from './TeamLogo';
import { TeamLink } from './TeamLink';
import { PlayerPortrait } from './PlayerPortrait';
import { aggregateTeamGames, perGame as perGameAvg, ratioPct, turnoverMargin } from '../../lib/teamStats';
import { DARK_SURFACE_HEX, LIGHT_SURFACE_HEX, ensureContrastText, textColorOn } from '../../lib/teamTheme';
import { useTheme } from '../../theme/ThemeProvider';
import type { GameSummary, TeamCard, TeamCardPlayer } from '../../../shared/types';
import { ModalOverlay } from './ModalOverlay';
import { ModalCloseButton } from './ModalCloseButton';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-[10px] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="proportional-nums mt-0.5 text-lg font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function GameCard({ label, game }: { label: string; game: GameSummary | undefined }) {
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-[10px] text-slate-400 dark:text-slate-500">{label}</p>
      {!game ? (
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">—</p>
      ) : (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
            <span className="shrink-0 text-slate-400 dark:text-slate-500">{game.isHome ? 'vs' : '@'}</span>
            <TeamLink teamName={game.opponent} size="sm" logoClassName="!h-5 !w-5" nameClassName="truncate" />
          </span>
          {game.result ? (
            <span
              className={`tnum shrink-0 text-sm font-semibold ${
                game.result === 'W'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : game.result === 'L'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {game.result} {game.teamScore}-{game.opponentScore}
            </span>
          ) : (
            <span className="tnum shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">Wk {game.week}</span>
          )}
        </div>
      )}
    </div>
  );
}

function BestPlayerRow({
  player,
  teamAssetName,
  onOpen,
}: {
  player: TeamCardPlayer;
  teamAssetName: string | null;
  onOpen: (playerId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(player.id)}
      className="corner-cut-sm flex w-full items-center gap-3 border border-slate-200/80 bg-slate-50/85 p-2.5 text-left transition hover:border-[color:var(--card-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <PlayerPortrait player={player} size="sm" className="!h-9 !w-9" teamAssetName={teamAssetName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {player.firstName} {player.lastName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {player.position} #{player.jerseyNumber}
        </p>
      </div>
      <span className="type-stat-md shrink-0 text-slate-950 dark:text-white">{player.overallRating}</span>
    </button>
  );
}

function TeamCardBody({ card, onViewHub }: { card: TeamCard; onViewHub: () => void }) {
  const { openPlayerModal } = usePlayerModal();
  const { overview, topPlayers } = card;
  const { appearance } = useTheme();
  /*
    THE VIEWED team's colours, not the user's. Everything painted below uses
    this team's fill, so the text on top of it has to be computed from THIS
    hex — the modal used to paint a team's colour and then take its text colour
    from `--team-on-primary`, which is the user's own dynasty theme, so a navy
    team's button inherited near-black text from a pale-primary dynasty.
  */
  const primaryHex = card.primaryColorHex ?? null;
  const primary = primaryHex ?? 'var(--team-primary)';
  const onPrimary = primaryHex ? textColorOn(primaryHex) : 'var(--team-on-primary)';
  // Contrast-corrected against the page ground, for the team colour used as TEXT
  // rather than as a fill (a dark navy on a dark surface is unreadable as-is).
  const accentText = primaryHex
    ? ensureContrastText(primaryHex, appearance === 'dark' ? DARK_SURFACE_HEX : LIGHT_SURFACE_HEX)
    : 'var(--team-accent-text)';

  const played = card.games.filter((g) => g.played);
  const agg = aggregateTeamGames(played);
  const gp = agg.games;
  const num = (v: number) => (gp > 0 ? Math.round(perGameAvg(v, gp)).toLocaleString() : '—');
  const dec = (v: number) => (gp > 0 ? perGameAvg(v, gp).toFixed(1) : '—');
  const margin = turnoverMargin(agg);
  const third = ratioPct(agg.thirdDownConv, agg.thirdDownAtt);
  const rank = overview.rankings.cfp ?? overview.rankings.media ?? overview.rankings.coaches ?? null;

  return (
    <div style={{ ['--card-primary' as string]: primary }} className="flex flex-col">
      {/* Header — team-color wash */}
      <div
        className="relative flex items-center gap-4 border-b border-slate-200/80 px-5 py-5 dark:border-white/10"
        style={{ backgroundImage: `linear-gradient(120deg, color-mix(in srgb, ${primary} 18%, transparent), transparent 60%)` }}
      >
        <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            {card.conferenceName ?? 'Independent'} · {overview.seasonYear}
          </p>
          <h2 className="type-page-title truncate text-slate-950 dark:text-white">{overview.teamName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="tnum font-semibold text-slate-800 dark:text-slate-100">
              {overview.record.wins}-{overview.record.losses}
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              ({overview.conferenceRecord.wins}-{overview.conferenceRecord.losses} conf)
            </span>
            {rank != null && (
              <span
                className="corner-cut-sm px-2 py-0.5 text-xs font-semibold"
                style={{ background: `color-mix(in srgb, ${primary} 16%, transparent)`, color: accentText }}
              >
                #{rank}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatTile label="Points / G" value={dec(agg.points)} />
          <StatTile label="Total Off / G" value={num(agg.offenseYards)} />
          <StatTile label="Total Def / G" value={num(agg.defTotalYards)} />
          <StatTile label="Turnover Margin" value={`${margin > 0 ? '+' : ''}${margin}`} />
          <StatTile label="3rd Down %" value={third === null ? '—' : `${third.toFixed(1)}%`} />
          <StatTile label="Games" value={String(gp)} />
        </div>

        {/* Recent + next */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <GameCard label="Last game" game={overview.recentGames[0]} />
          <GameCard label="Next game" game={overview.upcomingGames[0]} />
        </div>

        {/* Best players */}
        {topPlayers.length > 0 && (
          <div>
            <p className="type-eyebrow mb-2 text-slate-400 dark:text-slate-500">Top players</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {topPlayers.map((p) => (
                <BestPlayerRow
                  key={p.id}
                  player={p}
                  teamAssetName={card.teamAssetName ?? overview.teamName}
                  onOpen={(id) => openPlayerModal(card.overview.dynastyId, id, undefined, undefined, undefined, card.teamIndex)}
                />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={onViewHub}
          className="corner-cut-sm w-full px-4 py-3 text-sm font-semibold transition hover:brightness-110"
          style={{ background: primary, color: onPrimary }}
        >
          View Team Hub →
        </button>
      </div>
    </div>
  );
}

/**
 * The single global team-profile modal — the team counterpart to
 * PlayerProfileModal. Mounted once inside DynastyLayout (so its "View Team Hub"
 * button can drive setViewedTeamIndex + the router), driven by TeamModalProvider.
 * Layers over the current page, traps focus, closes on Escape / backdrop / Close.
 */
export function TeamProfileModal() {
  const { state, closeTeamModal } = useTeamModal();
  const { setViewedTeamIndex } = useViewedTeam();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [card, setCard] = useState<TeamCard | null | undefined>(undefined);

  const isOpen = state !== null;
  const dynastyId = state?.dynastyId;
  const teamIndex = state?.teamIndex;
  const seasonId = state?.seasonId;

  useEffect(() => {
    if (!isOpen || dynastyId === undefined || teamIndex === undefined) return;
    let cancelled = false;
    setCard(undefined);
    window.api.db.getTeamCard(dynastyId, teamIndex, seasonId).then((result) => {
      if (!cancelled) setCard(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, dynastyId, teamIndex, seasonId]);

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
        closeTeamModal();
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
  }, [isOpen, closeTeamModal]);

  if (!state) return null;

  const onViewHub = () => {
    setViewedTeamIndex(state.teamIndex);
    navigate(`/dynasty/${state.dynastyId}/team-hub`);
    closeTeamModal();
  };

  // Portaled to document.body so its fixed positioning is viewport-relative:
  // the host mounts inside DynastyLayout's <main>, whose backdrop-blur creates a
  // containing block that would otherwise anchor the overlay to the panel (and
  // push it low). The React tree is unchanged, so ViewedTeam/router context for
  // the "View Team Hub" button still resolves.
  return createPortal(
    <ModalOverlay
      className="modal-scrim fixed inset-0 flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-8"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeTeamModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Team profile"
        tabIndex={-1}
        className="corner-cut relative flex outline-none max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden modal-panel md:max-h-[calc(100vh-4rem)]"
      >
        <ModalCloseButton
          label="team profile"
          onClick={closeTeamModal}
          className="absolute right-3 top-3 z-10"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {card === undefined && <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading team…</p>}
          {card === null && <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No data for this team.</p>}
          {card && (
            <div className="content-enter">
              <TeamCardBody card={card} onViewHub={onViewHub} />
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>,
    document.body,
  );
}
