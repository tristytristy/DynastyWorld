import { useEffect, useMemo, useState } from 'react';
import { DashboardPanel } from './DashboardPanel';
import { HelmetImg } from '../common/HelmetImg';
import { useGameModal } from '../../data/GameModalProvider';
import { canonicalKey } from '../../lib/assetMapping';
import { eventLabel } from '../../lib/ncaaHubFormat';
import type { LeagueScoresView, NcaaHubGameFeature, StandingsOverview } from '../../../shared/types';

/**
 * The Game of the Week — the page's centrepiece, and the only surface here
 * that paints a panel rather than a header rule.
 *
 * Two facts it does NOT invent, both worth stating because a scoreboard is
 * exactly where an invented fact would be believed:
 *
 *  - **The broadcast.** The save stores a scope ("National" / "Streaming" /
 *    "TBD"), never a channel, so this prints the scope and no network mark.
 *  - **Team records.** `NcaaHubGameFeature` carries no record, so they are
 *    joined from the leaguewide standings snapshot; when that snapshot is
 *    absent (a history-only or pre-standings season) the records are simply
 *    left out rather than guessed from anywhere else.
 */

interface TeamRecord {
  wins: number;
  losses: number;
}

/** Records for every team in the country, keyed the same way team art is, so schedule-style names match standings names. */
function useRecordsByTeam(standings: StandingsOverview | null | undefined): Map<string, TeamRecord> {
  return useMemo(() => {
    const map = new Map<string, TeamRecord>();
    for (const group of standings?.groups ?? []) {
      for (const team of group.teams) {
        map.set(canonicalKey(team.teamName), { wins: team.overallWins, losses: team.overallLosses });
      }
    }
    return map;
  }, [standings]);
}

/**
 * The hub's game feature carries no `gameId` — it is built from the schedule
 * snapshot, while the modal is keyed on the leaguewide scoreboard's id. Rather
 * than bolt a duplicate identifier onto the feature type, the two are matched
 * on what they already share: the week and both team names, normalised through
 * the same key team art uses so "App St." and "Appalachian State" still meet.
 */
function useGameId(game: NcaaHubGameFeature | null, scores: LeagueScoresView | null | undefined): number | null {
  return useMemo(() => {
    if (!game || !scores) return null;
    const home = canonicalKey(game.homeTeamName);
    const away = canonicalKey(game.awayTeamName);
    const match = scores.games.find(
      (candidate) =>
        candidate.week === game.week &&
        canonicalKey(candidate.homeTeamName) === home &&
        canonicalKey(candidate.awayTeamName) === away,
    );
    return match?.gameId ?? null;
  }, [game, scores]);
}

/**
 * The two teams' real colours, for the glow behind each helmet — the same
 * staging the Game Info page uses, from the same source (`getGameDetail`
 * carries `primaryColor` per side; nothing lighter in the renderer holds
 * leaguewide team colours). One extra read, only once a game has actually been
 * matched, and the hero renders unlit rather than tinted with a guess if it
 * fails.
 */
function useSideColors(
  dynastyId: string,
  gameId: number | null,
  seasonId?: number,
): { away: string | null; home: string | null } {
  const [colors, setColors] = useState<{ away: string | null; home: string | null }>({ away: null, home: null });

  useEffect(() => {
    if (gameId === null) {
      setColors({ away: null, home: null });
      return;
    }
    let cancelled = false;
    window.api.db
      .getGameDetail(dynastyId, gameId, seasonId)
      .then((detail) => {
        if (cancelled) return;
        setColors({ away: detail?.away.primaryColor ?? null, home: detail?.home.primaryColor ?? null });
      })
      .catch(() => {
        if (!cancelled) setColors({ away: null, home: null });
      });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, gameId, seasonId]);

  return colors;
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) return null;
  return (
    <span className="tnum font-display text-xl font-bold text-[var(--team-accent-text)] sm:text-2xl">#{rank}</span>
  );
}

