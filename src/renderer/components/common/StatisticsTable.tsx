import { GRADIENT_TEAM_BLOCK } from '../../lib/gradients';
import { useMemo, useState } from 'react';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { useViewedTeamOptional } from '../../data/ViewedTeamProvider';
import { TeamLink } from './TeamLink';

/** One numeric (or "-") column in a statistics table. `getValue` returning null means genuinely not applicable for this row (e.g. a rate stat with a zero denominator) — rendered as "-", never as 0. */
export interface StatColumn<TLine> {
  key: string;
  label: string;
  getValue: (line: TLine) => number | null;
  format?: (value: number) => string;
}

export interface StatTableRow<TLine> {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  schoolYear: string;
  line: TLine;
  /** National leaderboards only — shows the player's team (as a clickable TeamLink) under the name. Omitted on single-team tables. */
  teamName?: string;
  teamIndex?: number;
}

type SortDir = 'asc' | 'desc';

function defaultFormat(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

export function StatisticsTable<TLine>({
  dynastyId,
  seasonId,
  rows,
  columns,
  defaultSortKey,
  defaultSortDirection = 'desc',
  emptyStateMessage,
}: {
  dynastyId: string;
  seasonId?: number;
  rows: StatTableRow<TLine>[];
  columns: StatColumn<TLine>[];
  defaultSortKey: string;
  defaultSortDirection?: SortDir;
  emptyStateMessage: string;
}) {
  const { openPlayerModal } = usePlayerModal();
  // When the page is browsing another team via the team switcher, player
  // clicks resolve against that team's league snapshot. Null-safe because
  // this table also renders inside the app-root player modal.
  const viewedTeamIndex = useViewedTeamOptional()?.viewedTeamIndex ?? null;
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDirection);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      const column = columns.find((c) => c.key === sortKey);
      if (!column) return 0;
      const av = column.getValue(a.line);
      const bv = column.getValue(b.line);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av - bv;
    });
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [rows, columns, sortKey, sortDir]);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  function openPlayer(playerId: number) {
    // National leaderboards carry a per-row teamIndex — resolve the player against
    // THAT team's league snapshot; single-team tables fall back to the page's viewed team.
    const rowTeamIndex = sorted.find((row) => row.playerId === playerId)?.teamIndex;
    openPlayerModal(dynastyId, playerId, seasonId, sorted.map((row) => row.playerId), undefined, rowTeamIndex ?? viewedTeamIndex ?? undefined);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-white/5 dark:text-slate-500">
        {emptyStateMessage}
      </p>
    );
  }

  return (
    /*
      `max-h` + `overflow-auto` gives the header below a scrollport of its own.
      Without it (this was `overflow-x-auto` only) the sticky header pinned
      against the PAGE, which puts it at the same place as the section nav —
      and that nav wins on z-index, so the column headers disappeared behind it
      partway down a long table. Same pattern as Rivalries / National Recruits.
    */
    <div className="max-h-[70vh] overflow-auto border border-slate-200/80 dark:border-slate-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead className={`sticky top-0 z-10 ${GRADIENT_TEAM_BLOCK} font-display text-[var(--team-on-primary)]`}>
          <tr>
            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">No.</th>
            <SortHeader label="Player" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} align="left" />
            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Pos</th>
            {columns.map((col) => (
              <SortHeader key={col.key} label={col.label} sortKey={col.key} activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.playerId}
              onClick={() => openPlayer(row.playerId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPlayer(row.playerId);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View ${row.firstName} ${row.lastName}'s profile`}
              className="cursor-pointer border-b border-slate-200/70 bg-white/60 transition last:border-b-0 hover:bg-slate-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-slate-800/70 dark:bg-transparent dark:hover:bg-white/5"
            >
              <td className="tnum whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">{row.jerseyNumber}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                <span className="flex flex-col">
                  <span>
                    {row.firstName} {row.lastName}
                    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{row.schoolYear}</span>
                  </span>
                  {row.teamName && (
                    <TeamLink
                      teamIndex={row.teamIndex}
                      teamName={row.teamName}
                      seasonId={seasonId}
                      size="sm"
                      logoClassName="!h-4 !w-4"
                      className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400"
                    />
                  )}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.position}</td>
              {columns.map((col) => {
                const value = col.getValue(row.line);
                return (
                  <td key={col.key} className="tnum whitespace-nowrap px-3 py-2.5 text-right text-slate-700 dark:text-slate-200">
                    {value === null ? '-' : (col.format ?? defaultFormat)(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
  align = 'right',
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  activeDir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] ${align === 'left' ? 'text-left' : 'text-right'}`}>
      <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1.5 hover:underline ${align === 'left' ? '' : 'flex-row-reverse'}`}>
        <span>{label}</span>
        <span className="w-3 text-[10px] text-white/80">{isActive ? (activeDir === 'asc' ? '↑' : '↓') : ''}</span>
      </button>
    </th>
  );
}
