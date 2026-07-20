import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecruitBoardEntry } from '../../../shared/types';
import { useTheme } from '../../theme/ThemeProvider';
import { US_MAP_VIEWBOX, US_STATE_SHAPES } from './usStatesGeo';

/** Full state name → 2-letter code. The save stores home state as a full name ("Texas") — confirmed on a real save. */
const STATE_TO_CODE: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID',
  Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH',
  Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA',
  Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
};

// Sequential blue ramp (magnitude, light→dark). Monotonic lightness per the
// dataviz sequential rule; theme-aware — light mode darkens with count, dark
// mode brightens with count against the darker surface.
const RAMP_LIGHT = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'];
const RAMP_DARK = ['#1e3a63', '#2560c4', '#3b82f6', '#5b9bf5', '#93c5fd'];

function bucket(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  return Math.min(4, Math.floor(((count - 1) / max) * 5));
}

const [VB_X, VB_Y, VB_W, VB_H] = US_MAP_VIEWBOX.split(' ').map(Number);
const MIN_SCALE = 1;
const MAX_SCALE = 9;

/** Clamp scale to range and keep the panned map from leaving the frame. */
function clampZoom(scale: number, x: number, y: number) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  if (s === 1) return { scale: 1, x: 0, y: 0 };
  const shift = s - 1;
  return {
    scale: s,
    x: Math.max(-VB_W * shift, Math.min(VB_W * shift, x)),
    y: Math.max(-VB_H * shift, Math.min(VB_H * shift, y)),
  };
}

