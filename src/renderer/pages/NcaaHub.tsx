import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CoachPortrait } from '../components/common/CoachPortrait';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { EditButton } from '../components/common/CoachCard';
import { abbreviateClass } from '../lib/rosterOrder';
import { useTheme } from '../theme/ThemeProvider';
import {
  getBowlLogoPath,
  getNationalChampionshipAppearanceImagePath,
  getPlayoffRoundImagePath,
} from '../lib/trophyAssetMapping';
import type {
  NcaaHubCfpEntry,
  NcaaHubConferenceLeader,
  NcaaHubGameFeature,
  NcaaHubOverview,
  NcaaHubRecordWatchEntry,
  NcaaHubRecruitingClassEntry,
  NcaaHubTop25Entry,
  LeagueTeamSummary,
  LeagueTeamRoster,
  LeagueRosterPlayer,
  OffensiveStatLine,
  DefensiveStatLine,
} from '../../shared/types';

function rankChip(rank: number | null) {
  if (!rank) {
    return (
      <span className="inline-flex min-w-[2.5rem] items-center justify-center border border-slate-300/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        NR
      </span>
    );
  }

  return (
    <span className="proportional-nums inline-flex min-w-[2.75rem] items-center justify-center bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300">
      #{rank}
    </span>
  );
}

