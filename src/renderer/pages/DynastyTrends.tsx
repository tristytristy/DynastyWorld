import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  DynastyTheme,
  DynastyTrends as DynastyTrendsData,
  ProgramArc as ProgramArcData,
  SeasonAnalytics,
} from '../../shared/types';
import { PageMasthead } from '../components/common/PageMasthead';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { TrendLineChart, WinLossBars, ChartLegend, type ChartSeries } from '../components/charts/TrendCharts';
import { InfoHint } from '../components/ui/InfoHint';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { TeamLogo } from '../components/common/TeamLogo';
import { SeasonLab } from '../components/charts/SeasonLab';
import { ProgramArc } from '../components/charts/ProgramArc';
import { useGameModal } from '../data/GameModalProvider';
import { resolvePollLineColors, teamSeriesPalette } from '../lib/pollSeriesColors';

/**
 * The polls the game publishes are 25 deep, but the save ranks every FBS team
 * 1-138 (probed across three saves; 255 marks the FCS placeholder rows, and 0
 * means that poll hasn't been released yet).
 *
 * Truncating to the top 25 was tried and reverted. It is defensible in the
 * abstract and useless in practice: a real archive's Auburn season recorded
 * nine weeks at 26-69 with a single week at #25, so the rule discarded the
 * whole trajectory and left an empty panel. The AP and Coaches numbers are a
 * genuine national ordering that exists from week one, and watching it move is
 * the entire point of the chart — the top-25 line is drawn as a reference
 * instead, so "in the poll" stays readable without throwing the season away.
 *
 * 0 is still a real absence: it's how an unreleased poll reads (CFP before its
 * first week), and plotting it drew a flat line pinned above #1.
 */
