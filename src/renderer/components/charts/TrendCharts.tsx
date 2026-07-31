import { useMemo, useRef, useState } from 'react';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Chart series colors — a validated categorical set (dataviz skill, run
 * against scripts/validate_palette.js in both light and dark against the app
 * chart surface). Deliberately NOT the dynasty's team color: series identity
 * must stay stable and colorblind-safe regardless of which team is themed.
 * Blue / green / magenta clear CVD separation and contrast in both modes;
 * orange joins them for the two-series points chart.
 */
export const CHART_COLORS = {
  blue: { light: '#2a78d6', dark: '#3987e5' },
  green: { light: '#008300', dark: '#008300' },
  magenta: { light: '#c94f7c', dark: '#d55181' },
  orange: { light: '#eb6834', dark: '#d95926' },
} as const;

export type ChartColorKey = keyof typeof CHART_COLORS;

/**
 * Either a key from the validated categorical set above, or an explicit
 * light/dark pair. The pair exists for the Poll Trajectory chart, which is a
 * single team's own season and is therefore painted in that team's colours
 * (see lib/pollSeriesColors.ts) rather than the neutral categorical ramp.
 */
export type ChartColor = ChartColorKey | { light: string; dark: string };

export interface ChartSeries {
  key: string;
  label: string;
  color: ChartColor;
  /** Evenly dashed rather than solid — a second, non-colour channel of identity. */
  dashed?: boolean;
  /** null y = a genuine gap (unranked week, unplayed season) — never drawn or interpolated across. */
  points: { x: number; y: number | null }[];
}

function resolveColor(color: ChartColor, isDark: boolean): string {
  if (typeof color === 'string') return CHART_COLORS[color][isDark ? 'dark' : 'light'];
  return isDark ? color.dark : color.light;
}

/**
 * Splits a series into runs of consecutive real values, so a null is a genuine
 * break in the line. Filtering the nulls out and drawing one path — which is
 * what this did — silently bridged the gap instead, drawing a straight line
 * through weeks a team was unranked as if it had been ranked all along.
 */
function segmentsOf(points: { x: number; y: number | null }[]): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ x: p.x, y: p.y });
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

