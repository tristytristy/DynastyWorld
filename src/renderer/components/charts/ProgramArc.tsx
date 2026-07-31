import { useState } from 'react';
import { InfoHint } from '../ui/InfoHint';
import { TrendLineChart, type ChartSeries } from './TrendCharts';
import { useTheme } from '../../theme/ThemeProvider';
import type { ThemedColor } from '../../lib/pollSeriesColors';
import type {
  ProgramArc as ProgramArcData,
  ProgramArcRanked,
  ProgramEfficiencyRow,
  ProgramPrestigeSeason,
  ProgramUnitRow,
} from '../../../shared/types';

/**
 * Program Arc — the Yearly view's exhibits. Season Lab explains one season;
 * these read the same material across every year on record.
 *
 * Shared conventions with Season Lab, deliberately: inline layout rather than a
 * chart dependency, team colour as an accent, and nothing that rests on colour
 * alone — every shaded cell also prints its number and carries its national
 * rank in the tooltip.
 */

const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${n % 10 <= 3 ? suffix : 'th'}`;
};

const rankText = (m: ProgramArcRanked) => (m.nationalRank === null ? 'unranked' : `#${m.nationalRank} nationally`);

/** Top-25 nationally is the threshold the rest of the app already treats as "elite". */
const isElite = (m: ProgramArcRanked) => m.nationalRank !== null && m.nationalRank <= 25;

/**
 * Percentile → background strength. Shading on the PERCENTILE rather than the
 * raw value is the whole trick here: position grades cluster in the 60s and 70s
 * across the entire country, so colouring by grade produces twelve rows of
 * identical beige. Colouring by where that grade placed nationally makes a 72
 * QB in a weak year look different from a 72 QB in a strong one, which is the
 * actual story.
 */
function tint(percentile: number | null): string {
  if (percentile === null) return 'transparent';
  const strength = Math.round(10 + (percentile / 100) * 62);
  return `color-mix(in srgb, var(--team-primary) ${strength}%, transparent)`;
}

function fmtValue(value: number, format: ProgramEfficiencyRow['format']): string {
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'plusMinus') return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  return value.toFixed(1);
}

/* ────────────────────────── Prestige arc ────────────────────────── */

/**
 * The program's own trajectory: the game's 0-10 prestige, one column per season,
 * with where that placed nationally and the year-over-year move. This is the
 * number a dynasty player actually checks — "is the program rising?" — and it
 * is a real field on every team, not something derived.
 */
