import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGameModal } from '../data/GameModalProvider';
import { ConferenceMark } from '../components/common/ConferenceMark';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PageMasthead } from '../components/common/PageMasthead';
import { TeamLink } from '../components/common/TeamLink';
import { useTheme } from '../theme/ThemeProvider';
import { useProgramStadium } from '../data/ProgramArtProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { bowlLabel, gameTypeLabel, getCfpBowlImagePath, getGameTypeImagePath, getLocationDisplay, isTraditionalBowl, type LocationFields } from '../lib/scheduleFormat';
import { getBowlLogoPath } from '../lib/trophyAssetMapping';
import { getRivalryLogoPath } from '../lib/rivalryAssetMapping';
import type { LeagueTeamGame, ScheduleGame, ScheduleOverview } from '../../shared/types';

/** Schedule's masthead — the shared PageMasthead with the team's helmet and the season's headline numbers as chips. */
function ScheduleHero({
  teamAssetName,
  teamLabel,
  description,
  stats,
}: {
  teamAssetName: string;
  teamLabel: string;
  /** Optional context worth surfacing; UI narration belongs nowhere, not behind a hint. */
  description?: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <PageMasthead
      eyebrow="Schedule"
      title={teamLabel}
      description={description}
      mark={{ kind: 'helmet', teamAssetName }}
      stats={stats}
    />
  );
}

