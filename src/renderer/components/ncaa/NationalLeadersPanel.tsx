import { useMemo, useState } from 'react';
import { DashboardPanel, PanelEmpty, PanelLink, PanelSkeleton, RowButton } from './DashboardPanel';
import { PlayerPortrait } from '../common/PlayerPortrait';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { DEFENSE_COLUMNS, PASSING_COLUMNS, RECEIVING_COLUMNS, RUSHING_COLUMNS } from '../../lib/statColumns';
import type { ColumnDef } from '../common/StatisticsCategorySection';
import type {
  DefensiveStatLine,
  NationalLeaderEntry,
  NationalStatLeaders,
  OffensiveStatLine,
} from '../../../shared/types';

/**
 * National statistical leaders, offense and defense.
 *
 * The numbers and their formatting come from the SAME column definitions the
 * National Statistics page uses (`statColumns.ts`) — this panel looks up the
 * relevant column by key and reuses its `raw`/`format`, so a stat can never
 * mean one thing here and another there. Sacks print with a decimal because
 * that column says they do; tackles and interceptions print whole.
 *
 * `getNationalStatLeaders` already returns each category ordered, so the
 * offensive tabs take its order as given. Only the defensive tabs sort, and
 * only because one `defense` list has to serve three different questions.
 */

type OffenseTab = 'passing' | 'rushing' | 'receiving';
type DefenseTab = 'tackles' | 'sacks' | 'interceptions';

interface Metric<TLine> {
  label: string;
  column: ColumnDef<TLine>;
  line: (entry: NationalLeaderEntry) => TLine | null;
  /** Defensive lists are re-sorted per tab; offensive ones arrive in the right order. */
  sort?: boolean;
}

function column<TLine>(columns: ColumnDef<TLine>[], key: string): ColumnDef<TLine> {
  const found = columns.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`NationalLeadersPanel: no "${key}" column`);
  return found;
}

const OFFENSE: Record<OffenseTab, Metric<OffensiveStatLine>> = {
  passing: { label: 'Pass yds', column: column(PASSING_COLUMNS, 'passYards'), line: (entry) => entry.offense },
  rushing: { label: 'Rush yds', column: column(RUSHING_COLUMNS, 'rushYards'), line: (entry) => entry.offense },
  receiving: { label: 'Rec yds', column: column(RECEIVING_COLUMNS, 'receivingYards'), line: (entry) => entry.offense },
};

const DEFENSE: Record<DefenseTab, Metric<DefensiveStatLine>> = {
  tackles: { label: 'Tackles', column: column(DEFENSE_COLUMNS, 'tackles'), line: (entry) => entry.defense, sort: true },
  sacks: { label: 'Sacks', column: column(DEFENSE_COLUMNS, 'sacks'), line: (entry) => entry.defense, sort: true },
  interceptions: {
    label: 'Int',
    column: column(DEFENSE_COLUMNS, 'interceptions'),
    line: (entry) => entry.defense,
    sort: true,
  },
};

/*
  Short labels: the right-hand column is ~225px and "PASSING RUSHING RECEIVING"
  overflowed it into a scrolling tab strip with a scrollbar sitting in the
  panel header. The metric label above the values ("PASS YDS") carries the full
  word, so nothing is lost by abbreviating the switch itself.
*/
const OFFENSE_TABS: { key: OffenseTab; label: string }[] = [
  { key: 'passing', label: 'Pass' },
  { key: 'rushing', label: 'Rush' },
  { key: 'receiving', label: 'Rec' },
];

const DEFENSE_TABS: { key: DefenseTab; label: string }[] = [
  { key: 'tackles', label: 'Tackles' },
  { key: 'sacks', label: 'Sacks' },
  { key: 'interceptions', label: 'Int' },
];

/**
 * Ten rather than five: the two leader panels split the right-hand column's
 * full height between them, and five rows left the bottom half of each one
 * empty. The list scrolls if a short window can't take all ten.
 */
const ROWS = 10;

function valueOf<TLine>(metric: Metric<TLine>, entry: NationalLeaderEntry): number | null {
  const line = metric.line(entry);
  if (!line) return null;
  const raw = metric.column.raw(line);
  return typeof raw === 'number' ? raw : null;
}

function display<TLine>(metric: Metric<TLine>, value: number): string {
  return metric.column.format ? metric.column.format(value) : String(value);
}

