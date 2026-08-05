import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { TeamLink } from '../components/common/TeamLink';
import { StatisticsCategorySection, type StatMode } from '../components/common/StatisticsCategorySection';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import {
  oneDecimal,
  PASSING_COLUMNS,
  RUSHING_COLUMNS,
  RECEIVING_COLUMNS,
  DEFENSE_COLUMNS,
} from '../lib/statColumns';
import type {
  DefensiveStatLine,
  NationalLeaderEntry,
  NationalStatLeaders,
  NationalTeamStatRow,
  OffensiveStatLine,
} from '../../shared/types';

type View = 'team' | 'player';

const intFmt = (v: number) => Math.round(v).toLocaleString();

interface TeamStatCol {
  key: string;
  label: string;
  value: (r: NationalTeamStatRow) => number;
  /** Divided by games in Per-Game mode. Rates/margins are not. */
  perGameable: boolean;
  format: (v: number, perGame: boolean) => string;
}

const TEAM_COLS: TeamStatCol[] = [
  { key: 'points', label: 'PF', value: (r) => r.points, perGameable: true, format: (v, pg) => (pg ? v.toFixed(1) : intFmt(v)) },
  { key: 'offenseYards', label: 'Total O', value: (r) => r.offenseYards, perGameable: true, format: (v) => intFmt(v) },
  { key: 'passYards', label: 'Pass', value: (r) => r.passYards, perGameable: true, format: (v) => intFmt(v) },
  { key: 'rushYards', label: 'Rush', value: (r) => r.rushYards, perGameable: true, format: (v) => intFmt(v) },
  { key: 'pointsAllowed', label: 'PA', value: (r) => r.pointsAllowed, perGameable: true, format: (v, pg) => (pg ? v.toFixed(1) : intFmt(v)) },
  { key: 'defTotalYards', label: 'Total D', value: (r) => r.defTotalYards, perGameable: true, format: (v) => intFmt(v) },
  { key: 'totalYards', label: 'All-P', value: (r) => r.totalYards, perGameable: true, format: (v) => intFmt(v) },
  {
    key: 'thirdDown',
    label: '3rd %',
    value: (r) => (r.thirdDownAtt > 0 ? (100 * r.thirdDownConv) / r.thirdDownAtt : 0),
    perGameable: false,
    format: (v) => `${v.toFixed(1)}%`,
  },
  { key: 'margin', label: 'TO Marg', value: (r) => r.takeaways - r.turnovers, perGameable: false, format: (v) => `${v > 0 ? '+' : ''}${v}` },
  { key: 'sacks', label: 'Sacks', value: (r) => r.sacks, perGameable: true, format: (v) => intFmt(v) },
];