/** Compact, premium W/L result pill used across both schedule tables. */
function ResultChip({ result, teamScore, opponentScore }: { result: 'W' | 'L' | 'T' | null; teamScore: number | null; opponentScore: number | null }) {
  if (result === null) {
    return <span className="type-eyebrow text-slate-400 dark:text-slate-500">Upcoming</span>;
  }
  const tone =
    result === 'W'
      ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300'
      : result === 'L'
        ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
        : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-display text-sm font-bold tabular-nums ${tone}`}>
      {result}
      <span className="font-semibold opacity-90">{teamScore}-{opponentScore}</span>
    </span>
  );
}

/** Traditional-bowl logo matching is a normalized-name guess (see trophyAssetMapping.ts) — fail over to the generic mark rather than a broken image icon. */
function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

/**
 * The rivalry mark, in its own column beside the opponent — the matchup's
 * identity belongs next to who you're playing, not in Type, which is already
 * saying conference/bowl and can only hold one thing.
 *
 * Keyed on the two team NAMES (see rivalryAssetMapping), so it lights up on a
 * browsed team's schedule too, where the save gives no rivalry flag at all.
 * `isKnownRivalry` only ever adds the generic shield on top of that.
 *
 * Renders for upcoming games as well as played ones: a rivalry you can see
 * coming is the point of a schedule.
 */
function RivalryCell({ teamName, opponent, isKnownRivalry }: { teamName: string; opponent: string; isKnownRivalry?: boolean }) {
  const src = getRivalryLogoPath(teamName, opponent, isKnownRivalry);
  if (!src) return null;
  return <img src={src} alt="" title="Rivalry game" className="h-10 w-10 shrink-0 object-contain" draggable={false} />;
}

function TypeCell({ game }: { game: ScheduleGame }) {
  const { appearance } = useTheme();
  // Conference games normally show the plain conference mark — except the
  // championship, which falls through to getGameTypeImagePath for the event's
  // own logo.
  if (game.gameType === 'conference' && game.conferenceName && !game.isConferenceChampionship) {
    return <ConferenceMark conferenceName={game.conferenceName} background={appearance} context="table" alt="" />;
  }

  const imagePath = getGameTypeImagePath(game, appearance);
  const label = gameTypeLabel(game);
  /*
    THE BOWL BESIDE THE ROUND (user direction 2026-08-07). A CFP quarterfinal or
    semifinal is played IN a bowl, and the two marks answer different questions:
    the round says how deep into the bracket this is, the bowl says which one it
    was. The Game Info header has paired them for a while — the schedule now
    reads the same way, which also replaces the "CFP Quarterfinal" text badge
    that used to sit in the Location column.

    Null for everything else, including the first round (on campus, no bowl) and
    the national championship (its mark is already the trophy) — see
    getCfpBowlImagePath.
  */
  const cfpBowlPath = getCfpBowlImagePath(game);

  if (!imagePath) return null;

  return (
    <div className="flex items-center gap-1.5">
      <img
        src={imagePath}
        alt={label}
        onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
        className="h-12 w-12 shrink-0 object-contain"
        draggable={false}
      />
      {cfpBowlPath && (
        <img
          src={cfpBowlPath}
          alt=""
          onError={fallbackToDefaultBowlLogo}
          className="h-12 w-12 shrink-0 object-contain"
          draggable={false}
        />
      )}
    </div>
  );
}

function RankBadge({ rank, captured }: { rank: number | null; captured?: boolean }) {
  // A captured rank is the opponent's rank AT KICKOFF; an uncaptured one is
  // their rank today. Only the tooltip distinguishes them — the number itself
  // shouldn't shout about its own provenance.
  const title = captured ? 'Rank when this game was played' : "Opponent's current rank — this game predates rank tracking";
  if (!rank) {
    return <span className="text-base text-slate-400 dark:text-slate-500" title={title}>NR</span>;
  }
  if (rank <= 25) {
    return (
      <span title={title} className="proportional-nums inline-flex h-8 min-w-[2.2rem] items-center justify-center bg-amber-100 px-2 text-sm font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300">
        #{rank}
      </span>
    );
  }
  return <span title={title} className="proportional-nums text-base text-slate-500 dark:text-slate-400">#{rank}</span>;
}

function LocationCell({ game, fallbackLabel }: { game: LocationFields; fallbackLabel?: string }) {
  // Program-editor overrides layered over the built-in reference data.
  const getStadium = useProgramStadium();
  const { badge, stadium, cityState } = getLocationDisplay(game, getStadium);
  /*
    NO BOXES, BUT NEVER BLANK (user direction 2026-08-07, twice).

    The first pass removed the indigo badge that printed "Neutral Site" or the
    event's own name above the venue — right, because Type already draws the
    occasion's mark. But on a playoff game whose venue reference is missing the
    badge had been the ONLY thing in the cell, so removing it emptied the column
    outright, which read as the stadium having been deleted. It hadn't: those
    games never resolved one.

    So the venue still leads whenever it resolves, and when it doesn't the cell
    falls back to naming the occasion — as plain grey text on the same line the
    venue would occupy, not as a chip. "I just didn't want the boxes" is a
    statement about the treatment, not about the information.
  */
  // The occasion's name comes from the CALLER, because naming a game needs
  // fields that have nothing to do with where it was played — and dragging them
  // into LocationFields would make a venue lookup depend on bowl identity.
  const label = fallbackLabel || badge;
  return (
    <div className="flex flex-col gap-1">
      {stadium ? (
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="whitespace-nowrap">
            {stadium}
            {cityState ? ',' : ''}
          </span>
          {cityState && <span className="whitespace-nowrap">{cityState}</span>}
        </div>
      ) : (
        <span className="text-sm text-slate-400 dark:text-slate-500">{label || '-'}</span>
      )}
    </div>
  );
}

function GameRow({ game, onOpen }: { game: ScheduleGame; onOpen: () => void }) {
  const rowClass =
    game.result === 'W'
      ? 'border-green-200/70 bg-green-50/70 dark:border-green-900/60 dark:bg-green-950/20'
      : game.result === 'L'
        ? 'border-red-200/70 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20'
        : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-white/5';
  const runningRecordText = game.runningRecord
    ? `${game.runningRecord.overallWins}-${game.runningRecord.overallLosses} (${game.runningRecord.conferenceWins}-${game.runningRecord.conferenceLosses})`
    : null;

  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-b border-white/60 last:border-b-0 transition hover:brightness-[0.985] dark:border-white/5 ${rowClass}`}
    >
      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{game.week}</td>
      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">{game.date}</td>
      <td className="px-5 py-4">
        <RankBadge rank={game.opponentCurrentRank} captured={game.opponentContextCaptured} />
      </td>
      <td className="px-5 py-4 proportional-nums text-slate-500 dark:text-slate-400">
        {game.opponentRecord ? `${game.opponentRecord.wins}-${game.opponentRecord.losses}` : '-'}
      </td>
      {/* px-2, not the row's usual px-5: a 56px column minus 40px of padding
          left a 16px content box, and the table squeezed the 40px mark into it
          — measured at 16x40 before this, i.e. visibly crushed sideways. */}
      <td className="px-2 py-4">
        <RivalryCell teamName={game.teamName} opponent={game.opponent} isKnownRivalry={game.isRivalryGame} />
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
          <span className="text-slate-400 dark:text-slate-500">{game.isHome ? 'vs' : '@'}</span>
          <TeamLink teamIndex={game.opponentTeamIndex} teamName={game.opponent} size="sm" nameClassName="whitespace-nowrap" />
        </div>
      </td>
      <td className="px-5 py-4">
        <TypeCell game={game} />
      </td>
      <td className="px-5 py-4">
        <LocationCell game={game} fallbackLabel={game.gameType === 'bowl' ? gameTypeLabel(game) : undefined} />
      </td>
      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
        {game.dayOfWeek} {game.kickoffTime}
      </td>
      <td className="px-5 py-4">
        <ResultChip result={game.result} teamScore={game.teamScore} opponentScore={game.opponentScore} />
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right proportional-nums text-sm text-slate-400 dark:text-slate-500">
        {runningRecordText ?? ''}
      </td>
    </tr>
  );
}

