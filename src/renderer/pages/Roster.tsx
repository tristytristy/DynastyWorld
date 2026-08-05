import type { HTMLAttributes, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { TeamLogo } from '../components/common/TeamLogo';
import { Button } from '../components/ui/Button';
import { EditButton } from '../components/common/CoachCard';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { Select } from '../components/ui/Select';
import { PageMasthead } from '../components/common/PageMasthead';
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
  isRedshirt,
  positionSortIndex,
  unitForPosition,
  type Unit,
} from '../lib/rosterOrder';
import { SELECTION_ACTIVE, SELECTION_BASE } from '../lib/selectionClass';
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

/*
  The class chips take the app's selection contract for their ON state
  (`SELECTION_ACTIVE`: team edge and wash in light, gold edge on off-black in
  dark) — this is the non-navigation selected look, which is exactly what a
  filter chip is; the glider belongs to nav.

  The OFF state does NOT use `SELECTION_IDLE`, and the difference is deliberate.
  That idle is written for table ROWS, where the row is visible on its own and
  the border only appears to mark selection — so it is transparent. A chip has
  no content around it to give it a shape, and a borderless one doesn't read as
  something you can press. So it keeps the visible hairline the breakdown always
  had, and selection changes its colour rather than conjuring it.
*/
const CHIP_IDLE = [
  'border-slate-200/80 text-slate-500 hover:border-slate-300 hover:text-slate-900',
  'dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-white',
].join(' ');

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
                {player.position} | {abbreviateClass(player.schoolYear, player.redshirtStatus)}
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
  // Classes are picked on the breakdown chips rather than in a dropdown, and
  // more than one can be on at once — "the freshmen AND the RS freshmen" is a
  // real question about a recruiting class, and a single-select can't ask it.
  const [classFilters, setClassFilters] = useState<string[]>([]);
  /*
    REDSHIRT IS ITS OWN AXIS NOW, not eight class chips.

    The chips used to be Freshman / RS Freshman / Sophomore / RS Sophomore and so
    on — eight buttons expressing two independent facts, which meant "show me the
    seniors" was two clicks and "show me every redshirt" was four. Splitting them
    gives four class chips and one redshirt toggle that INTERSECTS: Senior alone
    is every senior including redshirts, Senior + RS is only redshirt seniors.
  */
  const [redshirtOnly, setRedshirtOnly] = useState(false);
  const [unitFilter, setUnitFilter] = useState<Unit | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<ViewMode>('list');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ text: string; ok: boolean } | null>(null);

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
      // No chips lit means no class filter at all — the chips are a union, so
      // an empty selection is "everyone", not "nobody".
      if (
        classFilters.length > 0 &&
        // The player's own year, NOT the RS-prefixed label — that is what makes
        // "Senior" include redshirt seniors instead of excluding them.
        !classFilters.includes(player.schoolYear)
      ) {
        return false;
      }
      // Intersects the classes rather than replacing them: Senior alone is every
      // senior, Senior + RS is only the redshirt ones.
      if (redshirtOnly && !isRedshirt(player.redshirtStatus)) return false;
      if (unitFilter && unitForPosition(player.position) !== unitFilter) return false;
      if (query && !`${player.firstName} ${player.lastName}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [roster, search, positionFilter, classFilters, redshirtOnly, unitFilter]);

  const sorted = useMemo(() => sortPlayers(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);

  // Measured off the result, not off the controls: a filter that happens to
  // match everyone isn't narrowing anything, and the tiles shouldn't say it is.
  const isFiltered = filtered.length !== (roster?.length ?? 0);

  /*
    Exports whatever this page is showing: the viewed team (or the user's own
    when the switcher is untouched) at the selected season. The main process
    merges the archived profiles with ratings read live from the save and picks
    the file location, so there is nothing to assemble here.
  */
  async function exportRoster() {
    if (!id || exporting) return;
    setExporting(true);
    try {
      const result = await window.api.export.rosterToFile(id, viewedTeamIndex, seasonId);
      // A cancelled save dialog is not a failure worth shouting about.
      if (result.message && result.message !== 'Export canceled.') {
        setExportMessage({ text: result.message, ok: result.success });
      }
    } finally {
      setExporting(false);
    }
  }

  const classBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of roster ?? []) {
      counts.set(player.schoolYear, (counts.get(player.schoolYear) ?? 0) + 1);
    }
    // Base years only — CLASS_ORDER rather than classFilterOptions, which
    // interleaves the RS variants this no longer wants.
    return CLASS_ORDER.map((cls) => ({ cls, count: counts.get(cls) ?? 0 })).filter((item) => item.count > 0);
  }, [roster]);

  /*
    Team, offense and defense overall — averaged over WHAT IS ON SCREEN, not
    over the whole roster.

    Unfiltered that is the whole team, which is the headline these tiles are
    for. Filtered, they answer the question the filter just asked: click the
    freshman chip and the row reports how good that class is, pick Defense and
    the defensive number is the only one with players behind it. The alternative
    — three constants that never move — costs the same space and says the same
    thing all day.

    Note this is the roster's average, not the game's own team rating, which is
    built from the depth chart. The save doesn't store one, and the depth chart
    isn't archived, so there is nothing more faithful available; the player
    count under each value is there so the number is read for what it is.

    Special teams belong to neither unit, so offense + defense is deliberately
    short of the team count rather than a third bucket nobody asked for.
  */
  const ratings = useMemo(() => {
    const average = (list: RosterPlayer[]) =>
      list.length === 0 ? '—' : (list.reduce((sum, p) => sum + p.overallRating, 0) / list.length).toFixed(1);
    const offense = filtered.filter((p) => unitForPosition(p.position) === 'Offense');
    const defense = filtered.filter((p) => unitForPosition(p.position) === 'Defense');
    return {
      team: average(filtered),
      offense: average(offense),
      defense: average(defense),
      teamCount: filtered.length,
      offenseCount: offense.length,
      defenseCount: defense.length,
    };
  }, [filtered]);

  /** "38 players", or "21 of 85 players" once a filter is narrowing the page. */
  function playerCountHint(count: number): string {
    const label = count === 1 ? 'player' : 'players';
    return isFiltered ? `${count} of ${roster?.length ?? 0} ${label}` : `${count} ${label}`;
  }

  // NIL follows the same rule as the ratings: the spend on the players shown.
  const nilTotal = useMemo(
    () => filtered.reduce((sum, player) => sum + (player.nilCompensation ?? 0), 0),
    [filtered],
  );
  const nilDeals = useMemo(() => filtered.filter((p) => (p.nilCompensation ?? 0) > 0).length, [filtered]);

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

  function toggleClass(cls: string) {
    setClassFilters((prev) => (prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]));
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
      <PageMasthead
        eyebrow="Roster"
        title={hoverTeamName ?? 'Roster'}
        description="Search, compare, and review every player in one pass."
        mark={{ kind: 'logo', teamAssetName: hoverTeamName ?? '' }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Team" value={ratings.team} hint={playerCountHint(ratings.teamCount)} />
        <StatTile label="Offense" value={ratings.offense} hint={playerCountHint(ratings.offenseCount)} />
        <StatTile label="Defense" value={ratings.defense} hint={playerCountHint(ratings.defenseCount)} />
        <StatTile
          label="NIL"
          value={formatNil(nilTotal)}
          hint={nilDeals === 1 ? '1 with a deal' : `${nilDeals} with a deal`}
        />
      </div>

      <SurfaceCard>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          {/* Three controls, not four — class moved onto the chips below, where
              the counts already were. */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-lg border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-100"
            />
            <Select
              value={unitFilter}
              onChange={setUnitFilter}
              ariaLabel="Unit"
              className="w-full"
              options={[{ value: '' as Unit | '', label: 'All units' }, ...UNITS.map((unit) => ({ value: unit as Unit | '', label: unit }))]}
            />
            <Select
              value={positionFilter}
              onChange={setPositionFilter}
              ariaLabel="Position"
              className="w-full"
              options={[{ value: '', label: 'All positions' }, ...positions.map((position) => ({ value: position, label: position }))]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Select
              value={sortKey}
              onChange={handleSort}
              ariaLabel="Sort by"
              options={SORT_OPTIONS.map((option) => ({ value: option.key, label: `Sort by ${option.label}` }))}
            />
            {/* No Ascending/Descending button (user direction): clicking a column
                heading already flips the direction, and a second control for the
                same thing is one more thing to look at. `sortDir` is unchanged —
                only its redundant button is gone. */}
            {/* The app's two-state switch with the team's gold mark, same as
                Roster|Transfers above it and Team|Player on Statistics — this
                was the last bespoke pair of pills left on the page. */}
            <ToggleSwitch<ViewMode>
              value={view}
              onChange={setView}
              left={{ value: 'list', label: 'LIST' }}
              right={{ value: 'gallery', label: 'GALLERY' }}
              ariaLabel="List or gallery view"
              knob={
                hoverTeamName ? (
                  <TeamLogo
                    team={{ assetName: hoverTeamName, label: hoverTeamName }}
                    size="sm"
                    variant="gold"
                    className="h-[35px] w-[35px]"
                  />
                ) : undefined
              }
            />
          </div>
        </div>

        {/* Export sits at the end of the class-breakdown row: it exports what
            this page IS — the team currently in view, at the season currently
            selected — and that row is the page's summary of exactly that. */}
        {/*
          The class breakdown IS the class filter. It was already the honest
          picture of the roster's year distribution sitting one row under a
          dropdown listing the same eight values, so the counts became the
          control and the dropdown went — one owner per field.

          Multi-select, because these read as a set: freshmen and RS freshmen
          together are a recruiting class, seniors and RS seniors together are
          who's leaving. Clear only appears once something is on, and only ever
          clears the classes — it sits in this row, so that is what it means.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {classBreakdown.map(({ cls, count }) => {
            const on = classFilters.includes(cls);
            return (
              <button
                key={cls}
                type="button"
                aria-pressed={on}
                onClick={() => toggleClass(cls)}
                className={`${SELECTION_BASE} px-3 py-1 ${on ? SELECTION_ACTIVE : CHIP_IDLE}`}
              >
                {count} {cls}
              </button>
            );
          })}
          {/* THE SAME CHIP SHAPE as the classes, carrying the mark instead of a
              word — it is one more thing you can switch on in this row, and
              making it a different kind of control would hide that it COMBINES
              with them rather than replacing them. */}
          <button
            type="button"
            aria-pressed={redshirtOnly}
            title="Redshirts only"
            onClick={() => setRedshirtOnly((prev) => !prev)}
            className={`${SELECTION_BASE} inline-flex items-center gap-1.5 px-3 py-1 ${redshirtOnly ? SELECTION_ACTIVE : CHIP_IDLE}`}
          >
            <img src="assets/UI/redshirt.webp" alt="" draggable={false} className="h-4 w-4 max-w-none" />
            RS
          </button>
          {(classFilters.length > 0 || redshirtOnly) && (
            <button
              type="button"
              onClick={() => {
                setClassFilters([]);
                setRedshirtOnly(false);
              }}
              className={`${SELECTION_BASE} px-3 py-1 font-semibold uppercase tracking-[0.14em] ${CHIP_IDLE}`}
            >
              Clear
            </button>
          )}
          <div className="ml-auto">
            {/* Not "Export CSV": the dialog offers both formats, and naming one
                of them on the button makes the other look like it isn't there. */}
            <Button
              variant="secondary"
              compact
              onClick={exportRoster}
              disabled={exporting || !roster?.length}
              title="Export this roster as CSV (spreadsheets) or XML"
            >
              {exporting ? 'Exporting…' : 'Export Roster'}
            </Button>
          </div>
        </div>
        {exportMessage && (
          <p
            className={`mt-2 text-right text-xs ${exportMessage.ok ? 'text-slate-500 dark:text-slate-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {exportMessage.text}
          </p>
        )}
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
                  <th className="px-2 py-2 text-left font-medium">RS</th>
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
                    {/* Its own column, so the mark lines up down the page instead
                        of sitting at a different x on every row behind a class of
                        a different width. */}
                    <td className="px-2 py-3">
                      {isRedshirt(player.redshirtStatus) && (
                        <img
                          src="assets/UI/redshirt.webp"
                          alt="Redshirt"
                          title="Redshirt"
                          draggable={false}
                          className="h-4 w-4 max-w-none"
                        />
                      )}
                    </td>
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