function LeaderRow({
  entry,
  rank,
  value,
  onOpen,
}: {
  entry: NationalLeaderEntry;
  rank: number;
  value: string;
  onOpen: () => void;
}) {
  const name = `${entry.firstName} ${entry.lastName}`;
  return (
    <RowButton
      onClick={onOpen}
      label={`Open ${name}, ${entry.position} for ${entry.teamName}, ${value}`}
      className="min-h-[34px] flex-1"
    >
      <span className="tnum w-3 shrink-0 text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {rank}
      </span>
      <PlayerPortrait
        player={{ firstName: entry.firstName, lastName: entry.lastName, portraitAssetName: entry.portraitAssetName }}
        size="sm"
        className="!h-7 !w-7 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{name}</span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {entry.position} · {entry.teamName}
        </span>
      </span>
      <span className="tnum shrink-0 font-display text-sm font-bold text-slate-950 dark:text-white">{value}</span>
    </RowButton>
  );
}

function LeadersBody<TLine>({
  entries,
  metric,
  dynastyId,
  seasonId,
}: {
  entries: NationalLeaderEntry[];
  metric: Metric<TLine>;
  dynastyId: string;
  seasonId?: number;
}) {
  const { openPlayerModal } = usePlayerModal();

  const rows = useMemo(() => {
    const scored = entries
      .map((entry) => ({ entry, value: valueOf(metric, entry) }))
      .filter((row): row is { entry: NationalLeaderEntry; value: number } => row.value !== null && row.value > 0);
    if (metric.sort) scored.sort((a, b) => b.value - a.value);
    return scored.slice(0, ROWS);
  }, [entries, metric]);

  if (rows.length === 0) {
    return <PanelEmpty>No qualifying players in this season snapshot.</PanelEmpty>;
  }

  // Previous/Next inside the modal walks the list the user is looking at.
  const navigationIds = rows.map((row) => row.entry.playerId);

  return (
    // Rows share the panel's height rather than stacking at a fixed size, so a
    // tall window (or a 4K one) fills the column instead of leaving the bottom
    // third of it empty. `min-h` keeps a short window scrolling instead of
    // squashing them.
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--surface-raised-border)]">
      {rows.map((row, index) => (
        <LeaderRow
          key={row.entry.playerId}
          entry={row.entry}
          rank={index + 1}
          value={display(metric, row.value)}
          onOpen={() =>
            openPlayerModal(
              dynastyId,
              row.entry.playerId,
              seasonId,
              navigationIds,
              {
                name: `${row.entry.firstName} ${row.entry.lastName}`,
                position: row.entry.position,
                teamDisplayName: row.entry.teamName,
                portraitAssetName: row.entry.portraitAssetName,
              },
              row.entry.teamIndex,
            )
          }
        />
      ))}
    </div>
  );
}

function TabRow<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex min-w-0 gap-1 overflow-x-auto border border-slate-200/80 p-0.5 dark:border-slate-800"
    >
      {tabs.map(({ key, label }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              active
                ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function OffenseLeadersPanel({
  leaders,
  dynastyId,
  seasonId,
}: {
  leaders: NationalStatLeaders | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const [tab, setTab] = useState<OffenseTab>('passing');
  const metric = OFFENSE[tab];

  return (
    <DashboardPanel
      title="Offense Leaders"
      action={<PanelLink to={`/dynasty/${dynastyId}/national-stats`}>View all</PanelLink>}
      controls={<TabRow tabs={OFFENSE_TABS} value={tab} onChange={setTab} ariaLabel="Offensive category" />}
      className="min-h-0 flex-1"
      bodyClassName="flex flex-col overflow-y-auto"
    >
      <p className="mb-1 px-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {metric.label}
      </p>
      {leaders === undefined ? (
        <PanelSkeleton rows={5} />
      ) : !leaders ? (
        <PanelEmpty>No national statistics are captured for this season.</PanelEmpty>
      ) : (
        <LeadersBody entries={leaders[tab]} metric={metric} dynastyId={dynastyId} seasonId={seasonId} />
      )}
    </DashboardPanel>
  );
}

export function DefenseLeadersPanel({
  leaders,
  dynastyId,
  seasonId,
}: {
  leaders: NationalStatLeaders | null | undefined;
  dynastyId: string;
  seasonId?: number;
}) {
  const [tab, setTab] = useState<DefenseTab>('tackles');
  const metric = DEFENSE[tab];

  return (
    <DashboardPanel
      title="Defense Leaders"
      action={<PanelLink to={`/dynasty/${dynastyId}/national-stats`}>View all</PanelLink>}
      controls={<TabRow tabs={DEFENSE_TABS} value={tab} onChange={setTab} ariaLabel="Defensive category" />}
      className="min-h-0 flex-1"
      bodyClassName="flex flex-col overflow-y-auto"
    >
      <p className="mb-1 px-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        {metric.label}
      </p>
      {leaders === undefined ? (
        <PanelSkeleton rows={5} />
      ) : !leaders ? (
        <PanelEmpty>No national statistics are captured for this season.</PanelEmpty>
      ) : (
        <LeadersBody entries={leaders.defense} metric={metric} dynastyId={dynastyId} seasonId={seasonId} />
      )}
    </DashboardPanel>
  );
}
