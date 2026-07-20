import { useMemo, useState } from 'react';
import type { RecruitBoardEntry } from '../../../shared/types';
import { useTheme } from '../../theme/ThemeProvider';

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

/** Tile-grid layout [row, col] — a stylized US map so tiny states stay visible and it needs no embedded geo paths (fully offline). West→east, north→south. */
const STATE_GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 10],
  VT: [1, 9], NH: [1, 10],
  WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], WI: [2, 5], MI: [2, 6], NY: [2, 8], MA: [2, 9],
  OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IL: [3, 5], IN: [3, 6], OH: [3, 7], PA: [3, 8], NJ: [3, 9], CT: [3, 10],
  CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9], RI: [4, 10],
  AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7], DC: [5, 8],
  OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
  HI: [7, 0], TX: [7, 3], FL: [7, 8],
};

// Sequential blue ramp (magnitude, light→dark). Monotonic lightness per the
// dataviz sequential rule; theme-aware — light mode darkens with count, dark
// mode brightens with count against the darker surface.
const RAMP_LIGHT = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'];
const RAMP_DARK = ['#1e3a63', '#2560c4', '#3b82f6', '#5b9bf5', '#93c5fd'];

const CELL = 30;
const GAP = 4;
const STEP = CELL + GAP;
const COLS = 11;
const ROWS = 8;

function bucket(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  return Math.min(4, Math.floor(((count - 1) / max) * 5));
}

function USTileMap({ counts }: { counts: Map<string, number> }) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const ramp = isDark ? RAMP_DARK : RAMP_LIGHT;
  const emptyFill = isDark ? '#172234' : '#eef2f7';
  const emptyLabel = isDark ? '#3f4d63' : '#a9b4c4';
  const [hover, setHover] = useState<string | null>(null);

  const max = Math.max(0, ...counts.values());
  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const [name, code] of Object.entries(STATE_TO_CODE)) m.set(code, name);
    return m;
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Where the class comes from</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {hover ? (
            <>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{codeToName.get(hover) ?? hover}</span>{' '}
              — {counts.get(hover) ?? 0} recruit{(counts.get(hover) ?? 0) === 1 ? '' : 's'}
            </>
          ) : (
            'Hover a state'
          )}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${COLS * STEP - GAP} ${ROWS * STEP - GAP}`}
        style={{ width: '100%', height: 'auto', maxWidth: 460, marginTop: 12 }}
        role="img"
        aria-label="Recruits by home state"
      >
        {Object.entries(STATE_GRID).map(([code, [r, c]]) => {
          const n = counts.get(code) ?? 0;
          const b = bucket(n, max);
          const fill = b < 0 ? emptyFill : ramp[b];
          // Label stays readable across the ramp: white on the two darkest steps, dark ink otherwise.
          const labelFill =
            b < 0 ? emptyLabel : isDark ? (b <= 1 ? '#93a4bd' : '#0b1220') : b >= 3 ? '#ffffff' : '#1e293b';
          return (
            <g
              key={code}
              onMouseEnter={() => setHover(code)}
              onMouseLeave={() => setHover(null)}
              opacity={hover === null || hover === code ? 1 : 0.72}
            >
              <rect x={c * STEP} y={r * STEP} width={CELL} height={CELL} rx={3} fill={fill} />
              <text
                x={c * STEP + CELL / 2}
                y={r * STEP + CELL / 2 + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={labelFill}
                style={{ pointerEvents: 'none' }}
              >
                {code}
              </text>
            </g>
          );
        })}
      </svg>
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
      <USTileMap counts={stateCounts} />
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
