import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConferenceMark } from '../components/common/ConferenceMark';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { PageHeader } from '../components/ui/PageHeader';
import { TeamLogo } from '../components/common/TeamLogo';
import { useTheme } from '../theme/ThemeProvider';
import { useStadiumData } from '../data/StadiumDataProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { TeamSwitcher } from '../components/common/TeamSwitcher';
import { gameTypeLabel, getGameTypeImagePath, getLocationDisplay, isTraditionalBowl } from '../lib/scheduleFormat';
import { getBowlLogoPath } from '../lib/trophyAssetMapping';
import type { LeagueTeamGame, ScheduleGame, ScheduleOverview } from '../../shared/types';

/** Traditional-bowl logo matching is a normalized-name guess (see trophyAssetMapping.ts) — fail over to the generic mark rather than a broken image icon. */
function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

function TypeCell({ game }: { game: ScheduleGame }) {
  const { appearance } = useTheme();
  if (game.gameType === 'conference' && game.conferenceName) {
    return <ConferenceMark conferenceName={game.conferenceName} background={appearance} context="table" alt="" />;
  }

  const imagePath = getGameTypeImagePath(game, appearance);
  const label = gameTypeLabel(game);

  if (!imagePath) return null;

  return (
    <img
      src={imagePath}
      alt={label}
      onError={isTraditionalBowl(game) ? fallbackToDefaultBowlLogo : undefined}
      className="h-12 w-12 shrink-0 object-contain"
      draggable={false}
    />
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (!rank) {
    return <span className="text-base text-slate-400 dark:text-slate-500">NR</span>;
  }
  if (rank <= 25) {
    return (
      <span className="proportional-nums inline-flex h-8 min-w-[2.2rem] items-center justify-center bg-amber-100 px-2 text-sm font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300">
        #{rank}
      </span>
    );
  }
  return <span className="proportional-nums text-base text-slate-500 dark:text-slate-400">#{rank}</span>;
}

function LocationCell({ game }: { game: ScheduleGame }) {
  const { getStadium } = useStadiumData();
  const { badge, stadium, cityState } = getLocationDisplay(game, getStadium);
  // A neutral-site bowl/championship game shows its real event name here
  // instead of the generic "Neutral Site" label — the event IS the location
  // that matters. Plain neutral-site games with no bowl identity (rare, but
  // possible) still fall back to the generic badge.
  const eventName = game.gameType === 'bowl' ? gameTypeLabel(game) : null;
  return (
    <div className="flex flex-col gap-1">
      {game.siteType === 'neutral' && (
        <span className="inline-flex w-fit items-center bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300">
          {eventName || badge}
        </span>
      )}
      {stadium ? (
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="whitespace-nowrap">
            {stadium}
            {cityState ? ',' : ''}
          </span>
          {cityState && <span className="whitespace-nowrap">{cityState}</span>}
        </div>
      ) : (
        game.siteType !== 'neutral' && <span className="text-sm text-slate-400 dark:text-slate-500">-</span>
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
  const resultText =
    game.result === null ? 'Upcoming' : `${game.result} ${game.teamScore}-${game.opponentScore}`;
  const resultColor =
    game.result === 'W'
      ? 'text-green-700 dark:text-green-400'
      : game.result === 'L'
        ? 'text-red-700 dark:text-red-400'
        : 'text-slate-400 dark:text-slate-500';
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
        <RankBadge rank={game.opponentCurrentRank} />
      </td>
      <td className="px-5 py-4 proportional-nums text-slate-500 dark:text-slate-400">
        {game.opponentRecord ? `${game.opponentRecord.wins}-${game.opponentRecord.losses}` : '-'}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3 font-medium text-slate-900 dark:text-white">
          <TeamLogo team={{ assetName: game.opponent, label: game.opponent }} size="sm" />
          <span>
            {game.isHome ? 'vs' : '@'} {game.opponent}
          </span>
        </div>
      </td>
      <td className="px-5 py-4">
        <TypeCell game={game} />
      </td>
      <td className="px-5 py-4">
        <LocationCell game={game} />
      </td>
      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
        {game.dayOfWeek} {game.kickoffTime}
      </td>
      <td className="px-5 py-4">
        <span className={`font-semibold ${resultColor}`}>{resultText}</span>
        {runningRecordText && (
          <span className="proportional-nums ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
            | {runningRecordText}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * League-mode schedule (viewing another team): compact all-games table from
 * the league schedule snapshot — opponent, type, result from that team's
 * perspective. No stadiums/kickoff/game-detail links: those are only tracked
 * for the user's own games.
 */
function LeagueTeamSchedule({ dynastyId, teamIndex, teamName, seasonId }: { dynastyId: string; teamIndex: number; teamName: string; seasonId?: number }) {
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
      <PageHeader
        eyebrow="Schedule"
        title={`${teamName} schedule.`}
        description="From the league-wide season snapshot — results and opponents for any team in the country. Kickoff times, stadiums, and game detail are tracked for your own games only."
        actions={<TeamSwitcher />}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Record" value={games && games.length > 0 ? `${wins}-${losses}` : '—'} />
        <StatTile label="Games" value={String(games?.length ?? 0)} />
      </div>
      <SurfaceCard className="overflow-hidden p-0">
        {games === undefined && <p className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading schedule...</p>}
        {games === null && (
          <p className="p-6 text-sm text-slate-400 dark:text-slate-500">
            No league schedule snapshot for this season — re-sync this dynasty to capture it.
          </p>
        )}
        {games && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--team-primary)] font-display text-[var(--team-on-primary)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Wk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Opponent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.gameId} className="border-b border-slate-200/70 bg-white/60 last:border-b-0 dark:border-slate-800/70 dark:bg-transparent">
                    <td className="tnum px-4 py-3 text-slate-500 dark:text-slate-400">{g.week}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 font-medium text-slate-900 dark:text-white">
                        <TeamLogo team={{ assetName: g.opponent, label: g.opponent }} size="sm" />
                        <span>
                          {g.isHome ? 'vs' : '@'} {g.opponent}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{g.bowlName ?? (g.weekType === 'RegularSeason' ? '—' : g.weekType)}</td>
                    <td className="tnum px-4 py-3 text-right">
                      {g.result === null ? (
                        <span className="text-slate-400 dark:text-slate-500">Upcoming</span>
                      ) : (
                        <span className={`font-semibold ${g.result === 'W' ? 'text-green-700 dark:text-green-400' : g.result === 'L' ? 'text-red-700 dark:text-red-400' : 'text-slate-500'}`}>
                          {g.result} {g.teamScore}-{g.opponentScore}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
  const navigate = useNavigate();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<ScheduleOverview | null | undefined>(undefined);
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();

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
      <PageHeader
        eyebrow="Schedule"
        title="Weekly flow, kickoff context, and results in one place."
        description="Review the full season board, move into game detail from any row, and keep key context visible while navigating between years."
        actions={<TeamSwitcher userTeamName={overview.games[0]?.teamName} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Record" value={`${overview.record.wins}-${overview.record.losses}`} />
        <StatTile
          label="Conference"
          value={`${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses}`}
        />
        <StatTile label="Current streak" value={streakLabel} />
        <StatTile label="Bowl eligible" value={overview.bowlEligible ? 'Yes' : 'Not yet'} />
      </div>

      <SurfaceCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-base">
            <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Wk</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Date</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Rank</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Record</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Opponent</th>
                <th className="w-16 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Type</th>
                <th className="min-w-[16rem] px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Location</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Kickoff</th>
                <th className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.22em]">Result</th>
              </tr>
            </thead>
            <tbody>
              {overview.games.map((game) => (
                <GameRow
                  key={game.gameId}
                  game={game}
                  onOpen={() => navigate(`/dynasty/${id}/schedule/${game.gameId}`)}
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
