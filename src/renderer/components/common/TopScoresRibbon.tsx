import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TeamLogo } from './TeamLogo';
import { useGameModal } from '../../data/GameModalProvider';
import type { LeagueScoreGame, LeagueScoresView } from '../../../shared/types';

/**
 * The national scoreboard strip that opens the NCAA Hub — one week of
 * leaguewide results in a single broadcast-style rail, every tile opening the
 * same Game Info modal the Scores page uses.
 *
 * It is a READER of `getLeagueScores`, nothing more: no score, rank, or status
 * is derived here that the scoreboard page wouldn't also show. That includes
 * the results hold — the save pre-simulates the rest of the country's current
 * week before the game reveals it, and `heldWeek` marks it, so the rail never
 * picks that week (see `pickWeek`).
 */

/**
 * The tile width, mirroring the `w-[190px]` class on the tile itself — it
 * exists here only so an arrow press scrolls by whole tiles rather than an
 * arbitrary pixel count.
 *
 * ONE WIDTH AT EVERY WINDOW SIZE, deliberately. A narrower tile was tried and
 * reverted: at 172px the abbreviations themselves started truncating ("TENN" ->
 * "TE…"), which defeats the point of using the save's own short names. The app
 * enforces a 1024px minimum window (main.ts MIN_WIDTH), and 190px still leaves
 * four games visible there, so the narrow case is handled by tightening the
 * label block instead — the one part of the strip with slack in it.
 */
const TILE_W = 190;

/**
 * Auto-scroll: pixels per second, and how long the rail sits still at each end
 * before rewinding. Slow on purpose — this is a ticker you read past, not a
 * carousel demanding attention.
 */
const AUTO_SCROLL_PX_PER_SEC = 22;
const END_PAUSE_MS = 2000;

interface WeekSelection {
  week: number;
  games: LeagueScoreGame[];
  /** False when the only games available are still to be played — the rail then shows kickoff-pending tiles rather than fake results. */
  played: boolean;
}

function isComplete(game: LeagueScoreGame): boolean {
  return game.homeScore !== null && game.awayScore !== null;
}

/**
 * An unranked team beating a ranked one — the same definition the Scores page
 * filter uses, measured against the poll as of the sync (a save carries no
 * week-by-week poll history to measure against instead).
 */