/** Real geographic US choropleth (bundled state shapes — fully offline) with wheel/button zoom and drag-to-pan. States shade by recruit count; hover shows the count. */
function USGeoMap({ counts }: { counts: Map<string, number> }) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const ramp = isDark ? RAMP_DARK : RAMP_LIGHT;
  const emptyFill = isDark ? '#1a2536' : '#eef2f7';
  const stroke = isDark ? '#0b1220' : '#ffffff';

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const max = Math.max(0, ...counts.values());

  function zoomToward(cx: number, cy: number, factor: number) {
    setView((v) => {
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      if (ns === 1) return { scale: 1, x: 0, y: 0 };
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return clampZoom(ns, cx - wx * ns, cy - wy * ns);
    });
  }

  // Wheel zoom toward the cursor. Non-passive listener so preventDefault works;
  // uses the functional setState form so it needs no external deps.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * VB_W + VB_X;
      const cy = ((e.clientY - rect.top) / rect.height) * VB_H + VB_Y;
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setView((v) => {
        const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        if (ns === 1) return { scale: 1, x: 0, y: 0 };
        const wx = (cx - v.x) / v.scale;
        const wy = (cy - v.y) / v.scale;
        return clampZoom(ns, cx - wx * ns, cy - wy * ns);
      });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.sx) / rect.width) * VB_W;
    const dy = ((e.clientY - drag.current.sy) / rect.height) * VB_H;
    setView((v) => clampZoom(v.scale, drag.current!.vx + dx, drag.current!.vy + dy));
  }
  function endDrag() {
    drag.current = null;
  }

  const btnClass =
    'flex h-7 w-7 items-center justify-center border border-slate-300/80 bg-white/90 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:bg-slate-800';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Where the class comes from</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {hover ? (
            <>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{hover}</span> —{' '}
              {counts.get((US_STATE_SHAPES.find((s) => s.name === hover)?.code) ?? '') ?? 0} recruit
              {(counts.get(US_STATE_SHAPES.find((s) => s.name === hover)?.code ?? '') ?? 0) === 1 ? '' : 's'}
            </>
          ) : (
            'Scroll or drag to zoom · hover a state'
          )}
        </p>
      </div>

      <div className="relative mt-2 border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-white/5">
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button type="button" aria-label="Zoom in" className={btnClass} onClick={() => zoomToward(VB_X + VB_W / 2, VB_Y + VB_H / 2, 1.4)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" className={btnClass} onClick={() => zoomToward(VB_X + VB_W / 2, VB_Y + VB_H / 2, 1 / 1.4)}>
            −
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className={btnClass}
            disabled={view.scale === 1}
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          >
            ⟳
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={US_MAP_VIEWBOX}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none' }}
          role="img"
          aria-label="Recruits by home state"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={() => {
            endDrag();
            setHover(null);
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {US_STATE_SHAPES.map((s) => {
              const n = counts.get(s.code) ?? 0;
              const b = bucket(n, max);
              return (
                <path
                  key={s.code}
                  d={s.path}
                  fill={b < 0 ? emptyFill : ramp[b]}
                  stroke={stroke}
                  strokeWidth={0.75}
                  vectorEffect="non-scaling-stroke"
                  opacity={hover === null || hover === s.name ? 1 : 0.75}
                  onMouseEnter={() => setHover(s.name)}
                  style={{ transition: 'opacity 120ms' }}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Ranked horizontal bars — single hue (magnitude). Recessive track, rounded data-end, value labels. */
function RankedBars({ rows, accentDark, accentLight }: { rows: { label: string; value: number }[]; accentDark: string; accentLight: string }) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const accent = isDark ? accentDark : accentLight;
  const track = isDark ? '#1b2434' : '#eef2f7';
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">{row.label}</span>
          <div className="relative h-4 flex-1" style={{ background: track }}>
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${(row.value / max) * 100}%`, background: accent, borderRadius: '0 3px 3px 0' }}
            />
          </div>
          <span className="tnum w-6 shrink-0 text-right text-xs font-semibold text-slate-900 dark:text-white">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Recruiting Pipeline — where the incoming class comes from and what it's made
 * of. A tile-grid US choropleth (home state) plus ranked bars for states, star
 * rating, and position, all from the recruit board's real hometown/state/star
 * data. Fully offline (no map tiles, no web fonts). Built via the dataviz
 * skill: sequential single-hue ramp for the map, single-hue magnitude bars.
 */
export function RecruitingPipeline({ board }: { board: RecruitBoardEntry[] }) {
  const { stateCounts, topStates, starRows, positionRows } = useMemo(() => {
    const sc = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    const stars = new Map<number, number>();
    const positions = new Map<string, number>();
    for (const r of board) {
      const code = STATE_TO_CODE[(r.homeState || '').trim()];
      if (code) {
        sc.set(code, (sc.get(code) ?? 0) + 1);
        const nm = r.homeState.trim();
        nameCounts.set(nm, (nameCounts.get(nm) ?? 0) + 1);
      }
      stars.set(r.stars, (stars.get(r.stars) ?? 0) + 1);
      const pos = (r.position || '').trim() || 'ATH';
      positions.set(pos, (positions.get(pos) ?? 0) + 1);
    }

    const top = [...nameCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    // Full 5→1 scale so the distribution shape reads even with gaps; unrated only if present.
    const starList: { label: string; value: number }[] = [];
    for (let s = 5; s >= 1; s--) starList.push({ label: `${s}★`, value: stars.get(s) ?? 0 });
    if ((stars.get(0) ?? 0) > 0) starList.push({ label: 'Unrated', value: stars.get(0) ?? 0 });

    const posList = [...positions.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    return { stateCounts: sc, topStates: top, starRows: starList, positionRows: posList };
  }, [board]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <USGeoMap counts={stateCounts} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Panel title="Top states">
          {topStates.length > 0 ? (
            <RankedBars rows={topStates} accentLight="#2159d0" accentDark="#5b9bf5" />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">No state data.</p>
          )}
        </Panel>
        <Panel title="Star rating">
          <RankedBars rows={starRows} accentLight="#c07908" accentDark="#e0a13c" />
        </Panel>
        <Panel title="By position">
          <RankedBars rows={positionRows} accentLight="#2159d0" accentDark="#5b9bf5" />
        </Panel>
      </div>
    </div>
  );
}
