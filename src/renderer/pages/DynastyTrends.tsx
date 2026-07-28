import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DynastyTrends as DynastyTrendsData } from '../../shared/types';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { TrendLineChart, WinLossBars, ChartLegend, type ChartSeries } from '../components/charts/TrendCharts';
import { InfoHint } from '../components/ui/InfoHint';

function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            <span>{title}</span>
            {subtitle && <InfoHint label={`About ${title}`}>{subtitle}</InfoHint>}
          </h3>
        </div>
        {legend}
      </div>
      <div className="mt-4">{children}</div>
    </SurfaceCard>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300/80 px-6 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
      {message}
    </div>
  );
}

const rankFmt = (y: number) => `#${Math.round(y)}`;

export function DynastyTrends() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId } = useSelectedSeason();
  const [trends, setTrends] = useState<DynastyTrendsData | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setTrends(undefined);
    window.api.db.getDynastyTrends(id).then((result) => {
      if (!cancelled) setTrends(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const seasons = useMemo(() => trends?.seasons ?? [], [trends]);
  const seasonYears = useMemo(() => seasons.map((s) => s.seasonYear), [seasons]);

  // Weekly poll trajectory is inherently per-season — follow the season switcher.
  const weeklySeason = useMemo(
    () => seasons.find((s) => s.seasonId === selectedSeasonId) ?? seasons[seasons.length - 1],
    [seasons, selectedSeasonId],
  );

  if (trends === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading trends...</p>;
  }
  if (trends === null || !id) {
    return <p className="text-slate-500 dark:text-slate-400">No trend data for this dynasty yet.</p>;
  }

  // ---- series builders ----
  const recruitingSeries: ChartSeries[] = [
    {
      key: 'recruiting',
      label: 'Class rank',
      color: 'blue',
      points: seasons.map((s) => ({ x: s.seasonYear, y: s.recruitingClassRank })),
    },
  ];
  const hasRecruiting = seasons.some((s) => s.recruitingClassRank !== null);

  const pointsSeries: ChartSeries[] = [
    { key: 'for', label: 'For', color: 'blue', points: seasons.map((s) => ({ x: s.seasonYear, y: s.pointsFor })) },
    { key: 'against', label: 'Against', color: 'orange', points: seasons.map((s) => ({ x: s.seasonYear, y: s.pointsAgainst })) },
  ];
  const hasPoints = seasons.some((s) => s.pointsFor !== null);

  const weeklySeries: ChartSeries[] = weeklySeason
    ? [
        { key: 'media', label: 'AP', color: 'blue', points: weeklySeason.rankingWeeks.map((w) => ({ x: w.week, y: w.mediaRank })) },
        { key: 'coaches', label: 'Coaches', color: 'green', points: weeklySeason.rankingWeeks.map((w) => ({ x: w.week, y: w.coachesRank })) },
        { key: 'cfp', label: 'CFP', color: 'magenta', points: weeklySeason.rankingWeeks.map((w) => ({ x: w.week, y: w.cfpRank })) },
      ]
    : [];
  const weeklyWeeks = weeklySeason?.rankingWeeks.map((w) => w.week) ?? [];
  const hasWeekly = weeklySeries.some((s) => s.points.filter((p) => p.y !== null).length >= 2);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dynasty Trends"
        title={`${trends.teamName} — the archive in charts.`}
        description="Every season you sync builds this out. Program record, poll trajectory, recruiting, and scoring — read straight from the multi-season archive the game itself doesn't keep."
      />

      {seasons.length === 0 ? (
        <SurfaceCard>
          <EmptyChart message="No seasons archived yet. Sync a season to start the trend lines." />
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Program record by season" subtitle="Wins stacked over losses — the shape of the dynasty.">
            <WinLossBars seasons={seasons.map((s) => ({ seasonYear: s.seasonYear, wins: s.wins, losses: s.losses }))} />
          </ChartCard>

          <ChartCard
            title={`Poll trajectory${weeklySeason ? ` — ${weeklySeason.seasonYear}` : ''}`}
            subtitle="Week by week, lower is better. Builds up as you sync through a season."
            legend={<ChartLegend items={[{ label: 'AP', color: 'blue' }, { label: 'Coaches', color: 'green' }, { label: 'CFP', color: 'magenta' }]} />}
          >
            {hasWeekly ? (
              <TrendLineChart series={weeklySeries} xTicks={weeklyWeeks} formatX={(x) => `Wk ${x}`} formatY={rankFmt} yInverted yMinHint={1} />
            ) : (
              <EmptyChart message="Not enough weekly poll history for this season yet. Sync across multiple weeks to draw the line." />
            )}
          </ChartCard>

          <ChartCard title="Recruiting class rank" subtitle="National class finish per season, lower is better.">
            {hasRecruiting ? (
              <TrendLineChart series={recruitingSeries} xTicks={seasonYears} formatX={(x) => String(x)} formatY={rankFmt} yInverted yMinHint={1} />
            ) : (
              <EmptyChart message="No recruiting class ranks recorded yet." />
            )}
          </ChartCard>

          <ChartCard
            title="Points for and against"
            subtitle="Season scoring totals, from every game result on record."
            legend={<ChartLegend items={[{ label: 'For', color: 'blue' }, { label: 'Against', color: 'orange' }]} />}
          >
            {hasPoints ? (
              <TrendLineChart series={pointsSeries} xTicks={seasonYears} formatX={(x) => String(x)} />
            ) : (
              <EmptyChart message="No completed games on record yet." />
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