/**
 * League-mode schedule (viewing another team): compact all-games table from
 * the league schedule snapshot — opponent, type, location and result from that
 * team's perspective.
 *
 * Stadiums used to be excluded here on the grounds that they were "only tracked
 * for the user's own games", which was never quite true and is now plainly not:
 * the venue chain is shipped reference data plus the save's own neutral-venue
 * id, and both halves travel on a browsed game. Kickoff time and the
 * game-detail link stay user-only — those really are.
 */
/**
 * Type-column content for a league-view game — now the SAME treatment as the
 * user's own schedule (TypeCell above), logo included.
 *
 * It used to print `game.weekType` whenever the bowl name was missing, which
 * was every postseason game: a CFP Semifinal read "BowlSeason3". That string is
 * a week bucket, not a round — one Auburn season had 28 games in BowlSeason1,
 * every December bowl mixed in with the Playoff first round — so it could never
 * be shown to anyone. The name itself is fixed at the source (see
 * getLeagueTeamSchedule); this just stops the raw enum from ever surfacing
 * again, falling back to the generic bowl mark and "Bowl Game".
 */
function LeagueTypeCell({ game, appearance }: { game: LeagueTeamGame; appearance: 'light' | 'dark' }) {
  if (game.isConferenceChampionship && game.conferenceName) {
    const champPath = getGameTypeImagePath(game, appearance);
    if (champPath) {
      return (
        <img
          src={champPath}
          alt={`${game.conferenceName} Championship`}
          title={`${game.conferenceName} Championship`}
          className="h-12 w-12 shrink-0 object-contain"
          draggable={false}
        />
      );
    }
  }
  if (game.gameType === 'conference' && game.conferenceName) {
    return <ConferenceMark conferenceName={game.conferenceName} background={appearance} context="table" alt={game.conferenceName} />;
  }
  if (game.gameType === 'bowl') {
    const imagePath = getGameTypeImagePath(game, appearance);
    const label = bowlLabel(game);
    if (!imagePath) return <span className="text-slate-600 dark:text-slate-300">{label}</span>;
    /*
      The bowl beside the round here too (user direction 2026-08-07). This table
      already matched the user's own schedule in every other respect, and a
      browsed team's playoff run is exactly when you want to know WHICH bowl —
      it's somebody else's season, so you have no memory of it to fall back on.
      The venue reference this needs now travels on LeagueTeamGame; see
      getLeagueTeamSchedule.
    */
    const cfpBowlPath = getCfpBowlImagePath(game);
    return (
      <div className="flex items-center gap-1.5">
        <img
          src={imagePath}
          alt={label}
          title={label}
          onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
          className="h-12 w-12 shrink-0 object-contain"
          draggable={false}
        />
        {cfpBowlPath && (
          <img
            src={cfpBowlPath}
            alt=""
            onError={fallbackToDefaultBowlLogo}
            className="h-12 w-12 shrink-0 object-contain"
            draggable={false}
          />
        )}
      </div>
    );
  }
  /*
    NOTHING for a non-conference game (user direction 2026-08-07). Every other
    row in this column carries a MARK — a conference crest, a bowl logo, a
    playoff round — and "Non-Conf" was a word describing the absence of one.
    A blank cell says the same thing without asking to be read.
  */
  return null;
}

