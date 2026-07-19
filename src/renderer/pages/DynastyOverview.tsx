import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PageHeader } from '../components/ui/PageHeader';
import { StatTile } from '../components/ui/StatTile';
import { TeamLogo } from '../components/common/TeamLogo';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { TeamSwitcher } from '../components/common/TeamSwitcher';
import { useTheme } from '../theme/ThemeProvider';
import {
  getBowlLogoPath,
  getPostseasonAppearanceImagePath,
  getTrophyImagePath,
} from '../lib/trophyAssetMapping';
import type { BowlAppearance, GameSummary, RankingsOverview, SeasonOverview, TeamTrophies, Trophy } from '../../shared/types';

function rankLabel(rank: number | null): string {
  return rank === null ? 'Unranked' : `#${rank}`;
}

/**
 * Bowl asset matching is a normalized-name guess (see trophyAssetMapping.ts) —
 * a handful of real bowls (confirmed: Bahamas Bowl, Camellia Bowl) aren't in
 * the asset pack under any matching filename. Rather than showing a broken
 * image icon, fail over to the generic bowl mark at render time.
 */
function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

function TrophyBadge({ trophy }: { trophy: Trophy }) {
  const imagePath = getTrophyImagePath(trophy);
  if (!imagePath) return null;

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <img
        src={imagePath}
        alt={trophy.label}
        onError={trophy.kind === 'bowl-win' ? fallbackToDefaultBowlLogo : undefined}
        className="h-16 w-16 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.25)]"
        draggable={false}
      />
      <p className="max-w-[6rem] text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400">
        {trophy.label}
      </p>
    </div>
  );
}

function BowlAppearanceBadge({ bowl }: { bowl: BowlAppearance }) {
  const { appearance } = useTheme();
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <img
        src={getPostseasonAppearanceImagePath(bowl, appearance)}
        alt={bowl.bowlName}
        onError={bowl.kind === 'bowl' ? fallbackToDefaultBowlLogo : undefined}
        className="h-28 w-28 object-contain drop-shadow-[0_10px_24px_rgba(15,23,42,0.3)]"
        draggable={false}
      />
      <p className="max-w-[8rem] text-[10px] font-semibold uppercase leading-tight tracking-wide opacity-80">
        {bowl.bowlName}
      </p>
    </div>
  );
}

function GameRow({ game }: { game: GameSummary }) {
  const resultColor =
    game.result === 'W'
      ? 'text-green-600 dark:text-green-400'
      : game.result === 'L'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5">
      <span className="text-slate-700 dark:text-slate-200">
        Week {game.week} {game.isHome ? 'vs' : '@'} {game.opponent}
      </span>
      {game.result ? (
        <span className={`font-semibold ${resultColor}`}>
          {game.result} {game.teamScore}-{game.opponentScore}
        </span>
      ) : (
        <span className={resultColor}>Upcoming</span>
      )}
    </li>
  );
}