function fallbackToDefaultBowlLogo(event: SyntheticEvent<HTMLImageElement>): void {
  const fallback = getBowlLogoPath(null);
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

function formatSyncedAt(value: string): string {
  return new Date(value).toLocaleDateString();
}

function gameMetaLine(game: NcaaHubGameFeature): string {
  const parts = [game.date, game.dayOfWeek, game.kickoffTime !== 'TBD' ? game.kickoffTime : null, game.broadcastScope]
    .filter((part) => part && part !== 'TBD')
    .join(' - ');
  return parts || 'Kickoff TBD';
}

function gameScoreLine(game: NcaaHubGameFeature): string | null {
  if (game.homeScore === null || game.awayScore === null) return null;

  if (game.homeScore === game.awayScore) {
    return `${game.awayTeamName} and ${game.homeTeamName} finished tied at ${game.awayScore}-${game.homeScore}.`;
  }

  const winner = game.homeScore > game.awayScore ? game.homeTeamName : game.awayTeamName;
  const high = Math.max(game.homeScore, game.awayScore);
  const low = Math.min(game.homeScore, game.awayScore);
  return `${winner} won ${high}-${low}.`;
}

function eventLabel(game: NcaaHubGameFeature): string {
  if (game.isNationalChampionship) return 'National Championship';
  if (game.isBowlGame) return game.bowlName ?? 'Bowl Game';
  return game.isNeutralSite ? 'Neutral Site' : 'Campus Matchup';
}

function getEventLogoPath(game: NcaaHubGameFeature, appearance: 'light' | 'dark'): string | null {
  if (game.isNationalChampionship) {
    return getNationalChampionshipAppearanceImagePath(appearance);
  }
  if (!game.isBowlGame || !game.bowlName) {
    return null;
  }

  const playoffLogo = getPlayoffRoundImagePath(game.bowlName);
  if (playoffLogo) return playoffLogo;
  return getBowlLogoPath(game.bowlAssetName);
}

function heroHeadline(hub: NcaaHubOverview): string {
  if (hub.gameOfTheWeek) {
    return `${eventLabel(hub.gameOfTheWeek)} delivered a fresh headline.`;
  }
  if (hub.upcomingGames[0]) {
    return `Week ${hub.upcomingWeek ?? hub.upcomingGames[0].week} is starting to take shape.`;
  }
  if (hub.heismanFeature) {
    return `${hub.heismanFeature.playerName} is driving the national conversation.`;
  }
  return `A fuller national snapshot for the ${hub.seasonYear} season.`;
}

function heroSummary(hub: NcaaHubOverview): string {
  const recruitingLeader = hub.recruitingBuzz[0];
  const cfpLeader = hub.playoffPicture[0];

  if (hub.gameOfTheWeek) {
    const score = gameScoreLine(hub.gameOfTheWeek);
    return [
      hub.gameOfTheWeek.summary,
      score,
      cfpLeader ? `${cfpLeader.teamName} currently leads the CFP picture.` : null,
      recruitingLeader ? `${recruitingLeader.teamName} owns the No. ${recruitingLeader.rank} recruiting class.` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (hub.upcomingGames[0]) {
    return [
      hub.upcomingGames[0].summary,
      hub.heismanFeature
        ? `${hub.heismanFeature.playerName} leads the Heisman race for ${hub.heismanFeature.teamDisplayName}.`
        : null,
      recruitingLeader ? `${recruitingLeader.teamName} is the recruiting pace-setter right now.` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return 'Top 25 context, playoff picture, recruiting momentum, and weekly storylines are all pulled from this imported save.';
}

function TeamSpot({
  teamName,
  rank,
  align = 'left',
  compact = false,
}: {
  teamName: string;
  rank: number | null;
  align?: 'left' | 'right';
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      {rankChip(rank)}
      <div className={`flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <TeamLogo team={{ assetName: teamName, label: teamName }} size={compact ? 'sm' : 'md'} />
        <p className={`font-semibold tracking-tight text-slate-950 dark:text-white ${compact ? 'text-base' : 'text-xl sm:text-2xl'}`}>
          {teamName}
        </p>
      </div>
    </div>
  );
}

function MatchupVisual({ game, compact = false }: { game: NcaaHubGameFeature; compact?: boolean }) {
  const { appearance } = useTheme();
  const eventLogoPath = getEventLogoPath(game, appearance);
  const eventLogoLabel = eventLabel(game);

  return (
    <div className={`grid items-center gap-4 ${compact ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-[1fr_auto_1fr]'}`}>
      <TeamSpot teamName={game.awayTeamName} rank={game.awayRank} compact={compact} />

      <div className="flex flex-col items-center justify-center gap-2 text-center">
        {eventLogoPath ? (
          <>
            <img
              src={eventLogoPath}
              alt={eventLogoLabel}
              onError={game.isBowlGame && !game.isNationalChampionship ? fallbackToDefaultBowlLogo : undefined}
              className={compact ? 'h-10 w-16 object-contain' : 'h-16 w-24 object-contain'}
              draggable={false}
            />
            <p className="max-w-[10rem] type-eyebrow text-slate-400 dark:text-slate-500">
              {eventLogoLabel}
            </p>
          </>
        ) : (
          <>
            <span className={`inline-flex items-center justify-center border border-slate-200/80 bg-white/80 font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300 ${compact ? 'h-10 w-10 text-[10px]' : 'h-14 w-14 text-xs'}`}>
              {game.isNeutralSite ? 'VS' : 'AT'}
            </span>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              {eventLogoLabel}
            </p>
          </>
        )}
      </div>

      <TeamSpot teamName={game.homeTeamName} rank={game.homeRank} align="right" compact={compact} />
    </div>
  );
}

function StoryCard({
  eyebrow,
  title,
  body,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={className}>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{body}</p>
      {children}
    </SurfaceCard>
  );
}

function LeadGameCard({
  eyebrow,
  title,
  game,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  game: NcaaHubGameFeature | null;
  emptyText: string;
}) {
  if (!game) {
    return (
      <StoryCard eyebrow={eyebrow} title={title} body={emptyText} className="overflow-hidden">
        <div className="mt-6 rounded-xl border border-dashed border-slate-300/80 p-6 text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
          No featured game is available from this snapshot yet.
        </div>
      </StoryCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">
        {eyebrow}
      </p>
      <div className="mt-4 rounded-xl border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(241,245,249,0.9))] p-5 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.88))]">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="font-display text-section-title font-semibold text-slate-950 dark:text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{game.summary}</p>
          </div>

          <MatchupVisual game={game} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Kickoff window
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{gameMetaLine(game)}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Setting
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {game.isNeutralSite ? 'Neutral-site stage' : `${game.awayTeamName} at ${game.homeTeamName}`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Result
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {gameScoreLine(game) ?? 'Still to be played'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function Top25Row({ entry }: { entry: NcaaHubTop25Entry }) {
  return (
    <tr
      className={[
        'border-b border-white/60 last:border-b-0 dark:border-white/5',
        entry.isUserTeam
          ? 'bg-[color:color-mix(in_srgb,var(--team-primary)_14%,transparent)]'
          : 'bg-slate-50/80 dark:bg-white/5',
      ].join(' ')}
    >
      <td className="proportional-nums px-4 py-3 font-semibold text-slate-900 dark:text-white">#{entry.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-slate-900 dark:text-white">{entry.teamName}</p>
            {entry.conferenceName && (
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{entry.conferenceName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="proportional-nums px-4 py-3 text-slate-600 dark:text-slate-300">
        {entry.wins}-{entry.losses}
      </td>
      <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">
        {entry.coachesRank ? `#${entry.coachesRank}` : 'NR'}
      </td>
      <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">
        {entry.cfpRank ? `#${entry.cfpRank}` : 'NR'}
      </td>
    </tr>
  );
}

function PlayoffRow({ entry }: { entry: NcaaHubCfpEntry }) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        entry.isUserTeam
          ? 'border-[color:color-mix(in_srgb,var(--team-primary)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]'
          : 'border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-white/5',
      ].join(' ')}
    >
      <span className="proportional-nums inline-flex h-10 w-10 items-center justify-center bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
        {entry.rank}
      </span>
      <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight text-slate-900 dark:text-white">{entry.teamName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {entry.wins}-{entry.losses}
          {entry.conferenceName ? ` - ${entry.conferenceName}` : ''}
        </p>
      </div>
    </div>
  );
}

function RecruitingRow({ entry }: { entry: NcaaHubRecruitingClassEntry }) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        entry.isUserTeam
          ? 'border-[color:color-mix(in_srgb,var(--team-primary)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]'
          : 'border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-white/5',
      ].join(' ')}
    >
      <span className="proportional-nums inline-flex h-10 w-10 items-center justify-center bg-emerald-100 text-sm font-semibold text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-300">
        {entry.rank}
      </span>
      <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight text-slate-900 dark:text-white">{entry.teamName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {entry.conferenceName ?? 'National class ranking'}
          {entry.conferenceRank ? ` - No. ${entry.conferenceRank} in conference` : ''}
        </p>
      </div>
    </div>
  );
}

function RecordWatchRow({
  entry,
  eyebrow,
}: {
  entry: NcaaHubRecordWatchEntry;
  eyebrow: string;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        entry.isUserTeam
          ? 'border-[color:color-mix(in_srgb,var(--team-primary)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]'
          : 'border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-white/5',
      ].join(' ')}
    >
      {rankChip(entry.mediaRank)}
      <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight text-slate-900 dark:text-white">{entry.teamName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {entry.wins}-{entry.losses}
          {entry.conferenceName ? ` - ${entry.conferenceName}` : ''}
        </p>
      </div>
      <span className="type-eyebrow text-slate-400 dark:text-slate-500">
        {eyebrow}
      </span>
    </div>
  );
}

function ConferenceLeaderRow({ entry }: { entry: NcaaHubConferenceLeader }) {
  return (
    <div
      className={[
        'rounded-xl border p-4',
        entry.isUserTeam
          ? 'border-[color:color-mix(in_srgb,var(--team-primary)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]'
          : 'border-slate-200/80 bg-slate-50/85 dark:border-slate-800 dark:bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            {entry.conferenceName}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <TeamLogo team={{ assetName: entry.teamName, label: entry.teamName }} size="sm" />
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-slate-900 dark:text-white">{entry.teamName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Conf {entry.conferenceWins}-{entry.conferenceLosses}
              </p>
            </div>
          </div>
        </div>
        {rankChip(entry.mediaRank)}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Overall {entry.overallWins}-{entry.overallLosses}
      </p>
    </div>
  );
}

function UpcomingGameRow({ game }: { game: NcaaHubGameFeature }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <MatchupVisual game={game} compact />
      <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">{game.summary}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{gameMetaLine(game)}</p>
    </div>
  );
}

export function NcaaHub() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [hub, setHub] = useState<NcaaHubOverview | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setHub(undefined);
    window.api.db.getNcaaHub(id, seasonId).then((result) => {
      if (!cancelled) setHub(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const leadGame = useMemo(() => {
    if (!hub) return null;
    return hub.gameOfTheWeek ?? hub.upcomingGames[0] ?? null;
  }, [hub]);

  if (hub === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading NCAA Hub...</p>;
  }

  if (hub === null || !id) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">NCAA Hub not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const recruitingLeader = hub.recruitingBuzz[0] ?? null;
  const userRecruitingEntry = hub.recruitingBuzz.find((entry) => entry.isUserTeam) ?? null;
  const cfpLeader = hub.playoffPicture[0] ?? null;
  const rankedUpcomingCount = hub.upcomingGames.filter((game) => game.homeRank || game.awayRank).length;
  const conferenceLeadersPreview = hub.conferenceLeaders.slice(0, 6);
  const notebookItems = [
    hub.undefeatedWatch[0]
      ? `${hub.undefeatedWatch.length} teams are still unbeaten, led by ${hub.undefeatedWatch[0].teamName}.`
      : null,
    hub.oneLossWatch[0]
      ? `${hub.oneLossWatch.length} one-loss programs are still very much in the title chase.`
      : null,
    hub.upcomingGames[0]
      ? `${hub.upcomingGames[0].awayTeamName} and ${hub.upcomingGames[0].homeTeamName} headline the next slate.`
      : null,
    recruitingLeader
      ? `${recruitingLeader.teamName} continues to set the recruiting pace at No. ${recruitingLeader.rank}.`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden p-0">
        <div className="relative bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.06),rgba(30,41,59,0.01))] px-6 py-7 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))] sm:px-8 sm:py-8">
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                NCAA Hub
              </p>
              <h2 className="mt-3 font-display text-page-title font-bold text-slate-950 dark:text-white sm:text-4xl">
                {heroHeadline(hub)}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">{heroSummary(hub)}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    AP poll loaded
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{hub.top25.length}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Ranked teams in the current media snapshot.
                  </p>
                </div>
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    CFP race
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    {hub.playoffPicture.length}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Teams with an active CFP rank in this save.
                  </p>
                </div>
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    Next slate
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    {rankedUpcomingCount}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Watchlist games with at least one ranked team in Week {hub.upcomingWeek ?? '-'}.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3 xl:items-end">
              <div className="grid w-full gap-3">
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    Poll pulse
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {cfpLeader ? `${cfpLeader.teamName} owns the top CFP slot.` : 'No CFP rankings recorded yet.'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    Recruiting buzz
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {recruitingLeader
                      ? `${recruitingLeader.teamName} leads the class rankings at No. ${recruitingLeader.rank}.`
                      : 'No recruiting class ranks recorded yet.'}
                  </p>
                  {userRecruitingEntry && (
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Your team checks in at No. {userRecruitingEntry.rank} nationally.
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-white/60 bg-white/72 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    Save snapshot
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Season {hub.seasonYear}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Last synced {formatSyncedAt(hub.lastSyncedAt)}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[1.42fr_0.98fr]">
        <div className="space-y-4">
          <LeadGameCard
            eyebrow={hub.gameOfTheWeek ? 'Lead Story' : 'Slate Preview'}
            title={hub.gameOfTheWeek ? 'Game of the Week' : 'Marquee Matchup'}
            game={leadGame}
            emptyText="The save has not produced a marquee national game yet, but the rest of the hub will continue to populate as the season advances."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <StoryCard
              eyebrow="Heisman Watch"
              title={hub.heismanFeature ? hub.heismanFeature.playerName : 'No race data yet'}
              body={
                hub.heismanFeature
                  ? `${hub.heismanFeature.position} - ${hub.heismanFeature.teamDisplayName}. ${hub.heismanFeature.rank === 0 ? 'The award is locked in.' : `Currently sits in slot ${hub.heismanFeature.rank + 1}.`}`
                  : 'This season snapshot does not include Heisman standings yet.'
              }
            >
              {hub.heismanFeature && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
                  <TeamLogo
                    team={{ assetName: hub.heismanFeature.teamDisplayName, label: hub.heismanFeature.teamDisplayName }}
                    size="sm"
                  />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{hub.heismanFeature.teamDisplayName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{hub.heismanFeature.label}</p>
                  </div>
                </div>
              )}
            </StoryCard>

            <StoryCard
              eyebrow="Upset Tracker"
              title={hub.upsetOfTheWeek ? eventLabel(hub.upsetOfTheWeek) : 'No upset yet'}
              body={
                hub.upsetOfTheWeek
                  ? `${hub.upsetOfTheWeek.summary} ${gameScoreLine(hub.upsetOfTheWeek) ?? ''}`.trim()
                  : 'No rank-based upset stands out in the latest completed week yet.'
              }
            >
              {hub.upsetOfTheWeek && (
                <div className="mt-4">
                  <MatchupVisual game={hub.upsetOfTheWeek} compact />
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {gameMetaLine(hub.upsetOfTheWeek)}
                  </p>
                </div>
              )}
            </StoryCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <SurfaceCard>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                National Notebook
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Storylines moving the week
              </h3>
              <div className="mt-4 space-y-3">
                {notebookItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Undefeated Watch
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Teams still protecting the zero
              </h3>
              {hub.undefeatedWatch.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No unbeaten teams are left in this snapshot.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {hub.undefeatedWatch.map((entry) => (
                    <RecordWatchRow key={`${entry.teamName}-${entry.wins}-${entry.losses}`} entry={entry} eyebrow="Unbeaten" />
                  ))}
                </div>
              )}
            </SurfaceCard>
          </div>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/5">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                Top 25
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                AP / Media poll snapshot
              </h3>
            </div>
            {hub.top25.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No ranked teams are recorded in this import yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">AP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Team</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Record</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">Coaches</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">CFP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hub.top25.map((entry) => (
                      <Top25Row key={entry.teamName} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              One-Loss Radar
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              The next line of contenders
            </h3>
            {hub.oneLossWatch.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No one-loss contenders are available yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {hub.oneLossWatch.map((entry) => (
                  <RecordWatchRow key={`${entry.teamName}-${entry.wins}-${entry.losses}`} entry={entry} eyebrow="One loss" />
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Saturday Watch
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {hub.upcomingWeek === null ? 'No upcoming slate yet' : `Week ${hub.upcomingWeek} watchlist`}
            </h3>
            {hub.upcomingGames.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
                No future leaguewide games are available in this season snapshot yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {hub.upcomingGames.map((game) => (
                  <UpcomingGameRow key={`${game.week}-${game.homeTeamName}-${game.awayTeamName}`} game={game} />
                ))}
              </div>
            )}
          </SurfaceCard>

          <StoryCard
            eyebrow="Coach Spotlight"
            title={hub.coachSpotlight ? hub.coachSpotlight.coachName : 'No spotlight yet'}
            body={
              hub.coachSpotlight
                ? hub.coachSpotlight.reason
                : 'Coach spotlight will populate once enough leaguewide season context exists.'
            }
          >
            {hub.coachSpotlight && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
                <CoachPortrait
                  coach={{
                    firstName: hub.coachSpotlight.coachName.split(' ')[0] ?? hub.coachSpotlight.coachName,
                    lastName: hub.coachSpotlight.coachName.split(' ').slice(1).join(' ') || hub.coachSpotlight.coachName,
                    portraitAssetName: hub.coachSpotlight.coachPortraitAssetName,
                  }}
                  size="sm"
                />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{hub.coachSpotlight.teamName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {hub.coachSpotlight.overallWins}-{hub.coachSpotlight.overallLosses}
                    {hub.coachSpotlight.mediaRank ? ` - AP No. ${hub.coachSpotlight.mediaRank}` : ''}
                  </p>
                </div>
              </div>
            )}
          </StoryCard>

          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Around The Conferences
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Current league leaders by race
            </h3>
            {conferenceLeadersPreview.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">Conference race data has not populated yet.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {conferenceLeadersPreview.map((entry) => (
                  <ConferenceLeaderRow key={`${entry.conferenceName}-${entry.teamName}`} entry={entry} />
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Playoff Picture
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Early CFP bracket watch
            </h3>
            {hub.playoffPicture.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No CFP rankings have been recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {hub.playoffPicture.map((entry) => (
                  <PlayoffRow key={`${entry.rank}-${entry.teamName}`} entry={entry} />
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Recruiting Buzz
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Class rankings around the country
            </h3>
            {hub.recruitingBuzz.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No class rankings are available in this save yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {hub.recruitingBuzz.map((entry) => (
                  <RecruitingRow key={`${entry.rank}-${entry.teamName}`} entry={entry} />
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>

      {id && <LeagueRostersSection dynastyId={id} seasonId={seasonId} />}
    </div>
  );
}

/**
 * League-wide roster browse (2026-07-20) — every team in the league from the
 * compressed per-season league snapshot, not just the user's own. Player
 * click opens the shared profile modal (leaguewide fallback: portrait +
 * identity); the pencil opens the same editor every roster uses — the write
 * path was always leaguewide (PresentationId lookup), this is just the first
 * entry point for other teams' players. A season synced before this feature
 * shipped has no league snapshot; the empty state says exactly that.
 */
function LeagueRostersSection({ dynastyId, seasonId }: { dynastyId: string; seasonId?: number }) {
  const [teams, setTeams] = useState<LeagueTeamSummary[] | null | undefined>(undefined);
  const [teamIndex, setTeamIndex] = useState<number | ''>('');
  const [roster, setRoster] = useState<LeagueTeamRoster | null | undefined>(null);
  const [query, setQuery] = useState('');
  const { openPlayerModal } = usePlayerModal();
  const { openPlayerEditor } = useEditorModal();
  const { seasons } = useSelectedSeason();
  const isCurrentSeason = seasons.find((s) => s.id === (roster?.seasonId ?? seasonId))?.isCurrent === true;

  useEffect(() => {
    let cancelled = false;
    setTeams(undefined);
    setTeamIndex('');
    setRoster(null);
    window.api.db.getLeagueTeams(dynastyId, seasonId).then((result) => {
      if (!cancelled) setTeams(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId]);

  useEffect(() => {
    if (teamIndex === '') {
      setRoster(null);
      return;
    }
    let cancelled = false;
    setRoster(undefined);
    window.api.db.getLeagueTeamRoster(dynastyId, teamIndex, seasonId).then((result) => {
      if (!cancelled) setRoster(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, seasonId]);

  const filteredPlayers = (roster && roster !== null ? roster.players : [])
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.position.toLowerCase() === q ||
        String(p.jerseyNumber) === q
      );
    })
    .sort((a, b) => b.overallRating - a.overallRating);

  function statSummary(p: LeagueRosterPlayer): string {
    const s = p.seasonStat?.season;
    if (!s) return '—';
    if (p.seasonStat?.category === 'offense') {
      const line = s as OffensiveStatLine;
      const parts: string[] = [];
      if (line.passAttempts > 0) parts.push(`${line.passYards} pass yds, ${line.passTDs} TD`);
      if (line.rushAttempts > 0) parts.push(`${line.rushYards} rush yds`);
      if (line.receptions > 0) parts.push(`${line.receptions} rec, ${line.receivingYards} yds`);
      return parts.join(' · ') || '—';
    }
    const line = s as DefensiveStatLine;
    const parts = [`${line.tackles + line.assistedTackles} tkl`];
    if (line.sacks > 0) parts.push(`${line.sacks} sck`);
    if (line.interceptions > 0) parts.push(`${line.interceptions} INT`);
    return parts.join(' · ');
  }

  return (
    <SurfaceCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">League Rosters</p>
          <h3 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
            Browse any team in the country.
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={teamIndex}
            onChange={(e) => setTeamIndex(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="League team"
            className="border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
          >
            <option value="">Select a team...</option>
            {(teams ?? []).map((t) => (
              <option key={t.teamIndex} value={t.teamIndex}>
                {t.displayName} ({t.playerCount})
              </option>
            ))}
          </select>
          {roster && roster !== null && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, #, position..."
              aria-label="Search league players"
              className="border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
            />
          )}
        </div>
      </div>

      {teams === null && (
        <p className="mt-4 border border-dashed border-slate-300/80 px-5 py-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
          No league snapshot for this season — league rosters are captured at sync, so re-sync this dynasty to browse
          every team. Seasons synced before this feature shipped can&apos;t be back-filled.
        </p>
      )}
      {roster === undefined && <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading roster...</p>}

      {roster && roster !== null && (
        <div className="mt-4 flex items-center gap-3">
          <TeamLogo team={{ assetName: roster.displayName, label: roster.displayName }} size="md" />
          <p className="font-display text-card-title font-semibold text-slate-950 dark:text-white">
            {roster.displayName} <span className="text-slate-400 dark:text-slate-500">— {filteredPlayers.length} players</span>
          </p>
        </div>
      )}

      {roster && roster !== null && (
        <div className="mt-3 overflow-x-auto border border-slate-200/80 dark:border-slate-800">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-[var(--team-primary)] font-display text-[var(--team-on-primary)]">
              <tr>
                {isCurrentSeason && <th className="px-3 py-2.5" aria-hidden="true" />}
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Pos</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Player</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Class</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.18em]">OVR</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Ht/Wt</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Hometown</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.18em]">Season</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.slice(0, 120).map((p) => (
                <tr
                  key={p.id}
                  onClick={() =>
                    openPlayerModal(
                      dynastyId,
                      p.id,
                      roster.seasonId,
                      filteredPlayers.map((x) => x.id),
                      {
                        name: `${p.firstName} ${p.lastName}`,
                        position: p.position,
                        teamDisplayName: roster.displayName,
                        portraitAssetName: p.portraitAssetName,
                      },
                      roster.teamIndex,
                    )
                  }
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${p.firstName} ${p.lastName}`}
                  className="cursor-pointer border-b border-slate-200/70 bg-white/60 transition last:border-b-0 hover:bg-slate-100/90 dark:border-slate-800/70 dark:bg-transparent dark:hover:bg-white/5"
                >
                  {isCurrentSeason && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <EditButton
                        onClick={() =>
                          openPlayerEditor({
                            dynastyId,
                            playerId: p.id,
                            playerLabel: `${p.firstName} ${p.lastName}`,
                          })
                        }
                        label={`Edit ${p.firstName} ${p.lastName}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.position}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{abbreviateClass(p.schoolYear)}</td>
                  <td className="tnum px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">{p.overallRating}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {Math.floor(p.heightInches / 12)}&apos;{p.heightInches % 12}&quot; {p.weightPounds}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {p.hometown}, {p.homeState}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{statSummary(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPlayers.length > 120 && (
            <p className="border-t border-slate-200/70 px-3 py-2 text-xs text-slate-400 dark:border-slate-800/70">
              Showing top 120 by overall — use search to narrow further.
            </p>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