function LeagueTeamSchedule({ dynastyId, teamIndex, teamName, seasonId }: { dynastyId: string; teamIndex: number; teamName: string; seasonId?: number }) {
  const { appearance } = useTheme();
  const { openGameModal } = useGameModal();
  const [games, setGames] = useState<LeagueTeamGame[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setGames(undefined);
    window.api.db.getLeagueTeamSchedule(dynastyId, teamIndex, seasonId).then((result) => {
      if (!cancelled) setGames(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, seasonId]);

  const wins = (games ?? []).filter((g) => g.result === 'W').length;
  const losses = (games ?? []).filter((g) => g.result === 'L').length;

  return (
    <div className="space-y-6">
      <ScheduleHero
        teamAssetName={teamName}
        teamLabel={teamName}
        description="From the league-wide season snapshot — results and opponents for any team in the country. Click any game for the full box score."
        stats={[
          { label: 'Record', value: games && games.length > 0 ? `${wins}-${losses}` : '—' },
          { label: 'Games', value: String(games?.length ?? 0) },
        ]}
      />
      <SurfaceCard className="overflow-hidden p-0">
        {games === undefined && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading schedule...</p>}
        {games === null && (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500">
            No league schedule snapshot for this season — re-sync this dynasty to capture it.
          </p>
        )}
        {games && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[var(--team-primary)] font-display text-[var(--team-on-primary)]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Wk</th>
                  {/* Mirrors the user's own schedule: the opponent's rank and
                      record AS THEY STOOD at kickoff, so browsing another
                      program shows their season as it actually unfolded. */}
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Rank</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Opp Rec</th>
                  <th className="w-16 px-2 py-3.5" aria-label="Rivalry" />
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Opponent</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Type</th>
                  {/* Venues resolve for ANY team (user direction 2026-08-07) —
                      the chain is stadium reference data plus the save's own
                      neutral-venue id, neither of which was ever user-only. The
                      old note here said stadiums "are only tracked for the
                      user's own games", which stopped being true once
                      neutralVenueId and siteType travelled on a browsed game. */}
                  <th className="min-w-[14rem] px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.2em]">Location</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.2em]">Result</th>
                  {/* The browsed team's own record after each game, in the same
                      place the user's schedule puts it — a season should read
                      the same way whoever is having it. */}
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.2em]">Rec</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const tint =
                    g.result === 'W'
                      ? 'bg-green-50/60 dark:bg-green-950/15'
                      : g.result === 'L'
                        ? 'bg-red-50/60 dark:bg-red-950/15'
                        : 'bg-white/50 dark:bg-transparent';
                  const accent = g.result === 'W' ? '#16a34a' : g.result === 'L' ? '#dc2626' : 'transparent';
                  return (
                    <tr
                      key={g.gameId}
                      onClick={() => openGameModal(dynastyId, g.gameId, seasonId, games.map((x) => x.gameId))}
                      className={`group cursor-pointer border-b border-slate-200/60 transition last:border-b-0 hover:brightness-[0.98] dark:border-white/5 ${tint}`}
                    >
                      <td className="tnum px-5 py-3.5 font-medium text-slate-500 dark:text-slate-400" style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>{g.week}</td>
                      <td className="px-5 py-3.5">
                        <RankBadge rank={g.opponentRank} captured={g.opponentRank !== null} />
                      </td>
                      <td className="tnum px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {g.opponentRecord ? `${g.opponentRecord.wins}-${g.opponentRecord.losses}` : '—'}
                      </td>
                      <td className="px-2 py-3.5">
                        <RivalryCell teamName={teamName} opponent={g.opponent} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                          <span className="text-slate-400 dark:text-slate-500">{g.isHome ? 'vs' : '@'}</span>
                          <TeamLink teamIndex={g.opponentTeamIndex} teamName={g.opponent} size="sm" nameClassName="whitespace-nowrap" />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400"><LeagueTypeCell game={g} appearance={appearance} /></td>
                      <td className="px-5 py-3.5">
                        <LocationCell
                          game={{
                            siteType: g.siteType,
                            isHome: g.isHome,
                            teamName,
                            opponent: g.opponent,
                            neutralVenueId: g.neutralVenueId,
                            isConferenceChampionship: g.isConferenceChampionship,
                            conferenceName: g.conferenceName,
                            bowlAssetName: g.bowlAssetName,
                          }}
                          fallbackLabel={g.gameType === 'bowl' ? bowlLabel(g) : undefined}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <ResultChip result={g.result} teamScore={g.teamScore} opponentScore={g.opponentScore} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right proportional-nums text-xs text-slate-400 dark:text-slate-500">
                        {g.runningRecord
                          ? `${g.runningRecord.overallWins}-${g.runningRecord.overallLosses} (${g.runningRecord.conferenceWins}-${g.runningRecord.conferenceLosses})`
                          : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

export function Schedule() {
  const { id } = useParams<{ id: string }>();
  const { openGameModal } = useGameModal();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<ScheduleOverview | null | undefined>(undefined);
  const { viewedTeamIndex, leagueTeams, userTeamName } = useViewedTeam();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOverview(undefined);
    window.api.db.getSchedule(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (id && viewedTeamIndex !== null) {
    const teamName = leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team';
    return <LeagueTeamSchedule dynastyId={id} teamIndex={viewedTeamIndex} teamName={teamName} seasonId={seasonId} />;
  }

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading schedule...</p>;
  }

  if (overview === null) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Schedule not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const streakLabel =
    overview.currentStreak.type === null
      ? '-'
      : `${overview.currentStreak.count}${overview.currentStreak.type}`;

  return (
    <div className="space-y-6">
      <ScheduleHero
        teamAssetName={userTeamName ?? 'Team'}
        teamLabel={userTeamName ?? 'Schedule'}
        stats={[
          { label: 'Record', value: `${overview.record.wins}-${overview.record.losses}` },
          { label: 'Conference', value: `${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses}` },
          { label: 'Current streak', value: streakLabel },
          { label: 'Bowl eligible', value: overview.bowlEligible ? 'Yes' : 'Not yet' },
        ]}
      />

      <SurfaceCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-base">
            <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Wk</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Date</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Rank</th>
                {/* OPP REC, not "Rec" (user direction 2026-08-07). Two columns
                    on this table are a won-lost record — the opponent's, and
                    yours after the game — and calling both of them "Rec" left
                    the reader to work out which was which from position. */}
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Opp Rec</th>
                {/* Rivalry mark — intentionally unlabelled, and shortening Record to
                    Rec is what bought the width. A header over a column that's
                    empty on eleven of thirteen rows reads as missing data. */}
                <th className="w-16 px-2 py-4" aria-label="Rivalry" />
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Opponent</th>
                <th className="w-16 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Type</th>
                <th className="min-w-[16rem] px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Location</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Kickoff</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Result</th>
                {/* YOUR record, in its own column (user direction 2026-08-07).
                    It used to ride inside Result as a small grey parenthetical,
                    which put two different facts — what happened in this game,
                    and where the season stood after it — in one cell where the
                    eye had to separate them. */}
                <th className="px-5 py-4 text-right text-sm font-semibold uppercase tracking-[0.22em]">Rec</th>
              </tr>
            </thead>
            <tbody>
              {overview.games.map((game) => (
                <GameRow
                  key={game.gameId}
                  game={game}
                  onOpen={() =>
                    id && openGameModal(id, game.gameId, seasonId, overview.games.map((x) => x.gameId))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        {overview.games.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
        )}
      </SurfaceCard>

      <p className="text-xs leading-6 text-slate-400 dark:text-slate-500">
        Opponent rank and record reflect each team&apos;s current standing stored in the save, not a historical
        snapshot from the week the game was actually played. Your own running record (shown next to each result) is
        computed from games actually played through that week, so it&apos;s always accurate for past games.
      </p>
    </div>
  );
}
