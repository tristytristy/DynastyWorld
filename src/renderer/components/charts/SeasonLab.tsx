import { useState } from 'react';
import { InfoHint } from '../ui/InfoHint';
import type { SeasonAnalytics, SeasonGamePoint, SeasonIdentityMetric } from '../../../shared/types';

/**
 * Season Lab — the visual half of one season's analysis.
 *
 * Conventions kept from the rest of the app: inline SVG, no chart dependency,
 * team colour as an accent rather than the only encoding, and nothing that
 * relies on colour alone to carry meaning (wins/losses also differ by direction
 * and label; quarter cells also differ by their printed number).
 */

const fmtMetric = (m: SeasonIdentityMetric) => {
  if (m.format === 'percent') return `${m.value.toFixed(1)}%`;
  if (m.format === 'plusMinus') return `${m.value >= 0 ? '+' : ''}${m.value.toFixed(2)}`;
  return m.value.toFixed(1);
};

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/* ────────────────────────── Season Journey ────────────────────────── */

/**
 * The dominant exhibit: one bar per played game, wins above the axis and losses
 * below, height = scoring margin. Reading the season's shape is the point, so
 * this gets the most space and the most ink.
 */
function SeasonJourney({
  journey,
  onSelectGame,
}: {
  journey: SeasonGamePoint[];
  onSelectGame?: (gameId: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (journey.length === 0) return null;

  // Laid out in CSS rather than a fixed-width SVG so it fills whatever column
  // it's given. An SVG with a pixel width renders at that width regardless of
  // its container, which left this chart huddled in the corner of its panel.
  const peak = Math.max(...journey.map((g) => Math.abs(g.margin)), 14);
  const HALF = 92; // px available above and below the zero line
  const active = journey.find((g) => g.gameId === hover) ?? null;

  return (
    <div>
      <div className="relative" style={{ height: HALF * 2 }}>
        {/* Zero line, and quiet ±14 guides so bar heights have a scale. */}
        <div className="absolute inset-x-0 border-t border-slate-300 dark:border-white/25" style={{ top: HALF }} />
        {[14, -14].map((v) => (
          <div
            key={v}
            className="absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-white/10"
            style={{ top: HALF - (v / peak) * (HALF - 20) }}
          />
        ))}

        <div className="absolute inset-0 flex items-stretch">
          {journey.map((g) => {
            const h = Math.max((Math.abs(g.margin) / peak) * (HALF - 20), 3);
            const win = g.result === 'W';
            const isActive = hover === g.gameId;
            return (
              <button
                key={g.gameId}
                type="button"
                onMouseEnter={() => setHover(g.gameId)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(g.gameId)}
                onBlur={() => setHover(null)}
                onClick={() => onSelectGame?.(g.gameId)}
                title={`Week ${g.week} · ${g.opponent} · ${g.result} ${g.teamScore}–${g.opponentScore}`}
                className="group relative flex-1 outline-none"
              >
                {/* The bar itself, capped so a 4-game season doesn't render slabs. */}
                <span
                  className={`absolute left-1/2 w-[62%] max-w-[38px] -translate-x-1/2 transition-opacity ${
                    win ? 'bg-[var(--team-primary)]' : 'bg-slate-400 dark:bg-slate-600'
                  } ${isActive ? 'opacity-100' : 'opacity-85'}`}
                  style={g.margin >= 0 ? { top: HALF - h, height: h } : { top: HALF, height: h }}
                />
                {/* Postseason/conference marked by a cap, not by colour alone. */}
                {(g.gameType === 'bowl' || g.gameType === 'conference') && (
                  <span
                    className={`absolute left-1/2 w-[62%] max-w-[38px] -translate-x-1/2 ${
                      g.gameType === 'bowl' ? 'h-1 bg-amber-400' : 'h-0.5 bg-slate-500 dark:bg-slate-300'
                    }`}
                    style={
                      g.margin >= 0
                        ? { top: HALF - h - (g.gameType === 'bowl' ? 5 : 3) }
                        : { top: HALF + h + 1 }
                    }
                  />
                )}
                {/* Margin printed on hover; the label sits clear of the bar. */}
                {isActive && (
                  <span
                    className="tnum absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-900 dark:text-white"
                    style={g.margin >= 0 ? { top: HALF - h - 20 } : { top: HALF + h + 6 }}
                  >
                    {signed(g.margin)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        Opponent names live in their own row rather than beside each bar. Floated
        next to the marks they collided with each other AND with the bars as soon
        as a season had a dozen games and names like "Washington St." — a single
        aligned row truncates predictably instead.
      */}
      <div className="flex items-start">
        {journey.map((g) => (
          <span
            key={g.gameId}
            title={`${g.opponent} · ${g.result} ${g.teamScore}–${g.opponentScore}`}
            className={`min-w-0 flex-1 truncate px-0.5 text-center text-[9px] ${
              hover === g.gameId ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {g.opponent}
          </span>
        ))}
      </div>

      <p className="tnum mt-1 h-4 text-xs text-slate-600 dark:text-slate-300">
        {active
          ? `Week ${active.week} · ${active.siteType === 'home' ? 'vs' : active.siteType === 'away' ? 'at' : 'vs (N)'} ${active.opponent} · ${active.result} ${active.teamScore}–${active.opponentScore}${active.wentToOvertime ? ' (OT)' : ''}`
          : ''}
      </p>
    </div>
  );
}

/* ────────────────────────── Quarter Pulse ────────────────────────── */

function QuarterPulse({ journey, hasOvertime }: { journey: SeasonGamePoint[]; hasOvertime: boolean }) {
  const rows = journey.filter((g) => g.quarterDifferential?.length);
  if (rows.length === 0) return null;
  const peak = Math.max(...rows.flatMap((g) => g.quarterDifferential!.map(Math.abs)), 7);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-left">
          <thead>
            <tr>
              <th className="w-28 pb-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">Game</th>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <th key={q} className="pb-1 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {q}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.gameId}>
                <td className="truncate pr-2 text-[11px] text-slate-600 dark:text-slate-300">
                  {g.opponent}
                  {g.wentToOvertime && <span className="ml-1 text-[9px] font-bold text-amber-500">OT</span>}
                </td>
                {g.quarterDifferential!.map((d, i) => {
                  const strength = Math.min(Math.abs(d) / peak, 1);
                  // Colour carries emphasis; the printed number carries the meaning.
                  const bg =
                    d === 0
                      ? 'transparent'
                      : d > 0
                        ? `color-mix(in srgb, var(--team-primary) ${Math.round(18 + strength * 62)}%, transparent)`
                        : `color-mix(in srgb, currentColor ${Math.round(10 + strength * 26)}%, transparent)`;
                  return (
                    <td
                      key={i}
                      title={`${g.opponent} · Q${i + 1} ${signed(d)}`}
                      className="tnum h-7 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                      style={{ backgroundColor: bg }}
                    >
                      {d === 0 ? '·' : signed(d)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Season
              </td>
              {[0, 1, 2, 3].map((i) => {
                const total = rows.reduce((a, g) => a + g.quarterDifferential![i], 0);
                return (
                  <td
                    key={i}
                    className="tnum border-t border-slate-200 pt-1 text-center text-xs font-bold text-slate-900 dark:border-white/10 dark:text-white"
                  >
                    {signed(total)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {hasOvertime && (
        <p className="mt-2 text-[11px] leading-5 text-slate-400 dark:text-slate-500">
          Quarter scores cover regulation only — the save doesn&apos;t record overtime periods separately, so an{' '}
          <span className="font-semibold text-amber-500">OT</span> row won&apos;t add up to that game&apos;s final
          margin.
        </p>
      )}
    </div>
  );
}

/* ────────────────────────── Team Identity ────────────────────────── */

function TeamIdentity({ identity }: { identity: SeasonIdentityMetric[] }) {
  if (identity.length === 0) return null;
  const compared = identity.find((m) => m.comparedTeams)?.comparedTeams ?? null;

  return (
    <div className="space-y-1.5">
      {identity.map((m) => {
        const pct = m.nationalPercentile;
        return (
          <div key={m.key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-[11px] text-slate-600 dark:text-slate-300">{m.label}</span>
            <span className="tnum w-14 shrink-0 text-right text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {fmtMetric(m)}
            </span>
            <span className="relative h-4 flex-1 border border-slate-200/70 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
              {/* Median marker, so a dot's position is readable without a legend. */}
              <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300 dark:bg-white/20" />
              {pct !== null && (
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--team-primary)]"
                  style={{ left: `${Math.max(3, Math.min(97, pct))}%` }}
                />
              )}
            </span>
            {/* Percentile and rank are different numbers and were being read as
                one — they get their own columns, and a top-25 rank is called out
                by weight and brightness rather than left for the eye to find. */}
            <span className="tnum w-9 shrink-0 text-right text-[10px] text-slate-400 dark:text-slate-500">
              {pct === null ? '—' : `${pct}th`}
            </span>
            <span
              className={`tnum w-11 shrink-0 text-right text-[10px] ${
                m.nationalRank !== null && m.nationalRank <= 25
                  ? 'font-bold text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {m.nationalRank === null ? '—' : `#${m.nationalRank}`}
            </span>
          </div>
        );
      })}
      {compared !== null && (
        <p className="pt-1 text-[10px] leading-4 text-slate-400 dark:text-slate-500">
          Dot position is the percentile — left is worse, right is better, the line is the median. Ranks in the top 25
          are <span className="font-bold text-slate-900 dark:text-white">highlighted</span>. Measured against {compared}{' '}
          teams with games played this season.
        </p>
      )}
    </div>
  );
}

/* ────────────────────────── Panel ────────────────────────── */

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
      className={`corner-cut-sm border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.02] ${wide ? 'lg:col-span-2' : ''}`}
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</h3>
        {hint && <InfoHint label={title}>{hint}</InfoHint>}
      </div>
      {children}
    </section>
  );
}

export function SeasonLab({
  analytics,
  onSelectGame,
}: {
  analytics: SeasonAnalytics;
  onSelectGame?: (gameId: number) => void;
}) {
  const { summary: s, state } = analytics;

  if (state === 'history-only') {
    return (
      <div className="corner-cut-sm border border-slate-200/80 bg-white/70 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">History-only season</p>
        <p className="mt-1 leading-6">
          {analytics.seasonYear} was recovered from the save&apos;s league history — champions and honors only. Game
          results, statistics and rosters were never captured for it, and can&apos;t be recovered later.
        </p>
      </div>
    );
  }

  if (analytics.gamesPlayed === 0) {
    return (
      <div className="corner-cut-sm border border-slate-200/80 bg-white/70 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">No games played yet</p>
        <p className="mt-1 leading-6">
          {state === 'preseason'
            ? `The ${analytics.seasonYear} schedule hasn't been drawn up in your save yet. Sync once the season starts and this fills in.`
            : `${analytics.gamesScheduled} games scheduled. This fills in as you play.`}
        </p>
      </div>
    );
  }

  const tiles: { label: string; value: string; sub?: string }[] = [
    {
      label: 'Record',
      value: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ''}`,
      sub: `${analytics.gamesPlayed} of ${analytics.gamesScheduled} played`,
    },
    {
      label: 'Scoring margin',
      value: s.scoringMarginPerGame === null ? '—' : `${s.scoringMarginPerGame >= 0 ? '+' : ''}${s.scoringMarginPerGame.toFixed(1)}`,
      sub: 'per game',
    },
    {
      label: 'Points',
      value: s.pointsPerGame === null ? '—' : s.pointsPerGame.toFixed(1),
      sub: s.pointsAllowedPerGame === null ? undefined : `${s.pointsAllowedPerGame.toFixed(1)} allowed`,
    },
    {
      label: 'Turnover margin',
      value: s.turnoverMarginPerGame === null ? '—' : `${s.turnoverMarginPerGame >= 0 ? '+' : ''}${s.turnoverMarginPerGame.toFixed(2)}`,
      sub: 'per game',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="corner-cut-sm border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">{t.label}</p>
            <p className="tnum mt-1 text-2xl font-bold text-slate-900 dark:text-white">{t.value}</p>
            {t.sub && <p className="tnum text-[11px] text-slate-400 dark:text-slate-500">{t.sub}</p>}
          </div>
        ))}
      </div>

      <Panel
        title="Season journey"
        wide
        hint="Every played game, in order. Bars rise for wins and fall for losses, sized by scoring margin. A gold cap marks a postseason game, a grey cap a conference game. Click a bar to open that game."
      >
        <SeasonJourney journey={analytics.journey} onSelectGame={onSelectGame} />
      </Panel>

      {analytics.findings.length > 0 && (
        <Panel
          title="What the season says"
          hint="Plain observations derived from your game results — descriptive only, never causal, and only shown when there are enough games to mean something."
        >
          <ul className="space-y-2.5">
            {analytics.findings.map((f) => (
              <li key={f.id}>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{f.statement}</p>
                <p className="tnum mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  {f.support.map((x) => `${x.label}: ${x.value}`).join('  ·  ')} · from {f.sampleSize} games
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Quarter pulse"
          hint="Points scored minus points allowed in each quarter, game by game. The bottom row totals the season, which is where patterns like slow starts or strong finishes show up."
        >
          <QuarterPulse journey={analytics.journey} hasOvertime={analytics.hasOvertimeGames} />
        </Panel>

        <Panel
          title="Team identity"
          hint="Where this season sits against every other team in the country, computed from real league-wide game data rather than estimated. Three numbers per row: the value itself, then the percentile ('83rd' means this beats 83% of teams), then the national rank ('#22' means 22nd best). Ranks inside the top 25 are highlighted. Further right is always better, including for metrics like points allowed where a lower number is the good outcome."
        >
          <TeamIdentity identity={analytics.identity} />
        </Panel>
      </div>
    </div>
  );
}
