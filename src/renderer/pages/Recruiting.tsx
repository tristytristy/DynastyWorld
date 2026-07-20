import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { TeamLogo } from '../components/common/TeamLogo';
import { EditButton } from '../components/common/CoachCard';
import { useEditorModal } from '../data/EditorModalProvider';
import { useRecruitModal } from '../data/RecruitModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { RecruitingPipeline } from '../components/charts/RecruitingPipeline';
import type { RecruitBoardEntry, RecruitBoardStage, RecruitingOverview } from '../../shared/types';

const STAGE_ORDER: { stage: RecruitBoardStage; label: string; hint: string; showLogo: boolean }[] = [
  { stage: 'signed', label: 'Signed', hint: 'Locked in for this class.', showLogo: true },
  { stage: 'committed', label: 'Committed', hint: 'Committed, not yet signing-day official.', showLogo: false },
  { stage: 'offered', label: 'Offered', hint: 'This team has offered a scholarship.', showLogo: false },
  { stage: 'watching', label: 'Watching', hint: 'On the board, no offer yet.', showLogo: false },
  { stage: 'lost', label: 'Lost', hint: 'Signed with another school.', showLogo: true },
];

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
  showLogo,
  logoVariant,
  onEdit,
  onView,
}: {
  recruits: RecruitBoardEntry[];
  showLogo: boolean;
  logoVariant?: 'gold';
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
      <table className="w-full min-w-[820px] text-sm">
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
            {showLogo && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em]">Signed With</th>}
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
              {showLogo && (
                <td className="px-3 py-2.5">
                  {r.signedTeamDisplayName ? (
                    <div className="flex items-center gap-2">
                      <TeamLogo
                        team={{ assetName: r.signedTeamDisplayName, label: r.signedTeamDisplayName }}
                        size="sm"
                        variant={logoVariant}
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{r.signedTeamDisplayName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardSection({
  label,
  hint,
  recruits,
  showLogo,
  logoVariant,
  onEdit,
  onView,
}: {
  label: string;
  hint: string;
  recruits: RecruitBoardEntry[];
  showLogo: boolean;
  logoVariant?: 'gold';
  onEdit?: (recruit: RecruitBoardEntry) => void;
  onView: (recruit: RecruitBoardEntry) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          {label} <span className="text-sm font-normal text-slate-400 dark:text-slate-500">({recruits.length})</span>
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      </div>
      <SurfaceCard className="mt-3 p-0">
        {recruits.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No recruits currently in this stage.
          </p>
        ) : (
          <RecruitTable recruits={recruits} showLogo={showLogo} logoVariant={logoVariant} onEdit={onEdit} onView={onView} />
        )}
      </SurfaceCard>
    </div>
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

          <div className="space-y-6">
            {STAGE_ORDER.map(({ stage, label, hint, showLogo }) => (
              <BoardSection
                key={stage}
                label={label}
                hint={hint}
                showLogo={showLogo}
                logoVariant={stage === 'signed' ? 'gold' : undefined}
                recruits={recruiting.board.filter((r) => r.stage === stage)}
                onEdit={canEdit ? editRecruit : undefined}
                onView={(r) => openRecruitModal(id, r, canEdit)}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}
