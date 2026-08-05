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
import {
  getBowlLogoPath,
  getConferenceChampionshipGamePath,
  getConferenceLogoPath,
  getNationalChampionshipTrophyPath,
  getPlayoffRoundImagePath,
} from '../lib/trophyAssetMapping';
import { conferenceChampionshipWeek } from '../../shared/championshipWeek';
import { getCfpBowlImagePath } from '../lib/scheduleFormat';
import type { LeagueScoreGame, LeagueScoresView } from '../../shared/types';

/** Scope options that aren't a conference. */
const ALL = 'all';
const TOP25 = 'top25';
const UPSETS = 'upsets';

/**
 * One side of a matchup. The SCORE is not in here: the card lays out as three
 * columns — teams, the game's mark, scores — so the mark can sit between the
 * names and the numbers the way a broadcast graphic does. Keeping the score
 * with the name would have forced the mark to overlay the row instead, where a
 * long team name runs straight under it.
 */
function TeamRow({
  name,
  teamIndex,
  won,
  rank,
}: {
  name: string;
  teamIndex: number;
  won: boolean;
  rank: number | null;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${won ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
      {/* Fixed width so both rows' marks line up whether or not a team is ranked. */}
      <span className="tnum w-5 shrink-0 text-right text-xs font-semibold text-slate-400 dark:text-slate-500">
        {rank ?? ''}
      </span>
      <TeamLink teamIndex={teamIndex} teamName={name} size="sm" className="min-w-0" logoClassName="shrink-0" nameClassName="truncate" />
    </div>
  );
}

/**
 * The mark that identifies a game, sized to be seen.
 *
 * This was a 16px logo with the conference name in text beside it, which is a
 * caption, not an identity — and printing "SEC" above an SEC-vs-SEC game says
 * nothing the two team marks don't already. It's now the artwork alone, large
 * and centred between the names and the scores.
 *
 * Priority is by size of occasion, because a game can be several of these at
 * once and only the biggest earns the space: a national championship is not
 * usefully also badged "bowl", and a conference title game is not usefully
 * badged with the plain conference mark.
 */
function GameMark({ game, championshipWeek }: { game: LeagueScoreGame; championshipWeek: number | null }) {
  const { appearance } = useTheme();

  // Both sides in the same conference in the final regular-season week is a
  // title game — the save gives these no week type of their own, so the week is
  // derived (see shared/championshipWeek.ts).
  const sharedConference =
    game.homeConference && game.homeConference === game.awayConference ? game.homeConference : null;
  const isConferenceTitle =
    sharedConference !== null && championshipWeek !== null && game.week === championshipWeek && !game.isBowlGame;

  const src = game.isNationalChampionship
    ? // The trophy, not the CFP event mark — this is the game everything was for.
      getNationalChampionshipTrophyPath()
    : game.bowlName && getPlayoffRoundImagePath(game.bowlName)
      ? getPlayoffRoundImagePath(game.bowlName)
      : game.isBowlGame
        ? getBowlLogoPath(game.bowlAssetName)
        : isConferenceTitle
          ? getConferenceChampionshipGamePath(sharedConference)
          : getRivalryLogoPath(game.awayTeamName, game.homeTeamName) ??
            (sharedConference ? getConferenceLogoPath(sharedConference, appearance) : null);

  /*
    A playoff quarterfinal or semifinal carries TWO marks: the CFP round graphic
    saying how deep into the bracket this is, and the bowl's own logo saying
    which trophy is on the table. Neither answers the other's question, so the
    bowl sits beside the round rather than replacing it.
  */
  const bowlSrc = getCfpBowlImagePath({
    gameType: game.isBowlGame ? 'bowl' : 'non-conference',
    conferenceName: null,
    isNationalChampionship: game.isNationalChampionship,
    isConferenceChampionship: false,
    bowlName: game.bowlName,
    bowlAssetName: game.bowlAssetName,
    neutralVenueId: game.neutralVenueId,
  });

  if (!src) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <img src={src} alt="" aria-hidden loading="lazy" className="h-12 w-12 shrink-0 object-contain" />
      {bowlSrc && (
        <img src={bowlSrc} alt="" aria-hidden loading="lazy" className="h-10 w-10 shrink-0 object-contain" />
      )}
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
  // Derived from the FULL season, not this week — the last regular-season week
  // is only knowable with every week in hand.
  const championshipWeek = conferenceChampionshipWeek(games);

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
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 5xl:grid-cols-5">
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
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <TeamRow name={g.awayTeamName} teamIndex={g.awayTeamIndex} won={awayWon} rank={g.awayRank} />
                    <TeamRow name={g.homeTeamName} teamIndex={g.homeTeamIndex} won={homeWon} rank={g.homeRank} />
                  </div>
                  <GameMark game={g} championshipWeek={championshipWeek} />
                  <div className="flex shrink-0 flex-col items-end gap-1.5 proportional-nums">
                    <span className={awayWon ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
                      {played ? g.awayScore : '—'}
                    </span>
                    <span className={homeWon ? 'font-semibold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
                      {played ? g.homeScore : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
