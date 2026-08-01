import { useEffect, useMemo, useState } from 'react';
import { InfoHint } from '../components/ui/InfoHint';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { Select } from '../components/ui/Select';
import { TeamLink } from '../components/common/TeamLink';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useGameModal } from '../data/GameModalProvider';
import { useTheme } from '../theme/ThemeProvider';
import { getRivalryLogoPath } from '../lib/rivalryAssetMapping';
import { getBowlLogoPath, getConferenceLogoPath, getPlayoffRoundImagePath } from '../lib/trophyAssetMapping';
import type { LeagueScoreGame, LeagueScoresView } from '../../shared/types';

/** Scope options that aren't a conference. */
const ALL = 'all';
const TOP25 = 'top25';
const UPSETS = 'upsets';

function ScoreLine({
  name,
  teamIndex,
  score,
  won,
  played,
  rank,
}: {
  name: string;
  teamIndex: number;
  score: number | null;
  won: boolean;
  played: boolean;
  rank: number | null;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${won ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {/* The rank sits before the mark, the way a scoreboard writes it. */}
        {rank !== null && (
          <span className="tnum shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{rank}</span>
        )}
        <TeamLink teamIndex={teamIndex} teamName={name} size="sm" className="min-w-0" logoClassName="shrink-0" nameClassName="truncate" />
      </div>
      <span className="proportional-nums shrink-0">{played ? score : '—'}</span>
    </div>
  );
}

/**
 * The badge strip above a score: what KIND of game this was.
 *
 * Priority is deliberate, because a game can be several of these at once and
 * only the biggest one is worth the space — a national championship is not
 * usefully also labelled "bowl", and a conference title game is not usefully
 * also labelled by conference. Rivalry sits above conference for the same
 * reason: "Iron Bowl" tells you more than "SEC".
 */
function GameBadge({ game }: { game: LeagueScoreGame }) {
  const { appearance } = useTheme();
  const rivalry = getRivalryLogoPath(game.awayTeamName, game.homeTeamName);
  const playoff = game.bowlName ? getPlayoffRoundImagePath(game.bowlName) : null;
  const bowl = game.isBowlGame ? getBowlLogoPath(game.bowlAssetName) : null;
  // Only badge a conference when BOTH sides share one — an out-of-conference
  // game has no single conference to speak for it.
  const sharedConference =
    game.homeConference && game.homeConference === game.awayConference ? game.homeConference : null;
  const conference = sharedConference ? getConferenceLogoPath(sharedConference, appearance) : null;

  const badge = game.isNationalChampionship
    ? { src: playoff ?? bowl, label: game.bowlName ?? 'National Championship' }
    : playoff
      ? { src: playoff, label: game.bowlName ?? 'Playoff' }
      : bowl
        ? { src: bowl, label: game.bowlName ?? 'Bowl' }
        : rivalry
          ? { src: rivalry, label: 'Rivalry' }
          : conference
            ? { src: conference, label: sharedConference as string }
            : null;

  if (!badge) return null;
  return (
    <div className="flex items-center gap-1.5">
      {badge.src && <img src={badge.src} alt="" aria-hidden className="h-4 w-4 shrink-0 object-contain" loading="lazy" />}
      <span className="type-eyebrow truncate text-[var(--team-primary)]">{badge.label}</span>
    </div>
  );
}

export function Scores() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const { openGameModal } = useGameModal();
  const [view, setView] = useState<LeagueScoresView | null | undefined>(undefined);
  const [pickedWeek, setPickedWeek] = useState<number | null>(null);
  const [scope, setScope] = useState<string>(ALL);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setView(undefined);
    setPickedWeek(null);
    window.api.db.getLeagueScores(id, seasonId).then((result) => {
      if (!cancelled) setView(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const games = view?.games;
  const weeks = useMemo(() => [...new Set((games ?? []).map((g) => g.week))].sort((a, b) => a - b), [games]);
  // Default to the latest week that actually has a played game (most recent
  // action), falling back to the first week if nothing's been played.
  const defaultWeek = useMemo(() => {
    const played = (games ?? []).filter((g) => g.homeScore !== null);
    if (played.length) return Math.max(...played.map((g) => g.week));
    return weeks[0] ?? null;
  }, [games, weeks]);
  const activeWeek = pickedWeek ?? defaultWeek;

  if (!id) return null;
  if (view === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading scores...</p>;
  if (view === null || !games) {
    return (
      <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
        No league schedule for this season — re-sync this dynasty to capture it.
      </SurfaceCard>
    );
  }

  const heldWeek = view.heldWeek;
  const inWeek = games.filter((g) => g.week === activeWeek);

  /*
    UPSET = a ranked team beaten by an unranked one. Both halves matter: without
    the "unranked winner" half, every #3-over-#1 result would count, which is a
    result, not an upset.

    The ranks are the poll as of the sync (see getLeagueScores), so on a
    finished season this reads against the final poll. That is the honest basis
    after the fact, and the label says "by final poll" rather than pretending
    the number was live at kickoff.
  */
  const isUpset = (g: LeagueScoreGame) => {
    if (g.homeScore === null || g.awayScore === null) return false;
    const homeWon = g.homeScore > g.awayScore;
    const winnerRank = homeWon ? g.homeRank : g.awayRank;
    const loserRank = homeWon ? g.awayRank : g.homeRank;
    return winnerRank === null && loserRank !== null;
  };

  // Only conferences with a game this week; an empty option is a dead end.
  const conferences = [
    ...new Set(inWeek.flatMap((g) => [g.homeConference, g.awayConference]).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b));

  const weekGames = inWeek.filter((g) => {
    if (scope === ALL) return true;
    if (scope === TOP25) return g.homeRank !== null || g.awayRank !== null;
    if (scope === UPSETS) return isUpset(g);
    // Anything else is a conference name: a game counts if EITHER side is in it,
    // so a conference's out-of-conference slate stays visible on its own filter.
    return g.homeConference === scope || g.awayConference === scope;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            <span>Scores</span>
            <InfoHint label="About scores">Every game in the country — click any for the full box score.</InfoHint>
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scope}
            onChange={setScope}
            ariaLabel="Which games"
            options={[
              { value: ALL, label: `All NCAA (${inWeek.length})` },
              { value: TOP25, label: `Top 25 (${inWeek.filter((g) => g.homeRank !== null || g.awayRank !== null).length})` },
              { value: UPSETS, label: `Upsets (${inWeek.filter(isUpset).length})` },
              ...conferences.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            value={String(activeWeek ?? '')}
            onChange={(next) => setPickedWeek(Number(next))}
            ariaLabel="Week"
            options={weeks.map((w) => ({ value: String(w), label: `Week ${w}` }))}
          />
        </div>
      </div>

      {scope === UPSETS && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          An unranked team beating a ranked one, measured against the poll as it stood at your last sync — a save
          keeps only the current poll, not a week-by-week history.
        </p>
      )}

      {heldWeek !== null && activeWeek !== null && activeWeek >= heldWeek && (
        <div className="corner-cut-sm border border-slate-200/80 bg-slate-100/70 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">Week {heldWeek} results are on hold.</span>{' '}
          The save already has the rest of the country&rsquo;s scores, but the game keeps them hidden until you play your
          own game — so the hub does too. Play it, then sync again.
        </div>
      )}

      {weekGames.length === 0 ? (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
          {scope === ALL ? 'No games this week.' : 'No games this week match that filter.'}
        </SurfaceCard>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {weekGames.map((g) => {
            const played = g.homeScore !== null && g.awayScore !== null;
            const awayWon = played && (g.awayScore ?? 0) > (g.homeScore ?? 0);
            const homeWon = played && (g.homeScore ?? 0) > (g.awayScore ?? 0);
            return (
              <div
                key={g.gameId}
                role="button"
                tabIndex={0}
                onClick={() => openGameModal(id, g.gameId, seasonId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openGameModal(id, g.gameId, seasonId);
                  }
                }}
                className="flex cursor-pointer flex-col gap-1.5 border border-slate-200/80 bg-white/70 p-3.5 text-left text-sm transition hover:border-slate-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
              >
                <GameBadge game={g} />
                <ScoreLine name={g.awayTeamName} teamIndex={g.awayTeamIndex} score={g.awayScore} won={awayWon} played={played} rank={g.awayRank} />
                <ScoreLine name={g.homeTeamName} teamIndex={g.homeTeamIndex} score={g.homeScore} won={homeWon} played={played} rank={g.homeRank} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