function PrestigeArc({ prestige, max }: { prestige: ProgramPrestigeSeason[]; max: number }) {
  if (prestige.length === 0) return null;
  const latest = prestige[prestige.length - 1];
  const first = prestige[0];
  const lifetime = prestige.length > 1 ? latest.value - first.value : null;

  return (
    <div>
      <div className="flex items-end gap-4">
        <div>
          <p className="tnum text-4xl font-bold leading-none text-slate-900 dark:text-white">
            {latest.value}
            <span className="text-lg font-semibold text-slate-400 dark:text-slate-500">/{max}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {latest.seasonYear} · {rankText(latest)}
            {latest.conferenceName && latest.conferenceRank !== null
              ? ` · ${ordinal(latest.conferenceRank)} in the ${latest.conferenceName}`
              : ''}
          </p>
        </div>
        {lifetime !== null && (
          <p
            className={`tnum mb-1 text-sm font-semibold ${
              lifetime > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : lifetime < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {lifetime > 0 ? '+' : ''}
            {lifetime} since {first.seasonYear}
          </p>
        )}
      </div>

      {/* One column per season, each a full-height TRACK with prestige filled
          from the bottom. The empty part of the track is the point: a bare bar
          sized to the value can't show that a 3 is 3-out-of-10 — it just looks
          like a short bar, and two seasons apart by one point looked like a
          rout. The track makes the ceiling visible. */}
      <div className="mt-4 flex items-stretch gap-2" style={{ height: 104 }}>
        {prestige.map((p) => (
          <div
            key={p.seasonId}
            className="relative flex min-w-0 flex-1 flex-col justify-end border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]"
            title={`${p.seasonYear}: prestige ${p.value} of ${max} · ${rankText(p)}${p.comparedTeams ? ` of ${p.comparedTeams}` : ''}`}
          >
            <span
              className="w-full bg-[var(--team-primary)]"
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
            <span className="tnum absolute inset-x-0 top-1 text-center text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {p.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 border-t border-slate-200 pt-1 dark:border-white/10">
        {prestige.map((p) => (
          <div key={p.seasonId} className="min-w-0 flex-1 text-center">
            <p className="tnum text-[10px] text-slate-500 dark:text-slate-400">{p.seasonYear}</p>
            <p
              className={`tnum text-[10px] ${
                isElite(p) ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {p.nationalRank === null ? '—' : `#${p.nationalRank}`}
            </p>
            {p.changeFromPrevious !== null && p.changeFromPrevious !== 0 && (
              <p
                className={`tnum text-[10px] font-semibold ${
                  p.changeFromPrevious > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {p.changeFromPrevious > 0 ? '▲' : '▼'}
                {Math.abs(p.changeFromPrevious)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── Unit heat map ────────────────────────── */

/**
 * How the roster was built, one row per position group and one column per
 * season. The grade is the game's own 0-99 Team Ratings number; the shading is
 * its national percentile that year (see `tint`).
 */
function UnitHeatMap({ units }: { units: ProgramUnitRow[] }) {
  if (units.length === 0) return null;
  const years = [...new Set(units.flatMap((u) => u.seasons.map((s) => s.seasonYear)))].sort((a, b) => a - b);

  // The table is deliberately NOT w-full: at three seasons a full-width table
  // stretched each cell to ~350px, which read as a chart of enormous blocks.
  // Fixed column widths keep a cell a cell; more seasons extend to the right
  // and scroll, which is the correct direction for a timeline.
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-left">
        <thead>
          <tr>
            <th className="w-[6.5rem] pb-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">Unit</th>
            {years.map((y) => (
              <th key={y} className="tnum w-[4.5rem] pb-1 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.key}>
              <td
                className={`pr-2 text-[11px] ${
                  u.isSummary
                    ? 'border-t border-slate-200 pt-1 font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {u.label}
              </td>
              {years.map((y) => {
                const cell = u.seasons.find((s) => s.seasonYear === y);
                if (!cell) {
                  return (
                    <td key={y} className={`text-center text-[11px] text-slate-300 dark:text-slate-700 ${u.isSummary ? 'border-t border-slate-200 pt-1 dark:border-white/10' : ''}`}>
                      ·
                    </td>
                  );
                }
                return (
                  <td
                    key={y}
                    title={`${u.label} ${y}: ${cell.value} · ${rankText(cell)}${cell.comparedTeams ? ` of ${cell.comparedTeams}` : ''}`}
                    /* A top-25 unit is called out by WEIGHT, not by an outline:
                       the ring that used to mark it was a white stroke that
                       belonged to no part of the brand. */
                    className={`tnum h-7 text-center text-[11px] ${
                      isElite(cell)
                        ? 'font-bold text-slate-950 dark:text-white'
                        : 'font-semibold text-slate-800 dark:text-slate-100'
                    } ${u.isSummary ? 'border-t border-slate-200 pt-1 dark:border-white/10' : ''}`}
                    style={{ backgroundColor: tint(cell.nationalPercentile) }}
                  >
                    {cell.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] leading-4 text-slate-400 dark:text-slate-500">
        The number is the game&apos;s own position grade; the shade is where it placed nationally that season, which is
        what separates a 72 in a weak year from a 72 in a strong one. A <span className="font-bold text-slate-900 dark:text-white">bolder</span> number
        is a top-25 unit. Hover any cell for its rank.
      </p>
    </div>
  );
}

/* ────────────────────────── Efficiency trends ────────────────────────── */

/** A bare sparkline — shape only. The numbers beside it carry the detail. */
function Spark({ values, lowerIsBetter }: { values: number[]; lowerIsBetter: boolean }) {
  if (values.length < 2) return <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 96;
  const H = 22;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    // Up is always better, whichever direction the metric runs — otherwise a
    // falling "points allowed" line would read as decline when it's improvement.
    const t = (v - min) / span;
    const y = H - (lowerIsBetter ? 1 - t : t) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden="true">
      <polyline points={points.join(' ')} fill="none" stroke="var(--team-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={Number(points[points.length - 1].split(',')[1])} r={2} fill="var(--team-primary)" />
    </svg>
  );
}

function EfficiencyTrends({ efficiency, palette }: { efficiency: ProgramEfficiencyRow[]; palette: ThemedColor[] }) {
  // Which metrics are drawn on the chart below. Seeded with the two that define
  // a team in one line — how much you score and how much you give up — because
  // eight lines at once is a scribble, not a chart.
  const [selected, setSelected] = useState<string[]>(() =>
    efficiency.filter((r) => r.key === 'scoring' || r.key === 'pointsAllowed').map((r) => r.key),
  );
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  if (efficiency.length === 0) return null;

  const seasonYears = [...new Set(efficiency.flatMap((r) => r.seasons.map((s) => s.seasonYear)))].sort(
    (a, b) => a - b,
  );
  const plottable = seasonYears.length >= 2;

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  /*
    The chart plots national RANK, not the raw values, and that is the only way
    this works: scoring is ~34, total offense ~555, third down ~37%, turnover
    margin ~1.4. On one axis the yardage line would flatten everything else into
    the baseline. Rank puts all eight on the same 1-to-N scale, inverted so up
    is better — and rank is what the reader is actually comparing anyway.
  */
  const series: ChartSeries[] = efficiency
    .filter((row) => selected.includes(row.key))
    .map((row, i) => ({
      key: row.key,
      label: row.label,
      color: palette[i % palette.length],
      points: seasonYears.map((year) => ({
        x: year,
        y: row.seasons.find((s) => s.seasonYear === year)?.nationalRank ?? null,
      })),
    }));
  const worstRank = Math.max(
    25,
    ...series.flatMap((s) => s.points.map((p) => p.y ?? 0)),
  );

  return (
    <div>
      <div className="space-y-1">
        {efficiency.map((row) => {
          const latest = row.seasons[row.seasons.length - 1];
          const first = row.seasons[0];
          const rankMove =
            row.seasons.length > 1 && latest.nationalRank !== null && first.nationalRank !== null
              ? first.nationalRank - latest.nationalRank // positive = climbed
              : null;
          return (
            <div key={row.key} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[11px] text-slate-600 dark:text-slate-300">{row.label}</span>
              <Spark values={row.seasons.map((s) => s.value)} lowerIsBetter={row.lowerIsBetter} />
              <span className="tnum w-16 shrink-0 text-right text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                {fmtValue(latest.value, row.format)}
              </span>
              <span
                className={`tnum w-11 shrink-0 text-right text-[10px] ${
                  isElite(latest) ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {latest.nationalRank === null ? '—' : `#${latest.nationalRank}`}
              </span>
              <span
                className={`tnum w-14 shrink-0 text-right text-[10px] ${
                  rankMove === null || rankMove === 0
                    ? 'text-slate-300 dark:text-slate-600'
                    : rankMove > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
                title={
                  rankMove === null
                    ? undefined
                    : `${first.seasonYear} #${first.nationalRank} → ${latest.seasonYear} #${latest.nationalRank}`
                }
              >
                {rankMove === null || rankMove === 0 ? '—' : `${rankMove > 0 ? '▲' : '▼'}${Math.abs(rankMove)}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* The chart below the table, filling what used to be dead space under a
          paragraph of explanation — the explanation now lives in the panel's
          own info hint, where the rest of the app keeps its narration. */}
      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {efficiency.map((row, i) => {
            const on = selected.includes(row.key);
            // The swatch has to use the colour this metric will ACTUALLY get,
            // which depends on its position among the selected ones — not its
            // position in the full list, or the chip would promise a colour the
            // line doesn't use.
            const drawIndex = efficiency.filter((r) => selected.includes(r.key)).findIndex((r) => r.key === row.key);
            const swatch = palette[(drawIndex < 0 ? i : drawIndex) % palette.length];
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => toggle(row.key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] transition ${
                  on
                    ? 'border-slate-300 bg-slate-100 font-semibold text-slate-900 dark:border-white/20 dark:bg-white/10 dark:text-white'
                    : 'border-slate-200/80 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={
                    on
                      ? { background: isDark ? swatch.dark : swatch.light }
                      : { boxShadow: 'inset 0 0 0 1px currentColor' }
                  }
                />
                {row.label}
              </button>
            );
          })}
        </div>

        {series.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-slate-400 dark:text-slate-500">
            Pick a metric above to chart it.
          </p>
        ) : !plottable ? (
          <p className="py-8 text-center text-[11px] text-slate-400 dark:text-slate-500">
            One season on record — the chart draws once a second season is synced.
          </p>
        ) : (
          <TrendLineChart
            series={series}
            xTicks={seasonYears}
            formatX={(x) => String(x)}
            formatY={(y) => `#${Math.round(y)}`}
            yInverted
            yMinHint={1}
            yMaxHint={worstRank}
            showValues={false}
            height={200}
          />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── Panel + shell ────────────────────────── */

function Panel({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`corner-cut-sm border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.02] ${wide ? 'xl:col-span-2' : ''}`}
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</h3>
        {hint && <InfoHint label={title}>{hint}</InfoHint>}
      </div>
      {children}
    </section>
  );
}

export function ProgramArc({ arc, palette }: { arc: ProgramArcData; palette: ThemedColor[] }) {
  const partial = arc.seasons.filter((s) => !s.complete);

  return (
    <>
      <Panel
        title="Program prestige"
        hint="The game's own 0-10 prestige rating for your program, read from the save every season, with where that placed among every real program in the country. Bars are drawn against the full scale, so a one-point climb looks like a one-point climb."
      >
        <PrestigeArc prestige={arc.prestige} max={arc.prestigeMax} />
      </Panel>

      <Panel
        title="How the roster was built"
        hint="The game's own position-group grades — the same numbers behind the in-game Team Ratings screen — for every season on record. Shaded by national percentile rather than raw grade, because grades cluster in the 60s and 70s across the whole country."
      >
        <UnitHeatMap units={arc.units} />
      </Panel>

      <Panel
        title="Program efficiency"
        hint="Season-by-season efficiency, aggregated from every played game in the league-wide schedule — the same definitions the Season view uses, so 'Third down' means exactly the same thing in both. Each row: the sparkline shape across every season (drawn so up is always the better direction), then this season's value, its national rank, and how far that rank has moved since your first season. Top-25 ranks are bolded. The chart below plots national RANK rather than the raw values, because points, yards and percentages share no scale — pick any metrics to compare their trajectories. Red-zone rate and time of possession are deliberately absent: the save only stores those for your own team, so they could never carry a national rank."
      >
        <EfficiencyTrends efficiency={arc.efficiency} palette={palette} />
      </Panel>

      {partial.length > 0 && (
        <p className="text-[11px] leading-5 text-slate-400 dark:text-slate-500 xl:col-span-2">
          {partial.map((s) => s.seasonYear).join(', ')}{' '}
          {partial.length === 1 ? 'is' : 'are'} still in progress — those rates are computed from the{' '}
          {partial.map((s) => s.gamesPlayed).join('/')} games played so far, not a full season.
        </p>
      )}
    </>
  );
}