/** League-mode Team Hub — identity, record, and roster leaders for any team from the per-season league snapshots. Full hub features (trophies, rankings history, recent games detail) are user-team only. */
function LeagueTeamHub({ dynastyId, teamIndex, teamName, seasonId }: { dynastyId: string; teamIndex: number; teamName: string; seasonId?: number }) {
  const [games, setGames] = useState<import('../../shared/types').LeagueTeamGame[] | null | undefined>(undefined);
  const [roster, setRoster] = useState<import('../../shared/types').LeagueTeamRoster | null | undefined>(undefined);
  const { openPlayerModal } = usePlayerModal();

  useEffect(() => {
    let cancelled = false;
    setGames(undefined);
    setRoster(undefined);
    window.api.db.getLeagueTeamSchedule(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setGames(r));
    window.api.db.getLeagueTeamRoster(dynastyId, teamIndex, seasonId).then((r) => !cancelled && setRoster(r));
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, seasonId]);

  const wins = (games ?? []).filter((g) => g.result === 'W').length;
  const losses = (games ?? []).filter((g) => g.result === 'L').length;
  const topPlayers = [...(roster?.players ?? [])].sort((a, b) => b.overallRating - a.overallRating).slice(0, 10);
  const avgOvr =
    roster && roster.players.length > 0
      ? (roster.players.reduce((s, p) => s + p.overallRating, 0) / roster.players.length).toFixed(1)
      : '—';

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Team Hub" title={`${teamName}.`} description="A league-snapshot view of this program — record, roster strength, and top players. Trophies, ranking history, and game detail are tracked for your own team only." actions={<TeamSwitcher />} />
      <div className="flex items-center gap-4">
        <TeamLogo team={{ assetName: teamName, label: teamName }} size="lg" />
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <StatTile label="Record" value={games && games.length > 0 ? `${wins}-${losses}` : '—'} />
          <StatTile label="Roster" value={String(roster?.players.length ?? 0)} />
          <StatTile label="Average OVR" value={avgOvr} />
        </div>
      </div>
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Top players</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {topPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                openPlayerModal(dynastyId, p.id, roster?.seasonId, topPlayers.map((x) => x.id), {
                  name: `${p.firstName} ${p.lastName}`,
                  position: p.position,
                  teamDisplayName: teamName,
                  portraitAssetName: p.portraitAssetName,
                })
              }
              className="flex items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
            >
              <PlayerPortrait player={p} size="sm" className="!h-9 !w-9" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {p.firstName} {p.lastName}
              </span>
              <span className="type-meta shrink-0 text-slate-500 dark:text-slate-400">{p.position}</span>
              <span className="type-stat-sm shrink-0 text-slate-950 dark:text-white">{p.overallRating}</span>
            </button>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

export function DynastyOverview() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [trophies, setTrophies] = useState<TeamTrophies | null | undefined>(undefined);
  const [rankings, setRankings] = useState<RankingsOverview | null | undefined>(undefined);
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getTeamTrophies(id, seasonId).then((result) => {
      if (!cancelled) setTrophies(result);
    });
    window.api.db.getRankings(id, seasonId).then((result) => {
      if (!cancelled) setRankings(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (id && viewedTeamIndex !== null) {
    const teamName = leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? 'Team';
    return <LeagueTeamHub dynastyId={id} teamIndex={viewedTeamIndex} teamName={teamName} seasonId={seasonId} />;
  }

  if (overview === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Team Hub...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="lg" />
              <div>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Team Hub
                </p>
                <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
                  {overview.teamName}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Season {overview.seasonYear} for {overview.dynastyLabel}.
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Last synced {new Date(overview.lastSyncedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {trophies && trophies.trophies.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 border-l border-slate-200/80 pl-6 dark:border-slate-800">
                {trophies.trophies.map((trophy) => (
                  <TrophyBadge key={trophy.kind} trophy={trophy} />
                ))}
              </div>
            )}

          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl bg-[var(--team-primary)] p-5 text-[var(--team-on-primary)] shadow-[0_24px_70px_-38px_rgba(37,99,235,0.85)]">
          <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <p className="proportional-nums text-5xl font-semibold tracking-tight">
                {overview.record.wins}-{overview.record.losses}
              </p>
              <p className="text-sm opacity-80">
                Conference {overview.conferenceRecord.wins}-{overview.conferenceRecord.losses}
              </p>
            </div>
            {trophies?.bowlAppearance && <BowlAppearanceBadge bowl={trophies.bowlAppearance} />}
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Conference record"
          value={`${overview.conferenceRecord.wins}-${overview.conferenceRecord.losses}`}
        />
        <StatTile label="Media poll" value={rankLabel(overview.rankings.media)} />
        <StatTile label="Coaches poll" value={rankLabel(overview.rankings.coaches)} />
        <StatTile label="CFP rank" value={rankLabel(overview.rankings.cfp)} />
        <StatTile label="Recruiting class" value={rankLabel(overview.recruitingClassRank)} />
        <StatTile
          label="Program prestige"
          value={overview.teamPrestige === null ? 'Not available' : String(overview.teamPrestige)}
        />
      </div>

      {rankings && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Season-High Media/AP" value={rankLabel(rankings.highestMediaPollRank)} />
          <StatTile label="Season-High Coaches" value={rankLabel(rankings.highestCoachesPollRank)} />
          <StatTile label="Season-High CFP" value={rankLabel(rankings.highestCfpRank)} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Recent games
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Latest results
              </h3>
            </div>
            <Link to={`/dynasty/${id}/schedule`} className="text-sm font-medium text-[var(--team-primary)] hover:underline">
              Schedule
            </Link>
          </div>
          {overview.recentGames.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games played yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.recentGames.map((game) => (
                <GameRow key={`${game.week}-${game.opponent}`} game={game} />
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Upcoming games
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            What is next
          </h3>
          {overview.upcomingGames.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No games scheduled.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.upcomingGames.map((game) => (
                <GameRow key={`${game.week}-${game.opponent}`} game={game} />
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