/**
 * A side's helmet, sized to HALF the hero and capped at 400px.
 *
 * The size is fluid rather than fixed because the browser's own
 * `img { max-width: 100% }` clamps an oversized helmet to its container anyway
 * — a fixed `w-[400px]` silently rendered at 302 inside a flex column. Giving
 * each side exactly half the hero (a 2-column grid, with the AT/FINAL divider
 * floated ON TOP rather than taking a third column) is what actually buys the
 * width; the cap then applies on a monitor wide enough to deserve it.
 */
function HelmetSlot({ teamName, side }: { teamName: string; side: 'left' | 'right' }) {
  return (
    /*
      Each slot reaches PAST its half by 28px so the two helmets close on the
      centre line — at full size they'd otherwise stop a helmet's width apart
      with the divider stranded in the gap. The overlap lands in the PNGs' own
      transparent padding, so the two never actually collide.
    */
    <div
      className={`flex min-w-0 justify-center ${
        side === 'left' ? '-mr-9 w-[calc(100%+2.25rem)]' : '-ml-9 w-[calc(100%+2.25rem)]'
      }`}
    >
      {/* Negative vertical margins keep the oversized box from adding height —
          they only eat the PNG's own transparent padding. */}
      <HelmetImg
        teamName={teamName}
        side={side}
        className="relative z-10 -my-6 h-auto w-full max-w-[400px] object-contain xl:-my-10 3xl:max-w-[470px] 4xl:max-w-[560px] 5xl:max-w-[620px]"
      />
    </div>
  );
}

