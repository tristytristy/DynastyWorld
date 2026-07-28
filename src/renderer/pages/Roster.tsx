import type { HTMLAttributes, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { EditButton } from '../components/common/CoachCard';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { PageHeader } from '../components/ui/PageHeader';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { usePlayerHoverCard } from '../data/PlayerHoverProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import {
  CLASS_ORDER,
  POSITION_ORDER,
  abbreviateClass,
  classSortIndex,
  positionSortIndex,
  unitForPosition,
  type Unit,
} from '../lib/rosterOrder';
import type { RosterPlayer } from '../../shared/types';

type SortKey = 'jersey' | 'name' | 'position' | 'class' | 'hometown' | 'height' | 'weight' | 'overall' | 'nil';

/** NIL pay ($K) → "$195K" / "$1.2M"; em-dash for no deal. */
function formatNil(k: number): string {
  if (!k) return '—';
  return k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${k}K`;
}
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'gallery';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'jersey', label: 'Jersey' },
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Position' },
  { key: 'class', label: 'Class' },
  { key: 'hometown', label: 'Hometown' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'overall', label: 'Overall' },
];

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  jersey: 'asc',
  name: 'asc',
  position: 'asc',
  class: 'asc',
  hometown: 'asc',
  height: 'desc',
  weight: 'desc',
  overall: 'desc',
  nil: 'desc',
};

const UNITS: Unit[] = ['Offense', 'Defense', 'Special Teams'];

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}' ${inches % 12}"`;
}

function CaptainBadge() {
  return (
    <span
      title="Team captain"
      className="inline-flex h-4 min-w-4 items-center justify-center bg-amber-100 px-1 text-[10px] font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-300"
    >
      C
    </span>
  );
}


function sortPlayers(players: RosterPlayer[], key: SortKey, dir: SortDir): RosterPlayer[] {
  const sorted = [...players].sort((a, b) => {
    switch (key) {
      case 'jersey':
        return a.jerseyNumber - b.jerseyNumber;
      case 'name':
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      case 'position':
        return positionSortIndex(a.position) - positionSortIndex(b.position);
      case 'class':
        return classSortIndex(a.schoolYear) - classSortIndex(b.schoolYear);
      case 'hometown':
        return `${a.hometown}, ${a.homeState}`.localeCompare(`${b.hometown}, ${b.homeState}`);
      case 'height':
        return a.heightInches - b.heightInches;
      case 'weight':
        return a.weightPounds - b.weightPounds;
      case 'overall':
        return a.overallRating - b.overallRating;
      case 'nil':
        return (a.nilCompensation ?? 0) - (b.nilCompensation ?? 0);
    }
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.22em]">
      <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-2 hover:underline">
        <span>{label}</span>
        <span className="w-8 text-[10px] text-white/80">{isActive ? (activeDir === 'asc' ? 'ASC' : 'DESC') : ''}</span>
      </button>
    </th>
  );
}

