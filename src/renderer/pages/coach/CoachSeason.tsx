import { offenseYards } from '../../../shared/teamYards';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoachPortrait } from '../../components/common/CoachPortrait';
import { spaceCamelCase } from '../../components/common/CoachCard';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatTile } from '../../components/ui/StatTile';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TrendLineChart, ChartLegend, type ChartSeries } from '../../components/charts/TrendCharts';
import { useGameModal } from '../../data/GameModalProvider';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { useCachedFetch, useCoachHubReady } from './coachData';
import { TONE_CLASS, jobSecurityEvaluation, recordLine } from './coachMetrics';
import { unitSnapshot } from './coachOverviewMetrics';
import {
  buildSignatures,
  buildSplits,
  buildTimeline,
  isWin,
  margin,
  played,
  postseasonSummary,
  type PlayedGame,
} from './coachSeasonMetrics';
import type { NationalTeamStatRow, RecruitingOverview, ScheduleOverview } from '../../../shared/types';

type SeriesMode = 'points' | 'margin' | 'yards';

/**
 * Coach Season — "what is happening this year?". The page you open after each
 * game or import.
 *
 * ONE CHART, SELECTABLE, rather than three disconnected ones: points, margin and
 * yardage are the same season asked three ways, and stacking three plots would
 * make the page longer without making it clearer.
 *
 * THE GLOBAL SEASON SELECTOR DRIVES THIS PAGE, which is why the job-security
 * evaluation only appears when the season on screen is the current one — job
 * security is a fact about right now, and printing today's standing over a 2026
 * scorecard would be presenting a current claim as a historical one.
 */