function TeamInfo({
  teamName,
  rank,
  record,
  score,
  won,
}: {
  teamName: string;
  rank: number | null;
  record: TeamRecord | null;
  score: number | null;
  won: boolean;
}) {
  return (
    <div className="relative z-10 flex min-w-0 flex-col items-center gap-1 text-center">
      <div className="flex min-w-0 items-baseline gap-2">
        <RankBadge rank={rank} />
        <p
          className={`min-w-0 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl 4xl:text-4xl ${
            won ? 'text-slate-950 dark:text-white' : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {teamName}
        </p>
      </div>
      {record && (
        <p className="tnum text-sm font-medium text-slate-500 dark:text-slate-400">
          {record.wins}-{record.losses}
        </p>
      )}
      {score !== null && (
        <p
          className={`tnum font-display text-5xl leading-none sm:text-6xl 4xl:text-7xl ${
            won ? 'font-bold text-slate-950 dark:text-white' : 'font-semibold text-slate-500 dark:text-slate-400'
          }`}
        >
          {score}
        </p>
      )}
    </div>
  );
}

export function GameOfTheWeekHero({
  game,
  scores,
  standings,
  dynastyId,
  seasonId,
  loading,
}: {
  game: NcaaHubGameFeature | null;
  scores: LeagueScoresView | null | undefined;
  standings: StandingsOverview | null | undefined;
  dynastyId: string;
  seasonId?: number;
  loading: boolean;
}) {
  const { openGameModal } = useGameModal();
  const records = useRecordsByTeam(standings);
  const gameId = useGameId(game, scores);
  const sideColors = useSideColors(dynastyId, gameId, seasonId);

  if (loading) {
    return (
      <DashboardPanel title="Game of the Week">
        <div className="h-[300px] w-full animate-pulse bg-slate-200/50 dark:bg-white/[0.04]" aria-hidden="true" />
      </DashboardPanel>
    );
  }

  if (!game) {
    return (
      <DashboardPanel title="Game of the Week">
        <div className="flex h-[300px] w-full flex-col items-center justify-center border border-dashed border-slate-300/80 px-6 text-center dark:border-slate-700">
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            No national game has been played or scheduled in this snapshot yet. Sync again once the season is under way.
          </p>
        </div>
      </DashboardPanel>
    );
  }

  const played = game.homeScore !== null && game.awayScore !== null;
  const awayWon = played && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWon = played && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const meta = [game.date, game.dayOfWeek, game.kickoffTime !== 'TBD' ? game.kickoffTime : null]
    .filter((part) => part && part !== 'TBD')
    .join(' · ');
  const setting = game.isNeutralSite ? 'Neutral site' : `${game.awayTeamName} at ${game.homeTeamName}`;

  const label = played
    ? `Open Game of the Week: ${game.awayTeamName} ${game.awayScore}, ${game.homeTeamName} ${game.homeScore}`
    : `Open Game of the Week: ${game.awayTeamName} at ${game.homeTeamName}, ${meta || 'kickoff to be announced'}`;

  const body = (
    <>
      {/* A glow under EACH helmet in that team's own colour, the same staging
          the Game Info header uses — both sides always lit, so the hero doesn't
          read as half-finished. Absent entirely when the colours didn't
          resolve. */}
      {sideColors.away && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 80% at 18% 45%, color-mix(in srgb, ${sideColors.away} 26%, transparent), transparent 72%)`,
          }}
        />
      )}
      {sideColors.home && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(70% 80% at 82% 45%, color-mix(in srgb, ${sideColors.home} 26%, transparent), transparent 72%)`,
          }}
        />
      )}

      {/*
        Helmets and identities in two matching halves. The divider is absolutely
        centred OVER the helmet band instead of sitting between them as a third
        column: in flow it stole ~55px from the two things the eye is actually
        here for, and floating it lets each helmet own a clean half.
      */}
      <div className="relative">
        <div className="grid grid-cols-2 items-end">
          <HelmetSlot teamName={game.awayTeamName} side="left" />
          <HelmetSlot teamName={game.homeTeamName} side="right" />
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center justify-center gap-3">
          <span className="font-display text-sm font-bold uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">
            {game.isNeutralSite ? 'VS' : 'AT'}
          </span>
          <span aria-hidden="true" className="h-20 w-px bg-[var(--surface-raised-border)] sm:h-28" />
          <span
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              played ? 'text-rose-600 dark:text-rose-500' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {played ? 'Final' : 'Upcoming'}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <TeamInfo
            teamName={game.awayTeamName}
            rank={game.awayRank}
            record={records.get(canonicalKey(game.awayTeamName)) ?? null}
            score={game.awayScore}
            won={awayWon || !played}
          />
          <TeamInfo
            teamName={game.homeTeamName}
            rank={game.homeRank}
            record={records.get(canonicalKey(game.homeTeamName)) ?? null}
            score={game.homeScore}
            won={homeWon || !played}
          />
        </div>
      </div>

      <p className="relative mt-5 text-center text-base leading-7 text-slate-700 dark:text-slate-200 sm:text-lg 4xl:text-xl">
        {game.summary}
      </p>

      <div className="relative mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {meta && <span>{meta}</span>}
        <span>{setting}</span>
        {/* Scope, never a channel — the save has no network name to print. */}
        {game.broadcastScope && game.broadcastScope !== 'TBD' && <span>{game.broadcastScope}</span>}
      </div>
    </>
  );

  // The surface is the only filled panel on this page — the hero earns it; the
  // rest of the dashboard is separated by header rules, not boxes.
  // Tight side padding on purpose: every pixel here is a pixel off the helmets,
// which are the point of this panel. The centred text below has room regardless.
const surface = 'corner-cut relative w-full overflow-hidden bg-[var(--surface-raised)] px-3 py-6 sm:px-4 sm:py-8';

  return (
    <DashboardPanel
      title="Game of the Week"
      action={
        <span className="type-eyebrow truncate text-slate-400 dark:text-slate-500">
          Week {game.week} · {eventLabel(game)}
        </span>
      }
    >
      {gameId === null ? (
        // Nothing to open — the hero stays complete but doesn't pretend to be a
        // button (a season whose leaguewide scoreboard predates the schedule
        // snapshot the hub's game came from).
        <div className={surface}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={() => openGameModal(dynastyId, gameId, seasonId)}
          aria-label={label}
          className={`${surface} block text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:hover:bg-white/[0.04]`}
        >
          {body}
        </button>
      )}
    </DashboardPanel>
  );
}