function PlayerCard({ player, onOpen, onEdit, teamAssetName, nameHoverProps }: { player: RosterPlayer; onOpen: () => void; onEdit?: (event: MouseEvent) => void; teamAssetName?: string | null; nameHoverProps?: HTMLAttributes<HTMLSpanElement> }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col items-start gap-4 rounded-xl border border-white/65 bg-white/76 p-5 text-left shadow-[0_20px_70px_-44px_rgba(15,23,42,0.38)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[var(--team-primary)] dark:border-white/10 dark:bg-slate-950/72"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            <PlayerPortrait player={player} size="md" teamAssetName={teamAssetName} />
            <span className="absolute -bottom-2 -right-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--team-primary)] text-sm font-bold text-[var(--team-on-primary)] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]">
              {player.jerseyNumber}
            </span>
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-slate-950 dark:text-white">
              {onEdit && <EditButton onClick={onEdit} label={`Edit ${player.firstName} ${player.lastName}`} />}
              <span className="inline-flex items-center gap-1.5" {...nameHoverProps}>
                {player.firstName} {player.lastName}
                {player.isCaptain && <CaptainBadge />}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {player.position} | {abbreviateClass(player.schoolYear)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="border border-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
            {player.overallRating} OVR
          </span>
          {(player.nilCompensation ?? 0) > 0 && (
            <span className="proportional-nums text-xs font-semibold text-slate-400 dark:text-slate-500">
              {formatNil(player.nilCompensation ?? 0)} NIL
            </span>
          )}
        </div>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Archetype</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{player.archetype}</p>
        </div>
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Hometown</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{player.hometown}, {player.homeState}</p>
        </div>
      </div>
    </div>
  );
}

export function Roster() {
  const { id } = useParams<{ id: string }>();
  const { openPlayerModal } = usePlayerModal();
  const { openPlayerEditor } = useEditorModal();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  // Editing is only ever allowed on the live, current season — a past
  // season's roster is a frozen snapshot with nothing real left to write an
  // edit back to. Same rule PlayerProfileContent enforces centrally for the
  // player modal; kept in sync here since Roster has its own quick-edit icons.
  const canEditRoster = seasons.find((s) => s.id === seasonId)?.isCurrent ?? false;
  const [roster, setRoster] = useState<RosterPlayer[] | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState<Unit | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<ViewMode>('list');

  const { viewedTeamIndex, leagueTeams, userTeamName } = useViewedTeam();
  const viewedTeamName =
    viewedTeamIndex === null ? null : (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? null);

  // Hover-preview trading card: one hook, reused across every name in the list.
  const { hoverProps } = usePlayerHoverCard();
  const hoverTeamName = viewedTeamName ?? userTeamName;
  const hoverSeasonYear = seasons.find((s) => s.id === seasonId)?.seasonYear ?? null;
  const hoverFor = (player: RosterPlayer) =>
    id ? hoverProps({ player, teamName: hoverTeamName, seasonYear: hoverSeasonYear, dynastyId: id }) : {};

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRoster(undefined);
    // League mode: another team's roster from the per-season league snapshot
    // (LeagueRosterPlayer extends RosterPlayer, so the page renders it as-is).
    const fetchRoster =
      viewedTeamIndex === null
        ? window.api.db.getRoster(id, seasonId)
        : window.api.db.getLeagueTeamRoster(id, viewedTeamIndex, seasonId).then((r) => r?.players ?? null);
    fetchRoster.then((result) => {
      if (!cancelled) setRoster(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId, viewedTeamIndex]);

  const positions = useMemo(() => {
    const present = new Set((roster ?? []).map((player) => player.position));
    return POSITION_ORDER.filter((position) => present.has(position));
  }, [roster]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    const query = search.trim().toLowerCase();
    return roster.filter((player) => {
      if (positionFilter && player.position !== positionFilter) return false;
      if (classFilter && player.schoolYear !== classFilter) return false;
      if (unitFilter && unitForPosition(player.position) !== unitFilter) return false;
      if (query && !`${player.firstName} ${player.lastName}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [roster, search, positionFilter, classFilter, unitFilter]);

  const sorted = useMemo(() => sortPlayers(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  const classBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of roster ?? []) {
      counts.set(player.schoolYear, (counts.get(player.schoolYear) ?? 0) + 1);
    }
    return CLASS_ORDER.map((cls) => ({ cls, count: counts.get(cls) ?? 0 })).filter((item) => item.count > 0);
  }, [roster]);

  const averageOverall = useMemo(() => {
    if (!roster || roster.length === 0) return '0';
    const total = roster.reduce((sum, player) => sum + player.overallRating, 0);
    return (total / roster.length).toFixed(1);
  }, [roster]);

  // Total team NIL spend — sum of every rostered player's current NIL pay.
  const nilTotal = useMemo(
    () => (roster ?? []).reduce((sum, player) => sum + (player.nilCompensation ?? 0), 0),
    [roster],
  );

  function openPlayer(playerId: number) {
    if (!id) return;
    // The exact currently-visible order (search/filter/sort applied) — powers the modal's Previous/Next.
    const player = sorted.find((p) => p.id === playerId);
    openPlayerModal(
      id,
      playerId,
      seasonId,
      sorted.map((p) => p.id),
      viewedTeamIndex !== null && player && viewedTeamName
        ? {
            name: `${player.firstName} ${player.lastName}`,
            position: player.position,
            teamDisplayName: viewedTeamName,
            portraitAssetName: player.portraitAssetName,
          }
        : undefined,
      viewedTeamIndex ?? undefined,
    );
  }

  function refreshRoster() {
    if (!id) return;
    if (viewedTeamIndex === null) {
      window.api.db.getRoster(id, seasonId).then(setRoster);
    } else {
      window.api.db.getLeagueTeamRoster(id, viewedTeamIndex, seasonId).then((r) => setRoster(r?.players ?? null));
    }
  }

  function editPlayer(player: RosterPlayer) {
    if (!id) return;
    openPlayerEditor({
      dynastyId: id,
      playerId: player.id,
      playerLabel: `${player.firstName} ${player.lastName}`,
      onSaved: refreshRoster,
    });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  }

  if (roster === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading roster...</p>;
  }

  if (roster === null) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Roster not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roster"
        title={viewedTeamName ? `${viewedTeamName} roster.` : 'Search, compare, and review every player in one pass.'}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Players" value={String(roster.length)} />
        <StatTile label="Filtered" value={String(sorted.length)} />
        <StatTile label="Average OVR" value={averageOverall} />
        <StatTile label="NIL" value={formatNil(nilTotal)} />
      </div>

      <SurfaceCard>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            />
            <select
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value as Unit | '')}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            >
              <option value="">All units</option>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            >
              <option value="">All positions</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            >
              <option value="">All classes</option>
              {CLASS_ORDER.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <select
              value={sortKey}
              onChange={(event) => handleSort(event.target.value as SortKey)}
              className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
            >
              {sortDir === 'asc' ? 'Ascending' : 'Descending'}
            </button>
            <div className="flex border border-slate-200/80 bg-slate-50/85 p-1 dark:border-slate-800 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-4 py-2 text-sm font-medium transition ${
                  view === 'list'
                    ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                    : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView('gallery')}
                className={`px-4 py-2 text-sm font-medium transition ${
                  view === 'gallery'
                    ? 'bg-[var(--team-primary)] text-[var(--team-on-primary)]'
                    : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                Gallery
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {classBreakdown.map(({ cls, count }) => (
            <span key={cls} className="border border-slate-200/80 px-3 py-1 dark:border-slate-700">
              {count} {cls}
            </span>
          ))}
        </div>
      </SurfaceCard>

      {view === 'gallery' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {sorted.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              teamAssetName={viewedTeamName ?? userTeamName}
              nameHoverProps={hoverFor(player)}
              onOpen={() => openPlayer(player.id)}
              onEdit={
                canEditRoster
                  ? (event) => {
                      event.stopPropagation();
                      editPlayer(player);
                    }
                  : undefined
              }
            />
          ))}
          {sorted.length === 0 && (
            <SurfaceCard className="col-span-full text-center text-sm text-slate-400 dark:text-slate-500">
              No players match these filters.
            </SurfaceCard>
          )}
        </div>
      ) : (
        <SurfaceCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                <tr>
                  <th className="px-3 py-3" aria-hidden="true" />
                  <SortableHeader label="No." sortKey="jersey" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Name" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Pos." sortKey="position" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Ht." sortKey="height" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Wt." sortKey="weight" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Yr." sortKey="class" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="OVR" sortKey="overall" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="NIL" sortKey="nil" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Hometown" sortKey="hometown" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((player) => (
                  <tr
                    key={player.id}
                    onClick={() => openPlayer(player.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openPlayer(player.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${player.firstName} ${player.lastName}'s profile`}
                    className="cursor-pointer border-b border-white/60 bg-slate-50/80 transition hover:bg-slate-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <td className="px-3 py-3">
                      {canEditRoster && (
                        <EditButton
                          onClick={(event) => {
                            event.stopPropagation();
                            editPlayer(player);
                          }}
                          label={`Edit ${player.firstName} ${player.lastName}`}
                        />
                      )}
                    </td>
                    <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{player.jerseyNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <span className="inline-flex items-center gap-1.5" {...hoverFor(player)}>
                        {player.firstName} {player.lastName}
                        {player.isCaptain && <CaptainBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {player.position}
                    </td>
                    <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{formatHeight(player.heightInches)}</td>
                    <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{player.weightPounds}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{abbreviateClass(player.schoolYear)}</td>
                    <td className="proportional-nums px-4 py-3 font-semibold text-slate-900 dark:text-white">{player.overallRating}</td>
                    <td className="proportional-nums px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{formatNil(player.nilCompensation ?? 0)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{player.hometown}, {player.homeState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No players match these filters.</p>
          )}
        </SurfaceCard>
      )}

    </div>
  );
}