function isUpset(game: LeagueScoreGame): boolean {
  if (!isComplete(game)) return false;
  const homeWon = (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const winnerRank = homeWon ? game.homeRank : game.awayRank;
  const loserRank = homeWon ? game.awayRank : game.homeRank;
  return winnerRank === null && loserRank !== null;
}

/**
 * How nationally interesting a game is, low to high priority. An upset sits
 * INSIDE the one-ranked band rather than after it — every upset involves
 * exactly one ranked team by definition, and it's the most newsworthy kind of
 * game in that band, so it leads it.
 */
function newsTier(game: LeagueScoreGame): number {
  const ranked = Number(game.homeRank !== null) + Number(game.awayRank !== null);
  if (ranked === 2) return 0;
  if (ranked === 1) return isUpset(game) ? 1 : 2;
  return 3;
}

/** Best (lowest) rank in the game, for ordering within a tier. */
function bestRank(game: LeagueScoreGame): number {
  const ranks = [game.homeRank, game.awayRank].filter((rank): rank is number => rank !== null);
  return ranks.length ? Math.min(...ranks) : 99;
}

/**
 * The week the rail shows: the most recent one whose results are actually
 * revealed. Weeks at or past `heldWeek` are skipped even when the user's own
 * game in them has a score — a strip captioned "WEEK 10" showing one game
 * would misrepresent a week the app is deliberately withholding.
 *
 * With nothing played yet (a fresh preseason save), it falls back to the
 * earliest scheduled week so the rail previews the opening slate instead of
 * disappearing.
 */
function pickWeek(view: LeagueScoresView): WeekSelection | null {
  const revealed = view.games.filter(
    (game) => isComplete(game) && (view.heldWeek === null || game.week < view.heldWeek),
  );
  if (revealed.length > 0) {
    const week = Math.max(...revealed.map((game) => game.week));
    return { week, games: revealed.filter((game) => game.week === week), played: true };
  }

  if (view.games.length === 0) return null;
  const week = Math.min(...view.games.map((game) => game.week));
  return { week, games: view.games.filter((game) => game.week === week), played: false };
}

function orderGames(games: LeagueScoreGame[]): LeagueScoreGame[] {
  // gameId last, always: without a total order the tiles reshuffle between
  // renders whenever two games tie on every other key.
  return [...games].sort(
    (a, b) => newsTier(a) - newsTier(b) || bestRank(a) - bestRank(b) || a.gameId - b.gameId,
  );
}

function ChevronIcon({ left = false }: { left?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TeamRow({
  name,
  shortName,
  rank,
  score,
  won,
  played,
}: {
  name: string;
  /** The save's own abbreviation; the display name is the fallback and gets truncated. */
  shortName: string | null;
  rank: number | null;
  score: number | null;
  won: boolean;
  played: boolean;
}) {
  // Weight and brightness carry the winner, not hue — the losing side stays at
  // readable contrast rather than being greyed out of legibility.
  const tone = !played
    ? 'text-slate-600 dark:text-slate-300'
    : won
      ? 'font-semibold text-slate-950 dark:text-white'
      : 'text-slate-500 dark:text-slate-400';

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${tone}`}>
      <TeamLogo
        team={{ assetName: name, label: name }}
        size="sm"
        className="!h-[18px] !w-[18px] shrink-0"
      />
      {/* Fixed-width rank cell so ranked and unranked rows keep the same left edge. */}
      <span className="tnum w-3.5 shrink-0 text-right text-[10px] font-semibold leading-none text-slate-400 dark:text-slate-500">
        {rank ?? ''}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[11px] uppercase tracking-[0.06em]"
        title={name}
      >
        {shortName ?? name}
      </span>
      <span className="tnum w-6 shrink-0 text-right text-sm leading-none">
        {played ? score : '—'}
      </span>
    </div>
  );
}

function GameTile({ game, onOpen }: { game: LeagueScoreGame; onOpen: (gameId: number) => void }) {
  const complete = isComplete(game);
  const awayWon = complete && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWon = complete && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const status = complete ? 'Final' : 'Upcoming';
  const label = complete
    ? `Open final score: ${game.awayTeamName} ${game.awayScore}, ${game.homeTeamName} ${game.homeScore}`
    : `Open upcoming game: ${game.awayTeamName} at ${game.homeTeamName}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(game.gameId)}
      aria-label={label}
      className="group relative flex h-full w-[190px] shrink-0 items-center gap-2 border-l border-[var(--surface-raised-border)] px-3 text-left transition-colors first:border-l-0 hover:bg-slate-100/70 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:hover:bg-white/[0.06]"
    >
      {/* The hover accent sits on the tile's own bottom edge — no lift, no
          scale, so neighbouring tiles never shift under the cursor. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--team-primary)] opacity-0 transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <TeamRow
          name={game.awayTeamName}
          shortName={game.awayShortName}
          rank={game.awayRank}
          score={game.awayScore}
          won={awayWon}
          played={complete}
        />
        <TeamRow
          name={game.homeTeamName}
          shortName={game.homeShortName}
          rank={game.homeRank}
          score={game.homeScore}
          won={homeWon}
          played={complete}
        />
      </div>
      <span
        className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.16em] ${
          complete ? 'text-rose-600 dark:text-rose-500' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        {status}
      </span>
    </button>
  );
}

/**
 * `view` is PASSED IN rather than fetched here. The ribbon and the dashboard
 * below it both read the same leaguewide scoreboard, and fetching it in each
 * meant two identical IPC round trips per page load — the full season's games,
 * twice — plus two independent loading states for one dataset. The dashboard's
 * data hook owns the request now and hands the result down; this component is
 * purely a reader of it, which is also what makes it testable.
 */
export function TopScoresRibbon({
  view,
  dynastyId,
  seasonId,
}: {
  view: LeagueScoresView | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const { openGameModal } = useGameModal();
  const railRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const selection = useMemo(() => (view ? pickWeek(view) : null), [view]);
  const games = useMemo(() => (selection ? orderGames(selection.games) : []), [selection]);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    // 1px of slack: sub-pixel layout leaves scrollLeft a hair short of the end,
    // which would otherwise keep the right arrow enabled on a rail already at
    // its limit.
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, games.length]);

  /*
    AUTO-SCROLL, paused whenever the user is anywhere near it.

    `paused` is a ref rather than state on purpose: it flips on hover, focus and
    manual scrolling, and re-rendering the whole rail on a mouse-over would be
    a lot of work to change nothing visible.

    Held still by: the pointer being over the ribbon, keyboard focus inside it
    (someone tabbing the tiles should not have them slide away), a manual
    wheel/drag for a few seconds afterwards, and `prefers-reduced-motion`, which
    switches the whole thing off rather than merely slowing it.
  */
  const paused = useRef(false);
  const manualUntil = useRef(0);
  const holdUntil = useRef(0);

  /*
    Native listeners rather than React's `onPointerEnter`/`onFocus` props:
    React derives enter/leave from delegated `pointerover`/`pointerout` at the
    root, which is correct for a real mouse but makes the behaviour awkward to
    assert against. Bound directly, "the pointer is over the ribbon" means
    exactly that.
  */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const hold = () => {
      paused.current = true;
    };
    const release = () => {
      paused.current = false;
    };
    el.addEventListener('pointerenter', hold);
    el.addEventListener('pointerleave', release);
    el.addEventListener('focusin', hold);
    el.addEventListener('focusout', release);
    return () => {
      el.removeEventListener('pointerenter', hold);
      el.removeEventListener('pointerleave', release);
      el.removeEventListener('focusin', hold);
      el.removeEventListener('focusout', release);
    };
  }, [games.length]);

  useEffect(() => {
    const el = railRef.current;
    if (!el || games.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let last = performance.now();
    // Fractional position kept here because scrollLeft rounds, and 22px/s would
    // otherwise round to zero every frame and never move at all.
    let position = el.scrollLeft;

    const step = (now: number) => {
      const elapsed = now - last;
      last = now;
      frame = requestAnimationFrame(step);

      const limit = el.scrollWidth - el.clientWidth;
      if (limit <= 0 || paused.current || now < manualUntil.current || now < holdUntil.current) {
        position = el.scrollLeft;
        return;
      }

      position += (AUTO_SCROLL_PX_PER_SEC * elapsed) / 1000;
      if (position >= limit) {
        // Rewind rather than reverse: a scoreboard that runs backwards reads as
        // a glitch. The pause at each end is what keeps the jump from feeling
        // like one.
        position = 0;
        holdUntil.current = now + END_PAUSE_MS;
        el.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }
      el.scrollLeft = position;
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [games.length]);

  const holdForManualInput = () => {
    manualUntil.current = performance.now() + 4000;
  };

  const scrollByTiles = (direction: -1 | 1) => {
    holdForManualInput();
    const el = railRef.current;
    if (!el) return;
    // CSS `scroll-behavior` is clamped globally under reduced motion, but a
    // scripted smooth scroll isn't — so the preference is checked here too.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direction * TILE_W * 2, behavior: reduced ? 'auto' : 'smooth' });
  };

  // Reserved height while loading so the hero below doesn't jump up and then
  // back down once the scores land.
  if (view === undefined) {
    return (
      <div
        className="corner-cut-sm h-[88px] w-full animate-pulse border border-[var(--surface-raised-border)] bg-[var(--surface-raised)]"
        aria-hidden="true"
      />
    );
  }

  // Nothing to show is nothing at all — an empty strip reads as a broken
  // feature, and a season synced before the league schedule existed has no
  // scoreboard to draw.
  if (view === null || !selection || games.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      aria-label={
        selection.played
          ? `Top scores, week ${selection.week}`
          : `Week ${selection.week} slate, not yet played`
      }
      className="corner-cut-sm relative flex h-[88px] w-full min-w-0 items-stretch border border-[var(--surface-raised-border)] bg-[var(--surface-raised)]"
    >
      {/* No vertical accent bar here: side accent lines are not part of this
          app's language (user direction 2026-08-03). The label block is set
          apart by its type and the separator to its right, nothing more. */}
      <div className="relative flex w-[152px] shrink-0 flex-col justify-center px-4 max-[1200px]:w-[120px] max-[1200px]:px-3">
        <p className="font-display text-[15px] font-bold uppercase leading-tight tracking-[0.18em] text-slate-950 dark:text-white max-[1200px]:text-[13px] max-[1200px]:tracking-[0.12em]">
          Top Scores
        </p>
        <p className="type-eyebrow mt-1 text-slate-400 dark:text-slate-500">
          Week {selection.week}
        </p>
      </div>

      <div className="relative min-w-0 flex-1 border-l border-[var(--surface-raised-border)]">
        <div
          ref={railRef}
          onScroll={measure}
          onWheel={holdForManualInput}
          onPointerDown={holdForManualInput}
          className="score-rail flex h-full items-stretch"
        >
          {games.map((game) => (
            <GameTile
              key={game.gameId}
              game={game}
              onOpen={(gameId) => openGameModal(dynastyId, gameId, seasonId)}
            />
          ))}
        </div>

        {/* Fades and arrows are siblings of the rail, not children — inside it
            they would scroll away with the tiles. */}
        {canLeft && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-[linear-gradient(to_right,var(--surface-raised),transparent)]"
          />
        )}
        {canRight && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-[linear-gradient(to_left,var(--surface-raised),transparent)]"
          />
        )}

        <button
          type="button"
          onClick={() => scrollByTiles(-1)}
          disabled={!canLeft}
          aria-label="Scroll scores left"
          className="absolute left-0 top-1/2 flex h-8 w-7 -translate-y-1/2 items-center justify-center border-y border-r border-[var(--surface-raised-border)] bg-[var(--surface-raised)] text-slate-500 transition enabled:hover:text-slate-900 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:text-slate-400 dark:enabled:hover:text-white"
        >
          <ChevronIcon left />
        </button>
        <button
          type="button"
          onClick={() => scrollByTiles(1)}
          disabled={!canRight}
          aria-label="Scroll scores right"
          className="absolute right-0 top-1/2 flex h-8 w-7 -translate-y-1/2 items-center justify-center border-y border-l border-[var(--surface-raised-border)] bg-[var(--surface-raised)] text-slate-500 transition enabled:hover:text-slate-900 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:text-slate-400 dark:enabled:hover:text-white"
        >
          <ChevronIcon />
        </button>
      </div>
    </section>
  );
}