const POLL_TEAM_COUNT = 138;
/** The published-poll cutoff, drawn as a reference line rather than a filter. */
const POLL_DEPTH = 25;
function rankedOrNull(rank: number | null): number | null {
  if (rank === null || rank < 1 || rank > POLL_TEAM_COUNT) return null;
  return rank;
}

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
    <section className="corner-cut-sm border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h3 className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</h3>
          {subtitle && <InfoHint label={`About ${title}`}>{subtitle}</InfoHint>}
        </div>
        {legend}
      </div>
      {children}
    </section>
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
  const { openGameModal } = useGameModal();
  const [trends, setTrends] = useState<DynastyTrendsData | null | undefined>(undefined);
  /** Season = this year explained. Yearly = the dynasty across years. */
  const [view, setView] = useState<'season' | 'yearly'>('season');
  const [analytics, setAnalytics] = useState<SeasonAnalytics | null | undefined>(undefined);
  // The poll chart is painted in the team's own two colors, so it needs the real
  // hexes in JS (not just the CSS vars) to decide the substitutions — see
  // lib/pollSeriesColors.ts. Same call DynastyLayout uses to theme the shell.
  const [seasonTheme, setSeasonTheme] = useState<DynastyTheme | null>(null);
  /** Program Arc spans every season, so it's fetched once per dynasty rather than per selected season. */
  const [arc, setArc] = useState<ProgramArcData | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setTrends(undefined);
    window.api.db.getDynastyTrends(id).then((result) => {
      if (!cancelled) setTrends(result);
    });
    setAnalytics(undefined);
    window.api.db.getSeasonAnalytics(id, selectedSeasonId ?? undefined).then((result) => {
      if (!cancelled) setAnalytics(result);
    });
    window.api.db.getSeasonTheme(id, selectedSeasonId ?? undefined).then((result) => {
      if (!cancelled) setSeasonTheme(result);
    });
    window.api.db.getProgramArc(id).then((result) => {
      if (!cancelled) setArc(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, selectedSeasonId]);

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
  if (!id) {
    return <p className="text-slate-500 dark:text-slate-400">No trend data for this dynasty yet.</p>;
  }

  // Only the YEARLY view needs trend data. Bailing out of the whole page on
  // `trends === null` meant a preseason or history-only dynasty never even saw
  // the toggle, and Season Lab's own empty copy was unreachable — so the team
  // name (needed by the header and the knob) falls back to the season analytics,
  // and each view states its own absence below.
  const teamName = trends?.teamName ?? analytics?.teamName ?? null;

  // ---- series builders ----
  // Resolved for BOTH surfaces up front — the substitutions differ by theme
  // (a white secondary only disappears on the light page), and handing the
  // chart a light/dark pair lets its own theme switch do the choosing.
  const pollLight = resolvePollLineColors(
    seasonTheme?.primaryColor ?? null,
    seasonTheme?.secondaryColor ?? null,
    false,
  );
  const pollDark = resolvePollLineColors(
    seasonTheme?.primaryColor ?? null,
    seasonTheme?.secondaryColor ?? null,
    true,
  );
  const pollColors = {
    coaches: { light: pollLight.coaches, dark: pollDark.coaches },
    ap: { light: pollLight.ap, dark: pollDark.ap },
    cfp: { light: pollLight.cfp, dark: pollDark.cfp },
  };
  // Every chart on this page is a single program's story, so they're painted in
  // that program's own colours rather than the app's neutral categorical set —
  // a bright blue chart inside a maroon-themed app read as a foreign brand.
  const palette = teamSeriesPalette(
    seasonTheme?.primaryColor ?? null,
    seasonTheme?.secondaryColor ?? null,
  );

  const recruitingSeries: ChartSeries[] = [
    {
      key: 'recruiting',
      label: 'Class rank',
      color: palette[0],
      points: seasons.map((s) => ({ x: s.seasonYear, y: s.recruitingClassRank })),
    },
  ];
  const hasRecruiting = seasons.some((s) => s.recruitingClassRank !== null);

  const pointsSeries: ChartSeries[] = [
    { key: 'for', label: 'For', color: palette[0], points: seasons.map((s) => ({ x: s.seasonYear, y: s.pointsFor })) },
    { key: 'against', label: 'Against', color: palette[1], points: seasons.map((s) => ({ x: s.seasonYear, y: s.pointsAgainst })) },
  ];
  const hasPoints = seasons.some((s) => s.pointsFor !== null);

  const weeklyRows = weeklySeason?.rankingWeeks ?? [];
  // The CFP poll doesn't exist until it's first released. Probed across three
  // saves: every team reads CFPPoll_CurrentRank = 0 before the first CFP poll,
  // which the chart was plotting as rank zero — a flat line pinned above #1.
  const cfpReleased = weeklyRows.some((w) => rankedOrNull(w.cfpRank) !== null);
  const weeklySeries: ChartSeries[] = weeklySeason
    ? [
        {
          key: 'coaches',
          label: 'Coaches',
          color: pollColors.coaches,
          points: weeklyRows.map((w) => ({ x: w.week, y: rankedOrNull(w.coachesRank) })),
        },
        {
          key: 'media',
          label: 'AP',
          color: pollColors.ap,
          points: weeklyRows.map((w) => ({ x: w.week, y: rankedOrNull(w.mediaRank) })),
        },
        ...(cfpReleased
          ? [
              {
                key: 'cfp',
                label: 'CFP',
                color: pollColors.cfp,
                dashed: true,
                points: weeklyRows.map((w) => ({ x: w.week, y: rankedOrNull(w.cfpRank) })),
              } satisfies ChartSeries,
            ]
          : []),
      ]
    : [];
  const weeklyWeeks = weeklyRows.map((w) => w.week);
  const hasWeekly = weeklySeries.some((s) => s.points.some((p) => p.y !== null));

  return (
    <div className="space-y-6">
      <PageMasthead
        eyebrow="Analytics"
        title={teamName ?? 'Analytics'}
        subtitle="By the numbers"
        description={
          view === 'season'
            ? 'Every played game, quarter by quarter, against the rest of the country — read from this season’s own results.'
            : "Every season you sync builds this out. Program record, poll trajectory, recruiting, and scoring — read straight from the multi-season archive the game itself doesn't keep."
        }
        mark={{ kind: 'helmet', teamAssetName: teamName ?? '' }}
      />

      <ToggleSwitch<'season' | 'yearly'>
        value={view}
        onChange={setView}
        left={{ value: 'season', label: 'Season' }}
        right={{ value: 'yearly', label: 'Yearly' }}
        ariaLabel="Analytics scope"
        knob={
          teamName ? (
            <TeamLogo
              team={{ assetName: teamName, label: teamName }}
              size="sm"
              variant="gold"
              className="h-[35px] w-[35px]"
            />
          ) : undefined
        }
      />

      {view === 'season' ? (
        analytics === undefined ? (
          <SurfaceCard>
            <EmptyChart message="Reading this season…" />
          </SurfaceCard>
        ) : analytics === null ? (
          <SurfaceCard>
            <EmptyChart message="No season selected." />
          </SurfaceCard>
        ) : (
          <div className="space-y-4">
            <SeasonLab
              analytics={analytics}
              onSelectGame={(gameId) => id && openGameModal(id, gameId, analytics.seasonId)}
            />
            {/* Poll trajectory is inherently a single-season story — it lived on
                the yearly view, where it was the only chart not spanning years. */}
            <ChartCard
              title={`Poll trajectory${weeklySeason ? ` — ${weeklySeason.seasonYear}` : ''}`}
              subtitle="Week by week, lower is better. The AP and Coaches polls run all season and rank every team in the country, so the dashed line marks the top 25 — above it you're in the published poll. The CFP line only appears once that poll is first released. Builds up as you sync through a season."
              legend={
                hasWeekly ? (
                  <ChartLegend
                    items={weeklySeries.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))}
                  />
                ) : undefined
              }
            >
              {hasWeekly ? (
                <TrendLineChart
                  series={weeklySeries}
                  xTicks={weeklyWeeks}
                  formatX={(x) => `Wk ${x}`}
                  formatY={rankFmt}
                  yInverted
                  yMinHint={1}
                  yReference={{ value: POLL_DEPTH, label: 'Top 25' }}
                  /* The exact rank is on hover. Printed on the plot, three
                     series' worth of numbers buried the shape of the run. */
                  showValues={false}
                />
              ) : (
                <EmptyChart message="No weekly poll history for this season yet. Sync as you play and the line builds up week by week." />
              )}
            </ChartCard>
          </div>
        )
      ) : seasons.length === 0 ? (
        <SurfaceCard>
          <EmptyChart message="No seasons archived yet. Sync a season to start the trend lines." />
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Program record by season" subtitle="Wins stacked over losses — the shape of the dynasty.">
            <WinLossBars
              color={palette[0]}
              seasons={seasons.map((s) => ({ seasonYear: s.seasonYear, wins: s.wins, losses: s.losses }))}
            />
          </ChartCard>

          {/* Program Arc — prestige, unit grades and efficiency, all read from
              snapshots already on disk, so these fill in for seasons synced
              long before the feature existed. Rendered inside the same grid so
              the whole Yearly view reads as one board. */}
          {arc && <ProgramArc arc={arc} palette={palette} />}


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
            legend={<ChartLegend items={[{ label: 'For', color: palette[0] }, { label: 'Against', color: palette[1] }]} />}
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
