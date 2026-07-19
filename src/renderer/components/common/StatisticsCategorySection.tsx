import { useMemo } from 'react';
import { SurfaceCard } from '../ui/SurfaceCard';
import { PlayerPortrait } from './PlayerPortrait';
import { usePlayerModal } from '../../data/PlayerModalProvider';
import { StatisticsTable, type StatColumn, type StatTableRow } from './StatisticsTable';

/**
 * Shared by the season-level Statistics page and the per-game GameDetail box
 * score, so both surfaces render category sections (leader cards + sortable
 * table) with identical visual language — see the "context" distinction in
 * StatisticsCategorySection's own doc comment for what differs between them.
 */
export type StatMode = 'season' | 'per-game';

export interface ColumnDef<TLine> {
  key: string;
  label: string;
  raw: (line: TLine) => number | null;
  /** Divide by games played in Per Game mode — false/omitted for rates, longest-play, games-played itself, and any per-game-only caller (a single game has no games-played divisor to apply). */
  perGame?: boolean;
  format?: (value: number) => string;
}

/**
 * Deliberately unconstrained — a `{ gamesPlayed?: number }` constraint trips
 * TypeScript's weak-type-detection heuristic against per-game line types
 * (OffensiveGameLine/DefensiveGameLine) that share zero property names with
 * it at all, rejecting an otherwise-valid call. The per-game division below
 * reads `gamesPlayed` defensively at runtime instead — season-level line
 * types (OffensiveStatLine etc.) have it and divide correctly; per-game line
 * types don't and never set `perGame: true` on any of their own column defs,
 * so this path is simply never exercised for them.
 */
export function withMode<TLine>(defs: ColumnDef<TLine>[], mode: StatMode): StatColumn<TLine>[] {
  return defs.map((def) => ({
    key: def.key,
    label: def.label,
    format: def.format,
    getValue: (line: TLine) => {
      const value = def.raw(line);
      if (value === null) return null;
      if (mode === 'per-game' && def.perGame) {
        const gamesPlayed = (line as { gamesPlayed?: number }).gamesPlayed ?? 0;
        return gamesPlayed > 0 ? value / gamesPlayed : null;
      }
      return value;
    },
  }));
}

export interface LeaderMetric<TLine> {
  label: string;
  value: (line: TLine) => number;
  format: (value: number) => string;
  /** Hide this leader card entirely when nobody has a positive value — e.g. Defensive Touchdowns, which most rosters (or most single games) never record. */
  onlyIfPositive?: boolean;
  /**
   * Qualification rule (Statistics Phase 3) for rate/efficiency metrics —
   * a 2-carries-for-30-yards back must not lead Yards per Carry. Rows failing
   * this are excluded from THIS card only (never from the table); if nobody
   * qualifies, the card is hidden rather than showing an unqualified leader.
   */
  qualifies?: (line: TLine) => boolean;
  /** Short human-readable rule shown on the card (e.g. "min 40 att") — always paired with `qualifies`. */
  qualifierLabel?: string;
}

/** The minimal player identity shape a leader card actually needs — satisfied structurally by any per-page row type, so one card component covers every stat category without a cast. */
export interface LeaderCardRow {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number;
  portraitAssetName: string | null;
}

export function LeaderCard({
  dynastyId,
  seasonId,
  label,
  row,
  value,
  tiedCount,
  qualifier,
}: {
  dynastyId: string;
  seasonId?: number;
  label: string;
  row: LeaderCardRow;
  value: string;
  /** Number of OTHER players tied with this one for the lead — 0 means a clear, untied leader. */
  tiedCount: number;
  /** Qualification rule display (e.g. "min 40 att") for rate metrics — see LeaderMetric.qualifierLabel. */
  qualifier?: string;
}) {
  const { openPlayerModal } = usePlayerModal();
  return (
    <button
      type="button"
      onClick={() => openPlayerModal(dynastyId, row.playerId, seasonId)}
      className="corner-cut-sm flex w-full items-center gap-3 border border-slate-200/80 bg-slate-50/85 p-3 text-left transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <PlayerPortrait player={row} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          {label}
          {tiedCount > 0 ? ' — Tied' : ''}
          {qualifier ? <span className="ml-1.5 normal-case tracking-normal opacity-70">({qualifier})</span> : null}
        </p>
        <p className="truncate font-semibold text-slate-900 dark:text-white">
          {row.firstName} {row.lastName}
          {tiedCount > 0 && (
            <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
              +{tiedCount} other{tiedCount === 1 ? '' : 's'}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {row.position} #{row.jerseyNumber}
        </p>
      </div>
      <p className="type-stat-md shrink-0 text-slate-950 dark:text-white">{value}</p>
    </button>
  );
}

/**
 * A titled SurfaceCard combining a leader-card grid (top performer per
 * metric, portrait + name + position/jersey + value, click-to-modal) with a
 * sortable StatisticsTable below it — the shared visual unit both Statistics
 * (context="season", full-season totals, more players, qualification rules
 * left to the caller) and GameDetail (context="per-game" in spirit — no
 * perGame column divides anything, since a single game has no season to
 * average across) build every category section from.
 */
export function StatisticsCategorySection<TLine>({
  dynastyId,
  seasonId,
  title,
  rows,
  columnDefs,
  mode,
  defaultSortKey,
  leaders,
  emptyStateMessage,
}: {
  dynastyId: string;
  seasonId?: number;
  title: string;
  rows: (StatTableRow<TLine> & LeaderCardRow)[];
  columnDefs: ColumnDef<TLine>[];
  mode: StatMode;
  defaultSortKey: string;
  leaders: LeaderMetric<TLine>[];
  emptyStateMessage: string;
}) {
  const columns = useMemo(() => withMode(columnDefs, mode), [columnDefs, mode]);

  const leaderCards = useMemo(() => {
    if (rows.length === 0) return [];
    return leaders
      .map((metric) => {
        const qualified = metric.qualifies ? rows.filter((r) => metric.qualifies!(r.line)) : rows;
        if (qualified.length === 0) return null;
        const max = Math.max(...qualified.map((r) => metric.value(r.line)));
        if (metric.onlyIfPositive && max <= 0) return null;
        const tied = qualified.filter((r) => metric.value(r.line) === max);
        return { metric, leader: tied[0], tiedCount: tied.length - 1, value: max };
      })
      .filter((entry): entry is { metric: LeaderMetric<TLine>; leader: (typeof rows)[number]; tiedCount: number; value: number } => entry !== null);
  }, [rows, leaders]);

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{title}</p>
      {leaderCards.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leaderCards.map(({ metric, leader, tiedCount, value }) => (
            <LeaderCard
              key={metric.label}
              dynastyId={dynastyId}
              seasonId={seasonId}
              label={metric.label}
              row={leader}
              value={metric.format(value)}
              tiedCount={tiedCount}
              qualifier={metric.qualifierLabel}
            />
          ))}
        </div>
      )}
      <div className="mt-4">
        <StatisticsTable
          dynastyId={dynastyId}
          seasonId={seasonId}
          rows={rows}
          columns={columns}
          defaultSortKey={defaultSortKey}
          emptyStateMessage={emptyStateMessage}
        />
      </div>
    </SurfaceCard>
  );
}