export function CoachSeason() {
  const { dynastyId, seasonId, overview, staff } = useCoachHubReady();
  const { seasons } = useSelectedSeason();
  const { openGameModal } = useGameModal();
  const cached = useCachedFetch();
  const userCoach = useCoachHubReady().userCoach;

  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [national, setNational] = useState<NationalTeamStatRow[] | null>(null);
  const [priorNational, setPriorNational] = useState<NationalTeamStatRow[] | null>(null);
  const [recruiting, setRecruiting] = useState<RecruitingOverview | null>(null);
  const [mode, setMode] = useState<SeriesMode>('points');

  const selectedSeason = seasons.find((s) => s.id === seasonId) ?? seasons.find((s) => s.isCurrent);
  const isCurrentSeason = selectedSeason?.isCurrent ?? false;

  const priorSeasonId = useMemo(() => {
    if (!selectedSeason) return undefined;
    return seasons
      .filter((s) => s.hasFullData && s.seasonYear < selectedSeason.seasonYear)
      .sort((a, b) => b.seasonYear - a.seasonYear)[0]?.id;
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (!dynastyId) return;
    let cancelled = false;
    setSchedule(undefined);
    setNational(null);
    setPriorNational(null);
    setRecruiting(null);

    cached(`schedule:${dynastyId}:${seasonId ?? 'current'}`, () => window.api.db.getSchedule(dynastyId, seasonId)).then((r) => {
      if (!cancelled) setSchedule(r);
    });
    cached(`national:${dynastyId}:${seasonId ?? 'current'}`, () =>
      window.api.db.getNationalTeamStats(dynastyId, seasonId),
    ).then((r) => {
      if (!cancelled) setNational(r);
    });
    cached(`recruits:${dynastyId}:${seasonId ?? 'current'}`, () => window.api.db.getRecruits(dynastyId, seasonId)).then((r) => {
      if (!cancelled) setRecruiting(r);
    });
    if (priorSeasonId !== undefined) {
      cached(`national:${dynastyId}:${priorSeasonId}`, () =>
        window.api.db.getNationalTeamStats(dynastyId, priorSeasonId),
      ).then((r) => {
        if (!cancelled) setPriorNational(r);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, priorSeasonId, cached]);

  const games = played(schedule ?? null);
  const splits = buildSplits(schedule ?? null);
  const signatures = buildSignatures(schedule ?? null);
  const timeline = buildTimeline(schedule ?? null, overview.teamName);
  const teamIndex = userCoach?.teamIndex ?? null;
  const units = unitSnapshot(national, teamIndex);
  const priorUnits = unitSnapshot(priorNational, teamIndex);

  if (schedule === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading season...</p>;
  }

  if (games.length === 0) {
    return (
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">{overview.seasonYear} Season</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">No games played yet</h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Once this season&apos;s games start being played, the scorecard, trends, splits and signature results fill in
          here.
        </p>
      </SurfaceCard>
    );
  }

  const wins = games.filter(isWin).length;
  const losses = games.length - wins;
  const avgMargin = games.reduce((sum, g) => sum + margin(g), 0) / games.length;
  const rank = overview.rankings.media ?? overview.rankings.cfp ?? overview.rankings.coaches;
  const coordinators = staff.filter(
    (c) => c.position === 'OffensiveCoordinator' || c.position === 'DefensiveCoordinator',
  );

  return (
    <div className="space-y-6">
      {/* ── A. SCORECARD ─────────────────────────────────────────────────── */}
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">{overview.seasonYear} Scorecard</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Record" value={recordLine(wins, losses)} />
          <StatTile
            label="Conference"
            value={recordLine(overview.conferenceRecord.wins, overview.conferenceRecord.losses)}
          />
          <StatTile label="Win rate" value={`${Math.round((wins / games.length) * 1000) / 10}%`} />
          <StatTile
            label="Scoring margin"
            value={`${avgMargin > 0 ? '+' : ''}${(Math.round(avgMargin * 10) / 10).toFixed(1)}`}
            hint="per game"
          />
          <StatTile label={isCurrentSeason ? 'Ranking' : 'Final ranking'} value={rank && rank > 0 ? `#${rank}` : 'Unranked'} />
          <StatTile label="Postseason" value={postseasonSummary(schedule)} />
        </div>
        {/* Current-season-only: a standing about the job today, never printed over a past season. */}
        {isCurrentSeason && userCoach && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                TONE_CLASS[jobSecurityEvaluation(userCoach.currentJobSecurityStatus).tone]
              }`}
            >
              AD evaluation · {jobSecurityEvaluation(userCoach.currentJobSecurityStatus).label}
            </span>
          </div>
        )}
      </SurfaceCard>

      {/* ── B. PERFORMANCE TRENDS ────────────────────────────────────────── */}
      <SurfaceCard>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Performance</p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Game by game
            </h3>
          </div>
          <SegmentedControl
            value={mode}
            onChange={setMode}
            size="sm"
            ariaLabel="Chart series"
            options={[
              { value: 'points', label: 'Points' },
              { value: 'margin', label: 'Margin' },
              { value: 'yards', label: 'Yards' },
            ]}
          />
        </div>
        <SeasonChart games={games} mode={mode} />
      </SurfaceCard>

      {/* ── C. SPLITS ────────────────────────────────────────────────────── */}
      {splits.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Record splits</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {splits.map((split) => (
              <div
                key={split.key}
                className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5"
              >
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">{split.label}</p>
                <p className="tnum mt-2 font-display text-xl font-bold text-slate-950 dark:text-white">
                  {recordLine(split.wins, split.losses)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Only splits with games behind them are shown. &quot;vs Ranked&quot; counts games where the opponent&apos;s
            rank was recorded at kickoff.
          </p>
        </SurfaceCard>
      )}

      {/* ── D. SIGNATURE RESULTS ─────────────────────────────────────────── */}
      {signatures.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Signature results</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {signatures.map((sig) => (
              <button
                key={sig.key}
                type="button"
                onClick={() => openGameModal(dynastyId, sig.game.gameId, seasonId)}
                className="corner-cut-sm flex w-full items-center justify-between gap-3 border border-slate-200/80 bg-slate-50/85 p-3 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">{sig.label}</p>
                  <p className="mt-1.5 truncate font-semibold text-slate-900 dark:text-white">
                    {sig.game.isHome ? 'vs' : 'at'} {sig.game.opponent}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Week {sig.game.week}</p>
                </div>
                <p
                  className={`tnum shrink-0 font-display text-xl font-bold ${
                    isWin(sig.game) ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {sig.game.teamScore}-{sig.game.opponentScore}
                </p>
              </button>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* ── E. UNIT REPORT ───────────────────────────────────────────────── */}
      {units && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Unit report</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <UnitPanel
              title="Offense"
              coach={coordinators.find((c) => c.position === 'OffensiveCoordinator') ?? null}
              teamName={overview.teamName}
              rows={[
                { label: 'Points / game', value: units.pointsPerGame, rank: units.pointsRank, prior: priorUnits?.pointsPerGame ?? null, higherIsBetter: true },
                { label: 'Yards / game', value: units.yardsPerGame, rank: units.yardsRank, prior: priorUnits?.yardsPerGame ?? null, higherIsBetter: true },
              ]}
            />
            <UnitPanel
              title="Defense"
              coach={coordinators.find((c) => c.position === 'DefensiveCoordinator') ?? null}
              teamName={overview.teamName}
              rows={[
                { label: 'Points allowed / game', value: units.pointsAllowedPerGame, rank: units.pointsAllowedRank, prior: priorUnits?.pointsAllowedPerGame ?? null, higherIsBetter: false },
                { label: 'Yards allowed / game', value: units.yardsAllowedPerGame, rank: units.yardsAllowedRank, prior: priorUnits?.yardsAllowedPerGame ?? null, higherIsBetter: false },
              ]}
            />
          </div>
        </SurfaceCard>
      )}

      {/* ── F. RECRUITING SUMMARY ────────────────────────────────────────── */}
      {recruiting && (recruiting.classSummary.signedCount > 0 || recruiting.classSummary.committedCount > 0) && (
        <SurfaceCard>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recruiting</p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                {overview.seasonYear} class
              </h3>
            </div>
            <Link
              to={`/dynasty/${dynastyId}/recruiting`}
              className="text-xs font-semibold text-[var(--team-accent-text)] underline-offset-4 hover:underline"
            >
              Full board →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="National rank"
              value={
                recruiting.classSummary.nationalClassRank ? `#${recruiting.classSummary.nationalClassRank}` : 'Unranked'
              }
            />
            <StatTile
              label="Conference rank"
              value={
                recruiting.classSummary.conferenceClassRank
                  ? `#${recruiting.classSummary.conferenceClassRank}`
                  : 'Unranked'
              }
            />
            <StatTile label="Signed" value={String(recruiting.classSummary.signedCount)} />
            <StatTile
              label="Average stars"
              value={
                recruiting.classSummary.averageStars === null
                  ? '—'
                  : recruiting.classSummary.averageStars.toFixed(1)
              }
            />
          </div>
        </SurfaceCard>
      )}

      {/* ── G. SEASON TIMELINE ───────────────────────────────────────────── */}
      {timeline.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Season timeline</p>
          <ul className="mt-4 space-y-2">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="corner-cut-sm flex flex-wrap items-center gap-3 border-l-[3px] border-l-[var(--team-primary)]/60 border-y border-r border-y-slate-200/70 border-r-slate-200/70 bg-slate-50/70 px-3 py-2.5 dark:border-y-slate-800 dark:border-r-slate-800 dark:bg-white/5"
              >
                <span className="tnum w-14 shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Wk {event.week}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900 dark:text-white">{event.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{event.detail}</span>
                </span>
                {event.gameId !== null && (
                  <button
                    type="button"
                    onClick={() => openGameModal(dynastyId, event.gameId!, seasonId)}
                    className="shrink-0 text-xs font-semibold text-[var(--team-accent-text)] underline-offset-4 hover:underline"
                  >
                    Box score
                  </button>
                )}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}
    </div>
  );
}

/**
 * The one chart, in three readings. Yardage comes from each game's own stat
 * line, which the save does carry per game — so this is measured, not a season
 * average smeared across weeks. Games missing a stat line contribute a null,
 * which TrendLineChart draws as a genuine gap rather than interpolating.
 */
function SeasonChart({ games, mode }: { games: PlayedGame[]; mode: SeriesMode }) {
  const weeks = games.map((g) => g.week);
  const series: ChartSeries[] = useMemo(() => {
    if (mode === 'margin') {
      return [
        {
          key: 'margin',
          label: 'Margin',
          color: 'blue',
          points: games.map((g) => ({ x: g.week, y: margin(g) })),
        },
      ];
    }
    if (mode === 'yards') {
      return [
        {
          key: 'for',
          label: 'Yards gained',
          color: 'blue',
          points: games.map((g) => ({ x: g.week, y: g.teamStats ? offenseYards(g.teamStats) : null })),
        },
        {
          key: 'against',
          label: 'Yards allowed',
          color: 'orange',
          dashed: true,
          points: games.map((g) => ({ x: g.week, y: g.opponentStats ? offenseYards(g.opponentStats) : null })),
        },
      ];
    }
    return [
      {
        key: 'for',
        label: 'Points scored',
        color: 'blue',
        points: games.map((g) => ({ x: g.week, y: g.teamScore })),
      },
      {
        key: 'against',
        label: 'Points allowed',
        color: 'orange',
        dashed: true,
        points: games.map((g) => ({ x: g.week, y: g.opponentScore })),
      },
    ];
  }, [games, mode]);

  const hasAnyPoint = series.some((s) => s.points.some((p) => p.y !== null));
  if (!hasAnyPoint) {
    return (
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        No per-game yardage was recorded for this season.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <TrendLineChart
        series={series}
        xTicks={weeks}
        formatX={(x) => `Wk ${x}`}
        showValues={games.length <= 10}
        yReference={mode === 'margin' ? { value: 0, label: 'Even' } : undefined}
      />
      <div className="mt-2">
        <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
      </div>
    </div>
  );
}

/** One side of the ball, with the coordinator who owns it. */
function UnitPanel({
  title,
  coach,
  teamName,
  rows,
}: {
  title: string;
  coach: { firstName: string; lastName: string; position: string; portraitAssetName: string | null } | null;
  teamName: string;
  rows: { label: string; value: number; rank: number | null; prior: number | null; higherIsBetter: boolean }[];
}) {
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <div className="flex items-center gap-3">
        {coach && <CoachPortrait coach={coach} teamAssetName={teamName} size="sm" className="!h-10 !w-10" />}
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-slate-950 dark:text-white">{title}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {coach ? `${coach.firstName} ${coach.lastName} · ${spaceCamelCase(coach.position)}` : 'No coordinator on staff'}
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => {
          const delta = row.prior === null ? null : Math.round((row.value - row.prior) * 10) / 10;
          const improved = delta === null || delta === 0 ? null : row.higherIsBetter ? delta > 0 : delta < 0;
          return (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-slate-500 dark:text-slate-400">{row.label}</dt>
              <dd className="flex items-baseline gap-2">
                {delta !== null && delta !== 0 && (
                  <span
                    className={`tnum text-xs font-semibold ${
                      improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(1)}
                  </span>
                )}
                {row.rank !== null && (
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">#{row.rank}</span>
                )}
                <span className="tnum font-display text-lg font-bold text-slate-950 dark:text-white">
                  {row.value.toFixed(1)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
