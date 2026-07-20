import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { TeamLogo } from '../components/common/TeamLogo';
import { EditButton } from '../components/common/CoachCard';
import { useEditorModal } from '../data/EditorModalProvider';
import { useRecruitModal } from '../data/RecruitModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { useTheme } from '../theme/ThemeProvider';
import { RecruitingPipeline } from '../components/charts/RecruitingPipeline';
import type { RecruitBoardEntry, RecruitBoardStage, RecruitingOverview, TeamNeedsSummary } from '../../shared/types';

const STAGE_META: Record<RecruitBoardStage, { label: string; badgeClass: string }> = {
  signed: { label: 'Signed', badgeClass: 'border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
  committed: { label: 'Committed', badgeClass: 'border-sky-300/70 bg-sky-100/80 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300' },
  offered: { label: 'Offered', badgeClass: 'border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  watching: { label: 'Watching', badgeClass: 'border-slate-300/80 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300' },
  lost: { label: 'Lost', badgeClass: 'border-red-300/70 bg-red-100/80 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' },
};
const STAGE_FILTER_OPTIONS: RecruitBoardStage[] = ['watching', 'offered', 'committed', 'signed', 'lost'];

function StageBadge({ stage }: { stage: RecruitBoardStage }) {
  const meta = STAGE_META[stage];
  return <span className={`inline-block border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}>{meta.label}</span>;
}

type RecruitSortKey =
  | 'position'
  | 'name'
  | 'stars'
  | 'overall'
  | 'nationalRank'
  | 'positionRank'
  | 'city'
  | 'state'
  | 'classYear'
  | 'style';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: RecruitSortKey; label: string }[] = [
  { key: 'position', label: 'Pos' },
  { key: 'name', label: 'Player' },
  { key: 'stars', label: 'Stars' },
  { key: 'overall', label: 'OVR' },
  { key: 'nationalRank', label: 'Nat #' },
  { key: 'positionRank', label: 'Pos #' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'classYear', label: 'Class' },
  { key: 'style', label: 'Style' },
];

const DEFAULT_SORT_DIR: Record<RecruitSortKey, SortDir> = {
  position: 'asc',
  name: 'asc',
  stars: 'desc',
  overall: 'desc',
  nationalRank: 'asc',
  positionRank: 'asc',
  city: 'asc',
  state: 'asc',
  classYear: 'asc',
  style: 'asc',
};

/** 0 means unranked (this app's convention) — sorts last regardless of direction, since "unranked" isn't meaningfully "worse" in a numeric sense, it's just absent. */
function rankSortValue(rank: number): number {
  return rank > 0 ? rank : Number.POSITIVE_INFINITY;
}

function sortRecruits(recruits: RecruitBoardEntry[], key: RecruitSortKey, dir: SortDir): RecruitBoardEntry[] {
  const sorted = [...recruits].sort((a, b) => {
    switch (key) {
      case 'position':
        return a.position.localeCompare(b.position);
      case 'name':
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      case 'stars':
        return a.stars - b.stars;
      case 'overall':
        return a.overallRating - b.overallRating;
      case 'nationalRank':
        return rankSortValue(a.nationalRank) - rankSortValue(b.nationalRank);
      case 'positionRank':
        return rankSortValue(a.positionRank) - rankSortValue(b.positionRank);
      case 'city':
        return a.hometown.localeCompare(b.hometown);
      case 'state':
        return a.homeState.localeCompare(b.homeState);
      case 'classYear':
        return a.classYear.localeCompare(b.classYear);
      case 'style':
        return a.archetype.localeCompare(b.archetype);
    }
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

function formatClassYear(raw: string): string {
  if (raw === 'HighSchool') return 'HS';
  if (raw.startsWith('JuniorCollege_')) return `JUCO ${raw.replace('JuniorCollege_', '')}`;
  return raw;
}

function Stars({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Unrated</span>;
  }
  return (
    <span className="text-amber-500 dark:text-amber-400" aria-label={`${count} star recruit`}>
      {'★'.repeat(count)}
      <span className="text-slate-300 dark:text-slate-700">{'★'.repeat(5 - count)}</span>
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  label: string;
  sortKey: RecruitSortKey;
  activeKey: RecruitSortKey;
  activeDir: SortDir;
  onSort: (key: RecruitSortKey) => void;
}) {
  const isActive = sortKey === activeKey;
  return (
    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">
      <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1.5 hover:underline">
        <span>{label}</span>
        <span className="w-6 text-[10px] text-white/80">{isActive ? (activeDir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}

function RecruitTable({
  recruits,
  onEdit,
  onView,
}: {
  recruits: RecruitBoardEntry[];
  /** Undefined (not just disabled) when editing isn't allowed for this season — the edit column is omitted entirely rather than shown disabled. */
  onEdit?: (recruit: RecruitBoardEntry) => void;
  onView: (recruit: RecruitBoardEntry) => void;
}) {
  const [sortKey, setSortKey] = useState<RecruitSortKey>('nationalRank');
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT_DIR.nationalRank);

  function handleSort(key: RecruitSortKey) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR[key]);
    }
  }

  const sorted = sortRecruits(recruits, sortKey, sortDir);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[var(--team-primary)] text-[var(--team-on-primary)]">
          <tr>
            {onEdit && <th className="px-3 py-3" aria-hidden="true" />}
            {COLUMNS.map((col) => (
              <SortableHeader
                key={col.key}
                label={col.label}
                sortKey={col.key}
                activeKey={sortKey}
                activeDir={sortDir}
                onSort={handleSort}
              />
            ))}
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Stage</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Signed With</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.playerId}
              onClick={() => onView(r)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onView(r);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View ${r.firstName} ${r.lastName}'s recruit profile`}
              className="cursor-pointer border-b border-white/60 bg-slate-50/80 transition last:border-b-0 hover:bg-slate-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
            >
              {onEdit && (
                <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                  <EditButton onClick={() => onEdit(r)} label={`Edit ${r.firstName} ${r.lastName}`} />
                </td>
              )}
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.position}</td>
              <td className="px-3 py-2.5">
                <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                  {r.firstName} {r.lastName}
                  {r.isFavorite && (
                    <span className="text-amber-500 dark:text-amber-400" title="Favorite" aria-label="Favorite">
                      &#9733;
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <Stars count={r.stars} />
              </td>
              <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{r.overallRating}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.nationalRank || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.positionRank || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.hometown}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.homeState}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{formatClassYear(r.classYear)}</td>
              <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.archetype}</td>
              <td className="px-3 py-2.5">
                <StageBadge stage={r.stage} />
              </td>
              <td className="px-3 py-2.5">
                {r.signedTeamDisplayName ? (
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      team={{ assetName: r.signedTeamDisplayName, label: r.signedTeamDisplayName }}
                      size="sm"
                      variant={r.stage === 'signed' ? 'gold' : undefined}
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{r.signedTeamDisplayName}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FILTER_SELECT_CLASS =
  'border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-800 dark:bg-white/5 dark:text-slate-100';

/** Distinct, sorted option list for a filter dropdown, built from whatever's actually on the board — never a hardcoded list that could drift from real data. */
function distinctSorted<T>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * The full board, one table, filterable by every dimension the save gives a
 * recruit: pipeline stage, stars, position, home state, style (archetype),
 * and class year — plus a name/hometown search. Defaults to showing every
 * recruit (stage "All"), which is the literal answer to "view ALL recruits."
 */
function AllRecruitsBoard({
  board,
  onEdit,
  onView,
}: {
  board: RecruitBoardEntry[];
  onEdit?: (recruit: RecruitBoardEntry) => void;
  onView: (recruit: RecruitBoardEntry) => void;
}) {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<RecruitBoardStage | ''>('');
  const [stars, setStars] = useState('');
  const [position, setPosition] = useState('');
  const [state, setState] = useState('');
  const [style, setStyle] = useState('');
  const [classYear, setClassYear] = useState('');

  const options = useMemo(
    () => ({
      positions: distinctSorted(board.map((r) => r.position)),
      states: distinctSorted(board.map((r) => r.homeState).filter(Boolean)),
      styles: distinctSorted(board.map((r) => r.archetype).filter(Boolean)),
      classYears: distinctSorted(board.map((r) => r.classYear)),
    }),
    [board],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return board.filter((r) => {
      if (stage && r.stage !== stage) return false;
      if (stars && r.stars !== Number(stars)) return false;
      if (position && r.position !== position) return false;
      if (state && r.homeState !== state) return false;
      if (style && r.archetype !== style) return false;
      if (classYear && r.classYear !== classYear) return false;
      if (q && !`${r.firstName} ${r.lastName} ${r.hometown}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [board, search, stage, stars, position, state, style, classYear]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Full Board <span className="text-sm font-normal text-slate-400 dark:text-slate-500">({filtered.length} of {board.length})</span>
        </h3>
      </div>
      <SurfaceCard className="mt-3 p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 p-4 dark:border-white/5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or hometown..."
            aria-label="Search recruits"
            className={`${FILTER_SELECT_CLASS} min-w-[11rem] flex-1`}
          />
          <select value={stage} onChange={(e) => setStage(e.target.value as RecruitBoardStage | '')} aria-label="Filter by pipeline stage" className={FILTER_SELECT_CLASS}>
            <option value="">All stages</option>
            {STAGE_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STAGE_META[s].label}
              </option>
            ))}
          </select>
          <select value={stars} onChange={(e) => setStars(e.target.value)} aria-label="Filter by stars" className={FILTER_SELECT_CLASS}>
            <option value="">All stars</option>
            {[5, 4, 3, 2, 1, 0].map((s) => (
              <option key={s} value={s}>
                {s === 0 ? 'Unrated' : `${s} star${s === 1 ? '' : 's'}`}
              </option>
            ))}
          </select>
          <select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Filter by position" className={FILTER_SELECT_CLASS}>
            <option value="">All positions</option>
            {options.positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by home state" className={FILTER_SELECT_CLASS}>
            <option value="">All states</option>
            {options.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Filter by style" className={FILTER_SELECT_CLASS}>
            <option value="">All styles</option>
            {options.styles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={classYear} onChange={(e) => setClassYear(e.target.value)} aria-label="Filter by class" className={FILTER_SELECT_CLASS}>
            <option value="">All classes</option>
            {options.classYears.map((c) => (
              <option key={c} value={c}>
                {formatClassYear(c)}
              </option>
            ))}
          </select>
          {(search || stage || stars || position || state || style || classYear) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStage('');
                setStars('');
                setPosition('');
                setState('');
                setStyle('');
                setClassYear('');
              }}
              className="border border-slate-300/80 bg-white/85 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No recruits match these filters.</p>
        ) : (
          <RecruitTable recruits={filtered} onEdit={onEdit} onView={onView} />
        )}
      </SurfaceCard>
    </div>
  );
}

const NEED_THRESHOLD = 5;

/**
 * Team Needs — the game's own computed position-group grades (0-99), the
 * same numbers behind the in-game Team Ratings screen; no separate "need"
 * field exists on the save, but a group graded well below the team's own
 * overall IS the game's own signal for a thin spot on the roster. Sorted
 * weakest-first; a NEED badge (text + icon, never color alone) flags any
 * group more than 5 points under the team overall.
 */
function TeamNeedsPanel({ needs }: { needs: TeamNeedsSummary }) {
  const { appearance } = useTheme();
  const isDark = appearance === 'dark';
  const barColor = isDark ? '#5b9bf5' : '#2159d0';
  const track = isDark ? '#1b2434' : '#eef2f7';

  return (
    <SurfaceCard>
      <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Team Needs</h3>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        The program&apos;s own position-group grades — the same numbers behind the in-game Team Ratings screen. A group
        more than {NEED_THRESHOLD} points below the team&apos;s overall is flagged as a need.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="Offense" value={String(needs.offenseRating)} />
        <StatTile label="Defense" value={String(needs.defenseRating)} />
        <StatTile label="Overall" value={String(needs.overallRating)} />
      </div>

      <div className="mt-4 space-y-2">
        {needs.positions.map((p) => {
          const isNeed = needs.overallRating - p.rating >= NEED_THRESHOLD;
          return (
            <div key={p.position} className="flex items-center gap-3">
              <span className="w-9 shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">{p.position}</span>
              <div className="relative h-4 flex-1" style={{ background: track }}>
                <div
                  className="absolute inset-y-0 left-0"
                  style={{ width: `${(p.rating / 99) * 100}%`, background: barColor, borderRadius: '0 3px 3px 0' }}
                />
              </div>
              <span className="tnum w-6 shrink-0 text-right text-xs font-semibold text-slate-900 dark:text-white">{p.rating}</span>
              <span className="w-14 shrink-0">
                {isNeed && (
                  <span className="inline-flex items-center gap-1 border border-red-300/70 bg-red-100/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    ⚠ Need
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

export function Recruiting() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [recruiting, setRecruiting] = useState<RecruitingOverview | null | undefined>(undefined);
  const { openPlayerEditor } = useEditorModal();
  const { openRecruitModal } = useRecruitModal();

  // Editing is only ever allowed while looking at the live, current season —
  // a historical season's recruiting board is a frozen snapshot, matching
  // the same isCurrent gate PlayerProfileContent.tsx uses for player edits.
  const canEdit = seasons.find((s) => s.id === seasonId)?.isCurrent === true;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRecruiting(undefined);
    window.api.db.getRecruits(id, seasonId).then((result) => {
      if (!cancelled) setRecruiting(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  function refreshRecruiting() {
    if (!id) return;
    window.api.db.getRecruits(id, seasonId).then(setRecruiting);
  }

  function editRecruit(recruit: RecruitBoardEntry) {
    if (!id) return;
    openPlayerEditor({
      dynastyId: id,
      playerId: recruit.playerId,
      playerLabel: `${recruit.firstName} ${recruit.lastName}`,
      onSaved: refreshRecruiting,
      isRecruit: true,
    });
  }

  if (recruiting === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading recruiting board...</p>;
  }

  if (recruiting === null || !id) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Recruiting board not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { classSummary } = recruiting;
  const boardByPlayerId = new Map(recruiting.board.map((r) => [r.playerId, r]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Recruiting
          </p>
          <h2 className="mt-1 font-display text-section-title font-semibold text-slate-950 dark:text-white">
            {recruiting.teamName}&apos;s recruiting board and incoming class.
          </h2>
        </div>
      </div>

      {recruiting.board.length === 0 ? (
        <SurfaceCard className="text-center text-sm text-slate-400 dark:text-slate-500">
          No recruits on the board for this season.
        </SurfaceCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Signed" value={String(classSummary.signedCount)} />
            <StatTile label="Committed" value={String(classSummary.committedCount)} />
            <StatTile label="Avg. Stars" value={classSummary.averageStars !== null ? classSummary.averageStars.toFixed(1) : '—'} />
            <StatTile
              label="National Class Rank"
              value={classSummary.nationalClassRank !== null ? `#${classSummary.nationalClassRank}` : 'NR'}
            />
            <StatTile
              label="Conference Class Rank"
              value={classSummary.conferenceClassRank !== null ? `#${classSummary.conferenceClassRank}` : 'NR'}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <SurfaceCard>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Recruiting Pipeline</h3>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Where the incoming class comes from and what it&apos;s made of — home state, star rating, and position,
                straight from the board.
              </p>
              <div className="mt-4">
                <RecruitingPipeline board={recruiting.board} />
              </div>
            </SurfaceCard>

            {recruiting.teamNeeds && <TeamNeedsPanel needs={recruiting.teamNeeds} />}
          </div>

          {recruiting.timeline.length > 0 && (
            <SurfaceCard>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Commitment Timeline</h3>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Chronological by the week each prospect committed. Decommits aren&apos;t trackable from a single save
                snapshot, so this only shows forward progress.
              </p>
              <div className="mt-3 divide-y divide-slate-100/80 dark:divide-white/5">
                {recruiting.timeline.map((t) => {
                  const boardEntry = boardByPlayerId.get(t.playerId);
                  return (
                    <button
                      key={t.playerId}
                      type="button"
                      disabled={!boardEntry}
                      onClick={() => boardEntry && id && openRecruitModal(id, boardEntry, canEdit)}
                      className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition enabled:hover:bg-slate-50/80 enabled:cursor-pointer disabled:cursor-default dark:enabled:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          Week {t.week}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">{t.playerName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t.position}</span>
                      </div>
                      <Stars count={t.stars} />
                    </button>
                  );
                })}
              </div>
            </SurfaceCard>
          )}

          <AllRecruitsBoard
            board={recruiting.board}
            onEdit={canEdit ? editRecruit : undefined}
            onView={(r) => openRecruitModal(id, r, canEdit)}
          />
        </>
      )}

    </div>
  );
}