function NationalTeamTable({ rows, mode }: { rows: NationalTeamStatRow[]; mode: StatMode }) {
  const perGame = mode === 'per-game';
  const [sortKey, setSortKey] = useState('points');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const display = useCallback(
    (r: NationalTeamStatRow, col: TeamStatCol) =>
      col.perGameable && perGame && r.games > 0 ? col.value(r) / r.games : col.value(r),
    [perGame],
  );

  const sorted = useMemo(() => {
    const col = TEAM_COLS.find((c) => c.key === sortKey) ?? TEAM_COLS[0];
    const copy = [...rows].sort((a, b) => display(a, col) - display(b, col));
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [rows, sortKey, sortDir, display]);

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <SurfaceCard className="overflow-hidden p-0">
      {/*
        The table scrolls INSIDE its own card (`max-h` + `overflow-auto`), which
        is what makes the sticky header below work. With only `overflow-x-auto`
        here the header had no vertical scrollport of its own, so it pinned
        against the PAGE instead and slid under the section nav — which pins at
        the same place with a higher z-index. Rivalries and National Recruits
        already use this pattern; this matches them.
      */}
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--team-primary)] font-display text-[var(--team-on-primary)]">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">#</th>
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Team</th>
              {TEAM_COLS.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em]">
                  <button type="button" onClick={() => onSort(col.key)} className="inline-flex flex-row-reverse items-center gap-1.5 hover:underline">
                    <span>{col.label}</span>
                    <span className="w-3 text-[10px] text-[var(--team-on-primary)]/80">{sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.teamIndex}
                className="border-b border-slate-200/70 bg-white/60 transition last:border-b-0 hover:bg-slate-100/90 dark:border-slate-800/70 dark:bg-transparent dark:hover:bg-white/5"
              >
                <td className="tnum whitespace-nowrap px-3 py-2.5 text-slate-400 dark:text-slate-500">{i + 1}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TeamLink
                      teamIndex={r.teamIndex}
                      teamName={r.teamName}
                      size="sm"
                      nameClassName="whitespace-nowrap font-semibold text-slate-900 dark:text-white"
                    />
                    <span className="text-xs text-slate-400 dark:text-slate-500">{r.conferenceName}</span>
                  </div>
                </td>
                {TEAM_COLS.map((col) => (
                  <td key={col.key} className="tnum whitespace-nowrap px-3 py-2.5 text-right text-slate-700 dark:text-slate-200">
                    {col.format(display(r, col), perGame)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}

/** Adapt a national leader entry to a StatisticsCategorySection row (identity + team + the unit's stat line). */
const offRow = (e: NationalLeaderEntry) => ({
  playerId: e.playerId,
  firstName: e.firstName,
  lastName: e.lastName,
  position: e.position,
  jerseyNumber: e.jerseyNumber,
  schoolYear: e.schoolYear,
  portraitAssetName: e.portraitAssetName,
  teamName: e.teamName,
  teamIndex: e.teamIndex,
  line: e.offense as OffensiveStatLine,
});
const defRow = (e: NationalLeaderEntry) => ({
  playerId: e.playerId,
  firstName: e.firstName,
  lastName: e.lastName,
  position: e.position,
  jerseyNumber: e.jerseyNumber,
  schoolYear: e.schoolYear,
  portraitAssetName: e.portraitAssetName,
  teamName: e.teamName,
  teamIndex: e.teamIndex,
  line: e.defense as DefensiveStatLine,
});

export function NationalStatistics() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [teamStats, setTeamStats] = useState<NationalTeamStatRow[] | null | undefined>(undefined);
  const [leaders, setLeaders] = useState<NationalStatLeaders | null | undefined>(undefined);
  const [view, setView] = useState<View>('team');
  const [mode, setMode] = useState<StatMode>('per-game');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setTeamStats(undefined);
    setLeaders(undefined);
    window.api.db.getNationalTeamStats(id, seasonId).then((r) => !cancelled && setTeamStats(r));
    window.api.db.getNationalStatLeaders(id, seasonId).then((r) => !cancelled && setLeaders(r));
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const passingRows = useMemo(() => (leaders?.passing ?? []).map(offRow), [leaders]);
  const rushingRows = useMemo(() => (leaders?.rushing ?? []).map(offRow), [leaders]);
  const receivingRows = useMemo(() => (leaders?.receiving ?? []).map(offRow), [leaders]);
  const defenseRows = useMemo(() => (leaders?.defense ?? []).map(defRow), [leaders]);

  if (!id) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="National Statistics"
        title="Where every program and player ranks in the nation."
        description="Team and player leaderboards across all of FBS for the selected season — click any team or player to dig in."
      />

      {/*
        Sticky controls — mode switch + total/per-game, shared by both views.
        Offsets by `--section-nav-h` and stays opaque for the same reasons as the
        Team Statistics bar: `top-0` now lands under the pinned section nav, and
        a translucent pinned row ghosts the page scrolling beneath it.
      */}
      <div className="sticky top-[var(--pinned-top,4.4375rem)] z-20 flex flex-wrap items-center justify-between gap-3 border border-slate-200/70 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0d0d10]">
        <SegmentedControl<View>
          value={view}
          onChange={setView}
          ariaLabel="National statistics mode"
          options={[
            { value: 'team', label: 'Team Stats' },
            { value: 'player', label: 'Player Stats' },
          ]}
        />
        <SegmentedControl<StatMode>
          value={mode}
          onChange={setMode}
          ariaLabel="Totals or per game"
          size="sm"
          options={[
            { value: 'season', label: 'Season Total' },
            { value: 'per-game', label: 'Per Game' },
          ]}
        />
      </div>

      {view === 'team' ? (
        teamStats === undefined ? (
          <p className="text-slate-500 dark:text-slate-400">Loading team leaderboard…</p>
        ) : !teamStats || teamStats.length === 0 ? (
          <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
            No national team statistics for this season yet — they fill in once games have been played and synced.
          </SurfaceCard>
        ) : (
          <NationalTeamTable rows={teamStats} mode={mode} />
        )
      ) : leaders === undefined ? (
        <p className="text-slate-500 dark:text-slate-400">Loading player leaderboards…</p>
      ) : !leaders ? (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
          No national player statistics for this season yet.
        </SurfaceCard>
      ) : (
        <>
          <StatisticsCategorySection
            dynastyId={id}
            seasonId={seasonId}
            title="Passing"
            rows={passingRows}
            columnDefs={PASSING_COLUMNS}
            mode={mode}
            collapsible
            displayLimit={100}
            defaultSortKey="passYards"
            leaders={[
              { label: 'Passing Yards', value: (l) => l.passYards, format: (v) => v.toLocaleString() },
              { label: 'Passing Touchdowns', value: (l) => l.passTDs, format: (v) => v.toLocaleString() },
            ]}
            emptyStateMessage="No passing statistics recorded nationally yet."
          />
          <StatisticsCategorySection
            dynastyId={id}
            seasonId={seasonId}
            title="Rushing"
            rows={rushingRows}
            columnDefs={RUSHING_COLUMNS}
            mode={mode}
            collapsible
            displayLimit={100}
            defaultSortKey="rushYards"
            leaders={[
              { label: 'Rushing Yards', value: (l) => l.rushYards, format: (v) => v.toLocaleString() },
              { label: 'Rushing Touchdowns', value: (l) => l.rushTDs, format: (v) => v.toLocaleString() },
              { label: 'Yards per Carry', value: (l) => (l.rushAttempts > 0 ? l.rushYards / l.rushAttempts : 0), format: oneDecimal, qualifies: (l) => l.rushAttempts >= 60, qualifierLabel: 'min 60 att' },
            ]}
            emptyStateMessage="No rushing statistics recorded nationally yet."
          />
          <StatisticsCategorySection
            dynastyId={id}
            seasonId={seasonId}
            title="Receiving"
            rows={receivingRows}
            columnDefs={RECEIVING_COLUMNS}
            mode={mode}
            collapsible
            displayLimit={100}
            defaultSortKey="receivingYards"
            leaders={[
              { label: 'Receiving Yards', value: (l) => l.receivingYards, format: (v) => v.toLocaleString() },
              { label: 'Receptions', value: (l) => l.receptions, format: (v) => v.toLocaleString() },
              { label: 'Receiving Touchdowns', value: (l) => l.receivingTDs, format: (v) => v.toLocaleString() },
            ]}
            emptyStateMessage="No receiving statistics recorded nationally yet."
          />
          <StatisticsCategorySection
            dynastyId={id}
            seasonId={seasonId}
            title="Defense"
            rows={defenseRows}
            columnDefs={DEFENSE_COLUMNS}
            mode={mode}
            collapsible
            displayLimit={100}
            defaultSortKey="tackles"
            leaders={[
              { label: 'Tackles', value: (l) => l.tackles, format: (v) => v.toLocaleString() },
              { label: 'Sacks', value: (l) => l.sacks, format: oneDecimal },
              { label: 'Interceptions', value: (l) => l.interceptions, format: (v) => v.toLocaleString() },
            ]}
            emptyStateMessage="No defensive statistics recorded nationally yet."
          />
        </>
      )}
    </div>
  );
}
