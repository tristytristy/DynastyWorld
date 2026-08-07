import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useCoachHubReady, useCoachQuery } from './coachData';
import type { CoachStatistics as CoachStatisticsData, CoachStatTotals } from '../../../shared/types';

/**
 * STATISTICS — the coach's own career line, the way a player looks up their
 * lifetime numbers.
 *
 * Everything here is what HIS players produced while he coached them, added up
 * across every season. See database/getCoachStatistics.ts for why that is the
 * sum of season lines rather than career lines — a transfer's freshman year
 * somewhere else was never his.
 *
 * Deliberately production, not performance. Career already owns the record,
 * rankings and finishes; this is the counting stats those results were built
 * from, and the two would read as duplicates if this repeated W-L.
 */

const nf = new Intl.NumberFormat();

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="tnum mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      {sub && <p className="tnum mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  );
}

/** Completion percentage and yards per carry are derived, never stored — a rate is only honest when both halves came from the same seasons. */
function rate(made: number, attempts: number): string {
  return attempts > 0 ? `${((made / attempts) * 100).toFixed(1)}%` : '—';
}

function perCarry(yards: number, carries: number): string {
  return carries > 0 ? `${(yards / carries).toFixed(1)} per carry` : '—';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </SurfaceCard>
  );
}

function seasonRow(totals: CoachStatTotals): { label: string; value: string }[] {
  return [
    { label: 'Pass', value: `${nf.format(totals.passYards)} · ${totals.passTDs} TD` },
    { label: 'Rush', value: `${nf.format(totals.rushYards)} · ${totals.rushTDs} TD` },
    { label: 'Def', value: `${nf.format(totals.tackles)} tkl · ${totals.sacks} sk · ${totals.interceptions} int` },
  ];
}

export function CoachStatistics() {
  const { dynastyId } = useCoachHubReady();
  const stats = useCoachQuery<CoachStatisticsData | null>(
    dynastyId ? `coachStats:${dynastyId}` : null,
    // `undefined` is the loading state for useCoachQuery, so a genuine
    // "nothing to show" has to arrive as null rather than undefined.
    async () => (await window.api.db.getCoachStatistics(dynastyId)) ?? null,
  );

  if (stats === undefined) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Adding up your career…</p>;
  }

  if (!stats) {
    return (
      <div className="py-16 text-center">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Statistics</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
          No synced season has player statistics yet. Sync a season and every yard, touchdown
          and tackle your players produce starts adding up here.
        </p>
      </div>
    );
  }

  const c = stats.career;
  const span =
    stats.firstSeason === stats.lastSeason
      ? `${stats.firstSeason}`
      : `${stats.firstSeason}–${stats.lastSeason}`;
  /*
    Said out loud whenever the two disagree. A coach who never synced two of his
    five seasons is looking at a total built from three, and a number that
    quietly under-reports is worse than one that explains itself.
  */
  const missing = stats.seasonsCoached - stats.seasonsCounted;

  return (
    <div className="space-y-6">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Statistics</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">
          Everything your players have done
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {span} · {stats.seasonsCounted} season{stats.seasonsCounted === 1 ? '' : 's'} ·{' '}
          {nf.format(stats.playersCoached)} players coached
          {missing > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {' '}
              · {missing} season{missing === 1 ? '' : 's'} not counted (never synced)
            </span>
          )}
        </p>
      </div>

      <Section title="Passing">
        <StatTile label="Yards" value={nf.format(c.passYards)} />
        <StatTile label="Touchdowns" value={nf.format(c.passTDs)} sub={`${c.passInts} interceptions`} />
        <StatTile
          label="Completions"
          value={nf.format(c.passCompletions)}
          sub={`${rate(c.passCompletions, c.passAttempts)} of ${nf.format(c.passAttempts)}`}
        />
        <StatTile label="Attempts" value={nf.format(c.passAttempts)} />
      </Section>

      <Section title="Rushing">
        <StatTile label="Yards" value={nf.format(c.rushYards)} sub={perCarry(c.rushYards, c.rushAttempts)} />
        <StatTile label="Touchdowns" value={nf.format(c.rushTDs)} />
        <StatTile label="Attempts" value={nf.format(c.rushAttempts)} />
      </Section>

      {/*
        NO RECEIVING SECTION, deliberately. Every completion is a reception, so
        receiving yards, receiving TDs and receptions are the SAME numbers as
        passing yards, passing TDs and completions — verified on a real dynasty,
        where both read 10,090 / 95 / 921. Four tiles restating the four above
        them look like data and are noise. What the space is worth spending on
        is the combined view neither half gives on its own.
      */}
      <Section title="Combined offense">
        <StatTile
          label="Total yards"
          value={nf.format(c.passYards + c.rushYards)}
          sub="passing + rushing"
        />
        <StatTile
          label="Total touchdowns"
          value={nf.format(c.passTDs + c.rushTDs)}
          sub="passing + rushing"
        />
        <StatTile
          label="Plays from scrimmage"
          value={nf.format(c.passAttempts + c.rushAttempts)}
          sub={
            c.passAttempts + c.rushAttempts > 0
              ? `${((c.passYards + c.rushYards) / (c.passAttempts + c.rushAttempts)).toFixed(1)} yards per play`
              : undefined
          }
        />
        <StatTile label="Receptions" value={nf.format(c.receptions)} sub="every completion caught" />
      </Section>

      <Section title="Defense">
        <StatTile label="Tackles" value={nf.format(c.tackles)} />
        <StatTile label="Sacks" value={nf.format(c.sacks)} />
        <StatTile label="Interceptions" value={nf.format(c.interceptions)} sub={`${c.passDeflections} deflections`} />
        <StatTile label="Forced fumbles" value={nf.format(c.forcedFumbles)} />
      </Section>

      {stats.leaders.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Best single season under you</p>
          <div className="mt-4 space-y-2">
            {stats.leaders.map((l) => (
              <div
                key={l.category}
                className="flex items-center justify-between gap-4 border-t border-slate-200/80 pt-2 text-sm first:border-t-0 first:pt-0 dark:border-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950 dark:text-white">
                    {l.playerName}
                    {l.position && (
                      <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{l.position}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {l.category} · {l.seasonYear}
                    {l.teamName ? ` · ${l.teamName}` : ''}
                  </p>
                </div>
                <p className="tnum shrink-0 text-lg font-semibold text-slate-950 dark:text-white">
                  {nf.format(l.value)}
                  {l.unit && <span className="ml-1 text-xs font-normal text-slate-400">{l.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Season by season</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left type-eyebrow">Season</th>
                <th className="px-3 py-2 text-left type-eyebrow">Team</th>
                {seasonRow(c).map((cell) => (
                  <th key={cell.label} className="px-3 py-2 text-left type-eyebrow">
                    {cell.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.seasons.map((s) => (
                <tr key={s.seasonYear} className="border-t border-slate-200/80 dark:border-white/5">
                  <td className="px-3 py-3 font-semibold text-slate-950 dark:text-white">{s.seasonYear}</td>
                  <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{s.teamName ?? '—'}</td>
                  {seasonRow(s.totals).map((cell) => (
                    <td key={cell.label} className="tnum px-3 py-3 text-slate-600 dark:text-slate-300">
                      {cell.value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
}
