import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { TeamLogo } from '../components/common/TeamLogo';
import { EditButton } from '../components/common/CoachCard';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { PageHeader } from '../components/ui/PageHeader';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import {
  CLASS_ORDER,
  POSITION_ORDER,
  abbreviateClass,
  classSortIndex,
  positionSortIndex,
  unitForPosition,
  type Unit,
} from '../lib/rosterOrder';
import type { NationalPlayer } from '../../shared/types';

type SortKey = 'jersey' | 'name' | 'team' | 'position' | 'class' | 'height' | 'weight' | 'overall';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'gallery';

// The national field is thousands of players; render a bounded slice (same
// approach as the National Recruits browser) and lean on search/filters/sort
// to surface the rest — keeps the page as snappy as the single-team roster.
const RENDER_CAP = 200;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'name', label: 'Name' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Position' },
  { key: 'class', label: 'Class' },
  { key: 'jersey', label: 'Jersey' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
];

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  jersey: 'asc',
  name: 'asc',
  team: 'asc',
  position: 'asc',
  class: 'asc',
  height: 'desc',
  weight: 'desc',
  overall: 'desc',
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

function sortPlayers(players: NationalPlayer[], key: SortKey, dir: SortDir): NationalPlayer[] {
  const sorted = [...players].sort((a, b) => {
    switch (key) {
      case 'jersey':
        return a.jerseyNumber - b.jerseyNumber;
      case 'name':
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      case 'team':
        return a.teamDisplayName.localeCompare(b.teamDisplayName);
      case 'position':
        return positionSortIndex(a.position) - positionSortIndex(b.position);
      case 'class':
        return classSortIndex(a.schoolYear) - classSortIndex(b.schoolYear);
      case 'height':
        return a.heightInches - b.heightInches;
      case 'weight':
        return a.weightPounds - b.weightPounds;
      case 'overall':
        return a.overallRating - b.overallRating;
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

function PlayerCard({ player, onOpen, onEdit }: { player: NationalPlayer; onOpen: () => void; onEdit?: (event: MouseEvent) => void }) {
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
            <PlayerPortrait player={player} size="md" teamAssetName={player.teamDisplayName} />
            <span className="absolute -bottom-2 -right-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--team-primary)] text-sm font-bold text-[var(--team-on-primary)] shadow-[0_18px_40px_-24px_rgba(37,99,235,0.9)]">
              {player.jerseyNumber}
            </span>
          </div>
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-slate-950 dark:text-white">
              {onEdit && <EditButton onClick={onEdit} label={`Edit ${player.firstName} ${player.lastName}`} />}
              {player.firstName} {player.lastName}
              {player.isCaptain && <CaptainBadge />}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {player.position} | {abbreviateClass(player.schoolYear)}
              </span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <TeamLogo team={{ assetName: player.teamDisplayName, label: player.teamDisplayName }} size="sm" className="!h-5 !w-5" />
              <span className="truncate">{player.teamDisplayName}</span>
            </p>
          </div>
        </div>
        <span className="border border-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
          {player.overallRating} OVR
        </span>
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

export function NationalPlayers() {
  const { id } = useParams<{ id: string }>();
  const { openPlayerModal } = usePlayerModal();
  const { openPlayerEditor } = useEditorModal();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  // Editing writes to the live save, so it's only offered on the current
  // season — the same rule the Team Hub roster uses. Editing a league player
  // (any team) already works there via the team switcher, so it's consistent
  // to offer it here too.
  const canEdit = seasons.find((s) => s.id === seasonId)?.isCurrent ?? false;
  const [players, setPlayers] = useState<NationalPlayer[] | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState<Unit | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [view, setView] = useState<ViewMode>('list');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setPlayers(undefined);
    window.api.db.getAllLeaguePlayers(id, seasonId).then((result) => {
      if (!cancelled) setPlayers(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const conferences = useMemo(() => {
    const present = new Set<string>();
    for (const p of players ?? []) if (p.conferenceName) present.add(p.conferenceName);
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const teams = useMemo(() => {
    // Team dropdown narrows to the selected conference (when one is chosen) so
    // it stays scannable instead of listing all ~130 programs at once.
    const present = new Set<string>();
    for (const p of players ?? []) {
      if (conferenceFilter && p.conferenceName !== conferenceFilter) continue;
      present.add(p.teamDisplayName);
    }
    return [...present].sort((a, b) => a.localeCompare(b));
  }, [players, conferenceFilter]);

  const positions = useMemo(() => {
    const present = new Set((players ?? []).map((p) => p.position));
    return POSITION_ORDER.filter((position) => present.has(position));
  }, [players]);

  const filtered = useMemo(() => {
    if (!players) return [];
    const query = search.trim().toLowerCase();
    return players.filter((player) => {
      if (conferenceFilter && player.conferenceName !== conferenceFilter) return false;
      if (teamFilter && player.teamDisplayName !== teamFilter) return false;
      if (positionFilter && player.position !== positionFilter) return false;
      if (classFilter && player.schoolYear !== classFilter) return false;
      if (unitFilter && unitForPosition(player.position) !== unitFilter) return false;
      if (query && !`${player.firstName} ${player.lastName}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [players, search, conferenceFilter, teamFilter, positionFilter, classFilter, unitFilter]);

  const sorted = useMemo(() => sortPlayers(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const shown = useMemo(() => sorted.slice(0, RENDER_CAP), [sorted]);

  const averageOverall = useMemo(() => {
    if (filtered.length === 0) return '0';
    const total = filtered.reduce((sum, player) => sum + player.overallRating, 0);
    return (total / filtered.length).toFixed(1);
  }, [filtered]);

  const teamCount = useMemo(() => new Set((players ?? []).map((p) => p.teamDisplayName)).size, [players]);

  function openPlayer(playerId: number) {
    if (!id) return;
    const player = shown.find((p) => p.id === playerId);
    openPlayerModal(
      id,
      playerId,
      seasonId,
      // Previous/Next walks the currently-rendered slice.
      shown.map((p) => p.id),
      player
        ? {
            name: `${player.firstName} ${player.lastName}`,
            position: player.position,
            teamDisplayName: player.teamDisplayName,
            portraitAssetName: player.portraitAssetName,
          }
        : undefined,
      player?.teamIndex,
    );
  }

  function refresh() {
    if (!id) return;
    window.api.db.getAllLeaguePlayers(id, seasonId).then(setPlayers);
  }

  function editPlayer(player: NationalPlayer) {
    if (!id) return;
    openPlayerEditor({
      dynastyId: id,
      playerId: player.id,
      playerLabel: `${player.firstName} ${player.lastName}`,
      onSaved: refresh,
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

  if (players === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading players...</p>;
  }

  if (players === null) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">
          No league-wide player data for this season. This is captured on sync from a full save — older History-Only
          seasons won&apos;t have it.
        </p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const selectClass =
    'rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Players"
        title="Every player in the nation, in one place."
        description="The national counterpart to your team roster — search, filter by conference, team, position, or class, and open any player for their full profile."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Players" value={String(players.length)} />
        <StatTile label="Filtered" value={String(sorted.length)} />
        <StatTile label="Average OVR" value={averageOverall} />
        <StatTile label="Teams" value={String(teamCount)} />
      </div>

      <SurfaceCard>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            />
            <select
              value={conferenceFilter}
              onChange={(event) => {
                setConferenceFilter(event.target.value);
                setTeamFilter('');
              }}
              className={selectClass}
            >
              <option value="">All conferences</option>
              {conferences.map((conf) => (
                <option key={conf} value={conf}>
                  {conf}
                </option>
              ))}
            </select>
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className={selectClass}>
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value as Unit | '')} className={selectClass}>
              <option value="">All units</option>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className={selectClass}>
              <option value="">All positions</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className={selectClass}>
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

        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Showing {shown.length} of {sorted.length}
          {sorted.length > RENDER_CAP && ' — narrow with filters or search to see more'}
        </div>
      </SurfaceCard>

      {view === 'gallery' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {shown.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              onOpen={() => openPlayer(player.id)}
              onEdit={
                canEdit
                  ? (event) => {
                      event.stopPropagation();
                      editPlayer(player);
                    }
                  : undefined
              }
            />
          ))}
          {shown.length === 0 && (
            <SurfaceCard className="col-span-full text-center text-sm text-slate-400 dark:text-slate-500">
              No players match these filters.
            </SurfaceCard>
          )}
        </div>
      ) : (
        <SurfaceCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                <tr>
                  <th className="px-3 py-3" aria-hidden="true" />
                  <SortableHeader label="No." sortKey="jersey" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Name" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Team" sortKey="team" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Pos." sortKey="position" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Ht." sortKey="height" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Wt." sortKey="weight" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Yr." sortKey="class" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="OVR" sortKey="overall" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {shown.map((player) => (
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
                      {canEdit && (
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
                      <span className="flex items-center gap-1.5">
                        {player.firstName} {player.lastName}
                        {player.isCaptain && <CaptainBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <span className="flex items-center gap-2">
                        <TeamLogo team={{ assetName: player.teamDisplayName, label: player.teamDisplayName }} size="sm" className="!h-5 !w-5 shrink-0" />
                        <span className="truncate">{player.teamDisplayName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{player.position}</td>
                    <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{formatHeight(player.heightInches)}</td>
                    <td className="proportional-nums px-4 py-3 text-slate-500 dark:text-slate-400">{player.weightPounds}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{abbreviateClass(player.schoolYear)}</td>
                    <td className="proportional-nums px-4 py-3 font-semibold text-slate-900 dark:text-white">{player.overallRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No players match these filters.</p>
          )}
        </SurfaceCard>
      )}
    </div>
  );
}