const VB_W = 720;
const VB_H = 260;
// The 96px right gutter existed only to park the old "For"/"Against" end-labels
// outside the plot. Values are centred on their own points now, so that space
// goes back to the data — just enough margin left for the final point's label
// and x-tick to sit centred without clipping.
const M = { top: 18, right: 26, bottom: 34, left: 44 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;

/**
 * How many points a series can have before labelling every one of them turns
 * into a wall of overlapping numbers. Past this, only the first and last are
 * labelled — the shape carries the story and the hover gives any exact value.
 * A dynasty runs long, so this ceiling will be reached eventually.
 */
const MAX_LABELLED_POINTS = 10;

/** The points that get a printed value: all of them while sparse, otherwise just the endpoints. */
function labelledPoints<T extends { x: number; y: number }>(pts: T[]): T[] {
  if (pts.length <= MAX_LABELLED_POINTS) return pts;
  return [pts[0], pts[pts.length - 1]];
}

/**
 * Theme-aware multi-series line chart (SVG). Recessive grid, 2px lines,
 * markers, printed values on the points themselves, and a crosshair+tooltip
 * hover layer. `yInverted` puts 1 at the top for poll ranks. Callers handle the
 * empty state; this assumes at least one real point.
 *
 * Identity comes from the legend (multi-series) or the card title (single
 * series) plus the coloured marker — NOT from a name printed on the plot. The
 * one on-plot label slot goes to the value, which is what the reader actually
 * came for.
 */
export function TrendLineChart({
  series,
  xTicks,
  formatX,
  formatY,
  yInverted = false,
  yMinHint,
  yMaxHint,
  yReference,
  height = 260,
  showValues = true,
}: {
  series: ChartSeries[];
  xTicks: number[];
  formatX: (x: number) => string;
  formatY?: (y: number) => string;
  yInverted?: boolean;
  /** Optional floor for the value axis (e.g. 1 for ranks). */
  yMinHint?: number;
  /** Optional ceiling for the value axis (e.g. 25 for a poll that only ranks 25 deep). */
  yMaxHint?: number;
  /** A labelled threshold drawn across the plot (e.g. the top-25 poll cutoff). Ignored when it falls outside the data range. */
  yReference?: { value: number; label: string };
  height?: number;
  /** Printed values on the points. Off where they'd crowd the plot and hover carries it instead. */
  showValues?: boolean;
}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  /*
    All four come from the app's own true-neutral ramp (tailwind.config.js),
    NOT Tailwind's stock slate. Stock slate is blue-tinted, which is exactly
    what made these charts read as a foreign brand sitting inside a black,
    team-accented app — the axis ink was a cool blue-grey and the surface
    knockout behind the labels was outright navy (#0b1220).
  */
  const ink = isDark ? '#d2d2d5' : '#4d4d52'; // slate-300 / slate-600
  const faint = isDark ? '#38383c' : '#e6e6e8'; // slate-700 / slate-200
  const surface = isDark ? '#0a0a0b' : '#ffffff'; // slate-950 / white
  const colorOf = (c: ChartColor) => resolveColor(c, isDark);

  const allX = useMemo(() => {
    const xs = new Set<number>();
    series.forEach((s) => s.points.forEach((p) => xs.add(p.x)));
    return [...xs].sort((a, b) => a - b);
  }, [series]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const ys: number[] = [];
    series.forEach((s) => s.points.forEach((p) => p.y !== null && ys.push(p.y)));
    const rawMin = ys.length ? Math.min(...ys) : 0;
    const rawMax = ys.length ? Math.max(...ys) : 1;
    const lo = yMinHint !== undefined ? Math.min(yMinHint, rawMin) : rawMin;
    const pad = Math.max(1, (rawMax - lo) * 0.12);
    return {
      xMin: allX.length ? allX[0] : 0,
      xMax: allX.length ? allX[allX.length - 1] : 1,
      yMin: lo,
      // A fixed ceiling keeps a poll chart's scale honest: without it, a season
      // spent hovering at #23-#25 would stretch to fill the panel and read like
      // a top-5 run.
      yMax: yMaxHint !== undefined ? Math.max(yMaxHint, rawMax) : rawMax + pad,
    };
  }, [series, allX, yMinHint, yMaxHint]);

  const sx = (x: number) => (xMax === xMin ? M.left + PLOT_W / 2 : M.left + ((x - xMin) / (xMax - xMin)) * PLOT_W);
  const sy = (y: number) => {
    const t = yMax === yMin ? 0.5 : (y - yMin) / (yMax - yMin);
    return yInverted ? M.top + t * PLOT_H : M.top + (1 - t) * PLOT_H;
  };

  const yGrid = useMemo(() => {
    const ticks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) ticks.push(yMin + ((yMax - yMin) * i) / steps);
    return ticks;
  }, [yMin, yMax]);

  const fmtY = formatY ?? ((y: number) => String(Math.round(y)));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || allX.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((e.clientX - rect.left) / rect.width) * VB_W;
    let nearest = allX[0];
    let best = Infinity;
    for (const x of allX) {
      const d = Math.abs(sx(x) - localX);
      if (d < best) {
        best = d;
        nearest = x;
      }
    }
    setHoverX(nearest);
  }

  const hoverValues =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((e): e is { s: ChartSeries; p: { x: number; y: number } } => !!e.p && e.p.y !== null);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', height: 'auto', aspectRatio: `${VB_W} / ${height}` }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverX(null)}
        role="img"
      >
        {yGrid.map((gy, i) => (
          <g key={i}>
            <line x1={M.left} x2={M.left + PLOT_W} y1={sy(gy)} y2={sy(gy)} stroke={faint} strokeWidth={1} />
            <text x={M.left - 8} y={sy(gy) + 3.5} textAnchor="end" fontSize={10} fill={ink} className="tnum">
              {fmtY(gy)}
            </text>
          </g>
        ))}

        {xTicks.map((tx) => (
          <text key={tx} x={sx(tx)} y={VB_H - 12} textAnchor="middle" fontSize={10} fill={ink} className="tnum">
            {formatX(tx)}
          </text>
        ))}

        {/* Threshold line — drawn under the series so it never competes with the
            data, and skipped entirely when the season never goes near it. */}
        {yReference && yReference.value > yMin && yReference.value < yMax && (
          <g>
            <line
              x1={M.left}
              x2={M.left + PLOT_W}
              y1={sy(yReference.value)}
              y2={sy(yReference.value)}
              stroke={ink}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.55}
            />
            <text
              x={M.left + PLOT_W}
              y={sy(yReference.value) - 4}
              textAnchor="end"
              fontSize={9}
              fill={ink}
              stroke={surface}
              strokeWidth={3}
              paintOrder="stroke"
              className="type-eyebrow"
            >
              {yReference.label}
            </text>
          </g>
        )}

        {hoverX !== null && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={M.top + PLOT_H} stroke={ink} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        )}

        {series.map((s) => {
          const segments = segmentsOf(s.points);
          const pts = segments.flat();
          if (pts.length === 0) return null;
          return (
            <g key={s.key}>
              {segments
                .filter((seg) => seg.length > 1)
                .map((seg, i) => (
                  <path
                    key={`seg-${i}`}
                    d={seg.map((p, j) => `${j === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke={colorOf(s.color)}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? '6 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              {pts.map((p) => (
                <circle
                  key={p.x}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={hoverX === p.x ? 4.5 : 3}
                  fill={colorOf(s.color)}
                  stroke={surface}
                  strokeWidth={1.5}
                />
              ))}
              {/* Value labels, not series names. The legend (or the card title,
                  for a single series) already carries identity, so repeating
                  "For"/"Against" on the plot spent the one label slot on
                  something the reader already knew — while the actual numbers,
                  the thing the chart exists to show, were only reachable by
                  hovering.

                  Drawn in text ink rather than the series colour: the mark
                  beside the number carries identity, text stays text. The
                  surface-coloured stroke under each label (paint-order) knocks
                  out the gridline behind it so small numbers stay legible. */}
              {showValues && labelledPoints(pts).map((p) => (
                <text
                  key={`v-${p.x}`}
                  x={sx(p.x)}
                  y={sy(p.y) - 9}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={ink}
                  stroke={surface}
                  strokeWidth={3}
                  paintOrder="stroke"
                  className="tnum"
                >
                  {fmtY(p.y)}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      {hoverX !== null && hoverValues.length > 0 && (
        <div
          className="pointer-events-none absolute top-2 border border-slate-200/80 bg-white/95 px-2.5 py-1.5 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
          style={{ left: `${(sx(hoverX) / VB_W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">{formatX(hoverX)}</p>
          {hoverValues.map(({ s, p }) => (
            <p key={s.key} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span className="inline-block h-2 w-2" style={{ background: colorOf(s.color) }} />
              {s.label}: <span className="tnum font-semibold">{fmtY(p.y)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Win-loss by season — a stacked bar per season (wins in the series color,
 * losses in muted ink) with a 2px surface gap between the two fills and the
 * record labeled above. Hover highlights the bar.
 */
export function WinLossBars({
  seasons,
  color = 'blue',
}: {
  seasons: { seasonYear: number; wins: number | null; losses: number | null }[];
  /** Wins fill. Defaults to the categorical blue; the Analytics page passes the team's own colour. */
  color?: ChartColor;
}) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const [hover, setHover] = useState<number | null>(null);

  const winColor = resolveColor(color, isDark);
  // Losses are the recessive half of the bar, so they stay neutral — but from
  // the app's own ramp, not Tailwind's blue-tinted slate, which is what made
  // this chart read as bright blue next to a maroon-themed page.
  const lossColor = isDark ? '#4d4d52' : '#d2d2d5'; // slate-600 / slate-300
  const ink = isDark ? '#d2d2d5' : '#4d4d52';
  const surface = isDark ? '#0a0a0b' : '#ffffff';

  const withData = seasons.filter((s) => s.wins !== null || s.losses !== null);
  const maxGames = Math.max(1, ...withData.map((s) => (s.wins ?? 0) + (s.losses ?? 0)));

  const VBW = 720;
  const VBH = 240;
  const mm = { top: 24, right: 12, bottom: 30, left: 30 };
  const plotW = VBW - mm.left - mm.right;
  const plotH = VBH - mm.top - mm.bottom;
  const n = Math.max(1, withData.length);
  const slot = plotW / n;
  const barW = Math.min(46, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ width: '100%', height: 'auto', aspectRatio: `${VBW} / ${VBH}` }} role="img">
      {[0, 0.5, 1].map((f, i) => {
        const gy = mm.top + (1 - f) * plotH;
        return (
          <g key={i}>
            <line x1={mm.left} x2={mm.left + plotW} y1={gy} y2={gy} stroke={isDark ? '#38383c' : '#e6e6e8'} strokeWidth={1} />
            <text x={mm.left - 6} y={gy + 3.5} textAnchor="end" fontSize={10} fill={ink} className="tnum">
              {Math.round(maxGames * f)}
            </text>
          </g>
        );
      })}

      {withData.map((s, i) => {
        const cx = mm.left + slot * i + slot / 2;
        const wins = s.wins ?? 0;
        const losses = s.losses ?? 0;
        const winsH = (wins / maxGames) * plotH;
        const lossH = (losses / maxGames) * plotH;
        const baseY = mm.top + plotH;
        const isHover = hover === i;
        return (
          <g key={s.seasonYear} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} opacity={hover === null || isHover ? 1 : 0.55}>
            <title>{`${s.seasonYear}: ${wins}-${losses}`}</title>
            {/* losses sit on the baseline, wins stack above, 2px surface gap between */}
            {losses > 0 && <rect x={cx - barW / 2} y={baseY - lossH} width={barW} height={lossH} fill={lossColor} />}
            {wins > 0 && (
              <rect x={cx - barW / 2} y={baseY - lossH - winsH - (losses > 0 ? 2 : 0)} width={barW} height={Math.max(0, winsH - 0)} rx={3} fill={winColor} stroke={surface} strokeWidth={losses > 0 ? 0 : 0} />
            )}
            <text x={cx} y={baseY - lossH - winsH - (losses > 0 ? 2 : 0) - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={isDark ? '#f4f4f5' : '#141416'} className="tnum">
              {wins}-{losses}
            </text>
            <text x={cx} y={VBH - 10} textAnchor="middle" fontSize={10} fill={ink} className="tnum">
              {s.seasonYear}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Shared legend row for the multi-series line charts. A dashed series gets a
 * dashed swatch rather than a solid block, so the legend matches what's on the
 * plot and identity never rests on colour alone.
 */
export function ChartLegend({ items }: { items: { label: string; color: ChartColor; dashed?: boolean }[] }) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => {
        const color = resolveColor(it.color, isDark);
        return (
          <span key={it.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            {it.dashed ? (
              <svg width="14" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="14" y2="5" stroke={color} strokeWidth={2.5} strokeDasharray="4 3" />
              </svg>
            ) : (
              <span className="inline-block h-2.5 w-2.5" style={{ background: color }} />
            )}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}
