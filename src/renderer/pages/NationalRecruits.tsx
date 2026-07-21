import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { TeamLogo } from '../components/common/TeamLogo';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';
import { useEditorModal } from '../data/EditorModalProvider';
import { useRecruitingExperience } from '../data/RecruitingExperienceProvider';
import { useViewedTeamOptional } from '../data/ViewedTeamProvider';
import { formatClassYearShort } from '../lib/recruitFormat';
import type { ForceCommitResult, NationalRecruit } from '../../shared/types';

/** Colored stage badge — each decision-funnel stage gets one accent, never color-alone (the label is always present). */
const STAGE_STYLE: Record<string, { label: string; cls: string }> = {
  Signed: { label: 'Signed', cls: 'border-emerald-300/70 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
  SoftCommitted: { label: 'Committed', cls: 'border-sky-300/70 bg-sky-100/80 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300' },
  Top3: { label: 'Top 3', cls: 'border-violet-300/70 bg-violet-100/80 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300' },
  Top5: { label: 'Top 5', cls: 'border-amber-300/70 bg-amber-100/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  Top10: { label: 'Top 10', cls: 'border-slate-300/80 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300' },
  Battle: { label: 'Battle', cls: 'border-red-300/70 bg-red-100/80 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' },
};

function StageBadge({ stage }: { stage: string }) {
  const meta = STAGE_STYLE[stage] ?? { label: stage, cls: STAGE_STYLE.Top10.cls };
  return <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}>{meta.label}</span>;
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500 dark:text-amber-400" title={`${n} star`}>{'★'.repeat(n)}<span className="text-slate-300 dark:text-slate-600">{'★'.repeat(Math.max(0, 5 - n))}</span></span>;
}

function formatHeight(inches: number): string {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function formatNil(k: number): string {
  if (!k) return '—';
  return k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${k}K`;
}

const FILTER_SELECT =
  'border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-200';

const RENDER_CAP = 200;

function distinct(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

type SortKey = 'nationalRank' | 'positionRank' | 'stateRank' | 'stars' | 'overallRating' | 'commitScore' | 'baseNilValue' | 'lastName';

/** Small influence/rating bar with a value label. */
function StatBar({ label, value, max = 99, accent }: { label: React.ReactNode; value: number; max?: number; accent: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-28 shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">{label}</span>
      <div className="relative h-2.5 flex-1 bg-slate-100 dark:bg-white/5">
        <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: accent }} />
      </div>
      <span className="tnum w-7 shrink-0 text-right text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="1" />
      {locked
        ? <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        : <path d="M8 11V7a4 4 0 0 1 7.4-2" />}
    </svg>
  );
}

/** A compact lock/reveal pill — the shared control for the OVR and athletic reveals. */
function LockPill({ unlocked, onClick, revealLabel = 'Reveal' }: { unlocked: boolean; onClick: () => void; revealLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
        unlocked
          ? 'border-[var(--team-primary)]/50 bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)] text-[var(--team-accent-text)] dark:text-white'
          : 'border-slate-300/80 bg-slate-100/70 text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'
      }`}
      aria-label={unlocked ? 'Hide' : revealLabel}
    >
      <LockIcon locked={!unlocked} />
      {unlocked ? 'Hide' : revealLabel}
    </button>
  );
}

function RecruitPanel({
  recruit,
  canEdit,
  onEdit,
  onEditRecruiting,
  onOpenFull,
  ovrUnlocked,
  onOvrLockClick,
  athleticUnlocked,
  onAthleticLockClick,
  experimentalSaveEditing,
  onForceCommit,
}: {
  recruit: NationalRecruit | null;
  canEdit: boolean;
  onEdit: (r: NationalRecruit) => void;
  onEditRecruiting: (r: NationalRecruit) => void;
  onOpenFull: (r: NationalRecruit) => void;
  ovrUnlocked: boolean;
  onOvrLockClick: (r: NationalRecruit) => void;
  athleticUnlocked: boolean;
  onAthleticLockClick: (r: NationalRecruit) => void;
  experimentalSaveEditing: boolean;
  onForceCommit: (r: NationalRecruit) => void;
}) {
  if (!recruit) {
    return (
      <SurfaceCard className="text-sm text-slate-400 dark:text-slate-500">
        Select a recruit to see their full scouting profile, school interest, and athletic snapshot.
      </SurfaceCard>
    );
  }

  const athleticRows: { label: string; value: number }[] = [
    { label: 'Speed', value: recruit.athletic.speed },
    { label: 'Acceleration', value: recruit.athletic.acceleration },
    { label: 'Agility', value: recruit.athletic.agility },
    { label: 'Strength', value: recruit.athletic.strength },
    { label: 'Awareness', value: recruit.athletic.awareness },
    { label: 'Jumping', value: recruit.athletic.jumping },
  ];
  const sortedAthletic = [...athleticRows].sort((a, b) => b.value - a.value);
  const strengths = sortedAthletic.slice(0, 2);
  const weaknesses = sortedAthletic.slice(-2).reverse();

  return (
    <SurfaceCard className="space-y-5">
      {/* Hero */}
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onOpenFull(recruit)} className="shrink-0" title="Open full profile">
          <PlayerPortrait player={recruit} size="lg" className="!h-16 !w-16" />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenFull(recruit)} className="text-left">
            <h3 className="truncate text-lg font-bold tracking-tight text-slate-950 hover:underline dark:text-white">
              {recruit.firstName} {recruit.lastName}
            </h3>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="border border-slate-300/80 px-1.5 py-0.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">{recruit.position}</span>
            <Stars n={recruit.stars} />
            <StageBadge stage={recruit.recruitStage} />
            {recruit.gemBust === 'GEM' && <span className="border border-emerald-300/70 bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">Gem</span>}
            {recruit.onUserBoard && <span className="border border-[var(--team-primary)]/50 bg-[color:color-mix(in_srgb,var(--team-primary)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--team-accent-text)] dark:text-white">On board</span>}
          </div>
        </div>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="National" value={recruit.nationalRank > 0 ? `#${recruit.nationalRank}` : 'NR'} />
        <StatTile label={`${recruit.position} Rank`} value={recruit.positionRank > 0 ? `#${recruit.positionRank}` : 'NR'} />
        <StatTile label="State Rank" value={recruit.stateRank > 0 ? `#${recruit.stateRank}` : 'NR'} />
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Prospect</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row k="Class" v={recruit.classYear.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')} />
            <Row k="Archetype" v={recruit.archetype || '—'} />
            <Row k="Height" v={formatHeight(recruit.heightInches)} />
            <Row k="Weight" v={recruit.weightPounds ? `${recruit.weightPounds} lb` : '—'} />
            <Row k="Hometown" v={`${recruit.hometown}, ${recruit.homeState}`} />
            <Row k="Pipeline" v={recruit.pipeline || '—'} />
          </dl>
        </div>
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Recruiting</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row k="Dev Trait" v={recruit.developmentTrait || '—'} />
            <Row k="Dealbreaker" v={recruit.dealbreaker || '—'} />
            <Row k="Ideal Pitch" v={recruit.idealPitch || '—'} />
            <Row k="Offers" v={String(recruit.totalOffers)} />
            <Row k="NIL Value" v={formatNil(recruit.baseNilValue)} />
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-slate-400 dark:text-slate-500">Overall</dt>
              <dd>
                {ovrUnlocked ? (
                  <span className="font-semibold text-slate-900 dark:text-white">{recruit.overallRating}</span>
                ) : (
                  <LockPill unlocked={false} onClick={() => onOvrLockClick(recruit)} />
                )}
              </dd>
            </div>
          </dl>
          {ovrUnlocked && (
            <button type="button" onClick={() => onOvrLockClick(recruit)} className="mt-1.5 text-[11px] text-slate-400 underline-offset-2 hover:underline dark:text-slate-500">
              Hide overall
            </button>
          )}
        </div>
      </div>

      {/* Commit score */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Commit score</p>
          <span className="tnum text-xs font-semibold text-slate-900 dark:text-white">{recruit.commitScore}</span>
        </div>
        <div className="mt-2 h-2.5 bg-slate-100 dark:bg-white/5">
          <div className="h-full bg-[var(--team-primary)]" style={{ width: `${Math.min(100, (recruit.commitScore / 1000) * 100)}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">The game&apos;s own commitment metric — higher means closer to a decision.</p>
      </div>

      {/* School interest */}
      {recruit.topSchools.length > 0 && (
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">School interest</p>
          <div className="mt-2 space-y-1.5">
            {recruit.topSchools.slice(0, 8).map((s) => (
              <StatBar
                key={s.teamIndex}
                label={<span className="inline-flex items-center gap-1.5"><TeamLogo team={{ assetName: s.teamName, label: s.teamName }} size="sm" className="!h-4 !w-4" />{s.teamName}</span>}
                value={s.influence}
                accent="var(--team-primary)"
              />
            ))}
          </div>
        </div>
      )}

      {/* Athletic snapshot — locked by default; revealed only on a deliberate unlock. */}
      <div>
        <div className="flex items-center justify-between">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Athletic snapshot</p>
          <span aria-label={athleticUnlocked ? 'Lock athletic ratings' : 'Unlock athletic ratings'}>
            <LockPill unlocked={athleticUnlocked} onClick={() => onAthleticLockClick(recruit)} />
          </span>
        </div>
        {athleticUnlocked ? (
          <>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Strength: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{strengths.map((s) => s.label).join(', ')}</span></span>
              <span className="text-slate-500 dark:text-slate-400">Work on: <span className="font-semibold text-amber-700 dark:text-amber-300">{weaknesses.map((s) => s.label).join(', ')}</span></span>
            </div>
            <div className="mt-2 space-y-1.5">
              {athleticRows.map((r) => (
                <StatBar key={r.label} label={r.label} value={r.value} accent={r.value >= 85 ? '#059669' : r.value >= 70 ? '#2563eb' : '#94a3b8'} />
              ))}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onAthleticLockClick(recruit)}
            className="mt-2 flex w-full items-center justify-center gap-2 border border-dashed border-slate-300/80 bg-slate-50/60 py-3 text-xs text-slate-400 transition hover:border-[var(--team-primary)]/60 hover:text-slate-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-500 dark:hover:text-slate-300"
          >
            <LockIcon locked /> Athletic ratings hidden — click to reveal
          </button>
        )}
      </div>

      {/* Actions — board management + recruiting edits + full player edit. The name/portrait opens the full profile. */}
      {canEdit && (
        <div className="flex gap-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
          {/* Board add/remove temporarily disabled: adding a prospect corrupts the save
              for the game engine (crash on load) despite round-tripping in the tool —
              the empty-record allocation isn't producing a game-valid board entry. Under
              investigation; commitment + top-school edits are unaffected and safe. */}
          <button
            type="button"
            onClick={() => onEditRecruiting(recruit)}
            className="flex-1 bg-[var(--team-primary)] px-3 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95"
          >
            Edit recruiting
          </button>
          <button
            type="button"
            onClick={() => onEdit(recruit)}
            className="flex-1 border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
          >
            Edit recruit
          </button>
        </div>
      )}

      {/* EXPERIMENTAL — Force Commit. Gated behind the experimental-save-editing
          flag, and only for a boarded recruit who isn't already signed (the safe
          case: editing an existing board entry, never creating one). */}
      {canEdit && experimentalSaveEditing && recruit.onUserBoard && recruit.recruitStage !== 'Signed' && (
        <div className="border-t border-amber-400/30 pt-4">
          <button
            type="button"
            onClick={() => onForceCommit(recruit)}
            className="w-full border border-amber-500/60 bg-amber-500/[0.08] px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/[0.16] dark:text-amber-300"
          >
            Force Commit to User Team
          </button>
          <p className="mt-1.5 text-[11px] text-amber-700/70 dark:text-amber-300/60">
            Experimental — writes a real commit to your save (backed up + verified first).
          </p>
        </div>
      )}
      {canEdit && experimentalSaveEditing && !recruit.onUserBoard && (
        <p className="border-t border-slate-200/70 pt-4 text-[11px] text-slate-400 dark:border-white/10 dark:text-slate-500">
          Add this recruit to your board <strong>in-game</strong> to enable Force Commit — creating a board entry from
          outside the game corrupts the save.
        </p>
      )}
    </SurfaceCard>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-400 dark:text-slate-500">{k}</dt>
      <dd className="truncate text-right font-medium text-slate-900 dark:text-white">{v}</dd>
    </div>
  );
}

/**
 * The recruit browser — table on the left, full profile panel on the right,
 * with all the recruiting controls (Edit recruiting / Edit recruit / Force
 * Commit / reveal locks). Used for the whole national pool (`/recruits`) and,
 * with `boardOnly`, as the My Board page (`/recruiting`) scoped to the user's
 * board so both pages navigate identically.
 */
export function NationalRecruits({ boardOnly = false }: { boardOnly?: boolean } = {}) {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const { openPlayerModal } = usePlayerModal();
  const { openPlayerEditor } = useEditorModal();
  const { ovr, athletic, experimentalSaveEditing } = useRecruitingExperience();
  const [forceCommitRecruit, setForceCommitRecruit] = useState<NationalRecruit | null>(null);

  const [recruits, setRecruits] = useState<NationalRecruit[] | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<{ recruit: NationalRecruit; stat: 'ovr' | 'athletic' } | null>(null);
  const [editingRecruit, setEditingRecruit] = useState<NationalRecruit | null>(null);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [stars, setStars] = useState('');
  const [classYear, setClassYear] = useState('');
  const [homeState, setHomeState] = useState('');
  const [stage, setStage] = useState('');
  const [board, setBoard] = useState(boardOnly ? 'on' : ''); // '' = all, 'on' = on my board, 'off' = not on board
  const [sortKey, setSortKey] = useState<SortKey>('nationalRank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const canEdit = seasons.find((s) => s.id === seasonId)?.isCurrent === true;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRecruits(undefined);
    setSelectedId(null);
    window.api.db.getNationalRecruits(id, seasonId).then((r) => {
      if (!cancelled) setRecruits(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  const options = useMemo(() => {
    const list = recruits ?? [];
    return {
      positions: distinct(list.map((r) => r.position)),
      classes: distinct(list.map((r) => r.classYear)),
      states: distinct(list.map((r) => r.homeState)),
      stages: distinct(list.map((r) => r.recruitStage)),
    };
  }, [recruits]);

  const filtered = useMemo(() => {
    const list = recruits ?? [];
    const q = search.trim().toLowerCase();
    const result = list.filter((r) => {
      if (position && r.position !== position) return false;
      if (stars && r.stars !== Number(stars)) return false;
      if (classYear && r.classYear !== classYear) return false;
      if (homeState && r.homeState !== homeState) return false;
      if (stage && r.recruitStage !== stage) return false;
      if (board === 'on' && !r.onUserBoard) return false;
      if (board === 'off' && r.onUserBoard) return false;
      if (q) {
        const hay = `${r.firstName} ${r.lastName} ${r.hometown} ${r.homeState} ${r.pipeline} ${r.position}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      // Ranks: 0/NR sorts to the bottom regardless of direction.
      if (sortKey === 'nationalRank' || sortKey === 'positionRank' || sortKey === 'stateRank') {
        const av = a[sortKey] || Infinity;
        const bv = b[sortKey] || Infinity;
        return (av - bv) * dir;
      }
      if (sortKey === 'lastName') return a.lastName.localeCompare(b.lastName) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return result;
  }, [recruits, search, position, stars, classYear, homeState, stage, board, sortKey, sortDir]);

  const selected = useMemo(() => (recruits ?? []).find((r) => r.playerId === selectedId) ?? null, [recruits, selectedId]);

  const dash = useMemo(() => {
    const list = recruits ?? [];
    const byStar = (n: number) => list.filter((r) => r.stars === n).length;
    return {
      total: list.length,
      s5: byStar(5),
      s4: byStar(4),
      s3: byStar(3),
      s2: byStar(2),
      s1: byStar(1),
    };
  }, [recruits]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'stars' || key === 'overallRating' || key === 'commitScore' || key === 'baseNilValue' ? 'desc' : 'asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setPosition('');
    setStars('');
    setClassYear('');
    setHomeState('');
    setStage('');
    setBoard(boardOnly ? 'on' : ''); // keep the board scope on the My Board page
  }

  function openFull(r: NationalRecruit) {
    if (!id) return;
    openPlayerModal(id, r.playerId, seasonId, undefined, {
      name: `${r.firstName} ${r.lastName}`,
      position: r.position,
      teamDisplayName: r.topSchools[0]?.teamName ?? 'Uncommitted',
      portraitAssetName: r.portraitAssetName,
    });
  }

  function editRecruit(r: NationalRecruit) {
    if (!id) return;
    openPlayerEditor({
      dynastyId: id,
      playerId: r.playerId,
      playerLabel: `${r.firstName} ${r.lastName}`,
      isRecruit: true,
      onSaved: () => window.api.db.getNationalRecruits(id, seasonId).then((rr) => setRecruits(rr)),
    });
  }

  // Clicking a stat's lock: reveal (open the warning) when locked; re-lock all when unlocked.
  function ovrLockClick(r: NationalRecruit) {
    if (ovr.isUnlocked(r.playerId)) ovr.lockAll();
    else setPendingUnlock({ recruit: r, stat: 'ovr' });
  }
  function athleticLockClick(r: NationalRecruit) {
    if (athletic.isUnlocked(r.playerId)) athletic.lockAll();
    else setPendingUnlock({ recruit: r, stat: 'athletic' });
  }

  if (recruits === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading national recruits...</p>;
  }
  if (recruits === null) {
    return (
      <SurfaceCard className="text-sm text-slate-400 dark:text-slate-500">
        No national recruit data for this season — re-sync this dynasty to capture the full recruit pool. (Recruiting data is richest on a preseason/in-season save.)
      </SurfaceCard>
    );
  }

  const filtersActive = !!(search || position || stars || classYear || homeState || stage || (!boardOnly && board));
  const shown = filtered.slice(0, RENDER_CAP);

  const th = (key: SortKey, label: string, alignRight = false) => (
    <th className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] ${alignRight ? 'text-right' : 'text-left'}`}>
      <button type="button" onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 transition hover:text-[var(--team-accent-text)] ${sortKey === key ? 'text-slate-900 dark:text-white' : ''}`}>
        {label}
        {sortKey === key && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">{boardOnly ? 'My Board' : 'Recruits'}</p>
        <h2 className="mt-1 font-display text-page-title font-bold text-slate-950 dark:text-white">
          {boardOnly ? 'Your recruiting board.' : 'Every prospect in the country.'}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          {boardOnly
            ? 'Every prospect on your board — filter and sort, then open one for their school interest, athletic snapshot, and the same editing + Force Commit controls as the national browser.'
            : 'The full national recruit pool — filter and sort by anything, then open a prospect for their school interest, athletic snapshot, and commitment picture.'}
        </p>
      </div>

      {/* Dashboard — star distribution (national pool only; the board is small enough that the count line suffices there). */}
      {!boardOnly && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Recruits" value={dash.total.toLocaleString()} />
          <StatTile label="5-Star" value={dash.s5.toLocaleString()} />
          <StatTile label="4-Star" value={dash.s4.toLocaleString()} />
          <StatTile label="3-Star" value={dash.s3.toLocaleString()} />
          <StatTile label="2-Star" value={dash.s2.toLocaleString()} />
          <StatTile label="1-Star" value={dash.s1.toLocaleString()} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        {/* Filters + table */}
        <div className="space-y-3">
          {/* Search on its own full-width row, filters beneath it. */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, town, state, pipeline..."
            className={`${FILTER_SELECT} w-full`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Filter by position" className={FILTER_SELECT}>
              <option value="">All positions</option>
              {options.positions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={stars} onChange={(e) => setStars(e.target.value)} aria-label="Filter by stars" className={FILTER_SELECT}>
              <option value="">All stars</option>
              {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s}★</option>)}
            </select>
            <select value={homeState} onChange={(e) => setHomeState(e.target.value)} aria-label="Filter by state" className={FILTER_SELECT}>
              <option value="">All states</option>
              {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={classYear} onChange={(e) => setClassYear(e.target.value)} aria-label="Filter by class" className={FILTER_SELECT}>
              <option value="">All classes</option>
              {options.classes.map((c) => <option key={c} value={c}>{c.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')}</option>)}
            </select>
            <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage" className={FILTER_SELECT}>
              <option value="">All stages</option>
              {options.stages.map((s) => <option key={s} value={s}>{STAGE_STYLE[s]?.label ?? s}</option>)}
            </select>
            {!boardOnly && (
              <select value={board} onChange={(e) => setBoard(e.target.value)} aria-label="Filter by board status" className={FILTER_SELECT}>
                <option value="">All recruits</option>
                <option value="on">On my board</option>
                <option value="off">Not on board</option>
              </select>
            )}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="border border-slate-200/80 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white">
                Clear
              </button>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()} {filtersActive ? `filtered` : ''}
            {boardOnly ? ' on your board' : ` (${dash.total.toLocaleString()} total)`}
            {filtered.length > RENDER_CAP && ' — narrow with filters to see more'}
          </p>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 z-20 bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                  <tr>
                    <th className="sticky left-0 z-30 bg-[var(--team-primary)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">
                      <button type="button" onClick={() => toggleSort('nationalRank')} className="inline-flex items-center gap-1">Prospect{sortKey === 'nationalRank' && <span className="text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}</button>
                    </th>
                    {th('overallRating', 'OVR', true)}
                    {th('positionRank', 'Pos', true)}
                    {th('stateRank', 'St', true)}
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Class</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Town</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">State</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Pipeline</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Stage</th>
                    {th('commitScore', 'Commit', true)}
                    {th('baseNilValue', 'NIL', true)}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const isSel = r.playerId === selectedId;
                    return (
                      <tr
                        key={r.playerId}
                        onClick={() => setSelectedId(r.playerId)}
                        className={`cursor-pointer border-b border-slate-200/60 transition dark:border-white/5 ${isSel ? 'bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)]' : 'hover:bg-slate-50/80 dark:hover:bg-white/5'}`}
                      >
                        <td className={`sticky left-0 z-10 px-3 py-2 ${isSel ? 'bg-[color:color-mix(in_srgb,var(--team-primary)_12%,var(--surface-card,#fff))]' : 'bg-[var(--surface-card,#fff)] dark:bg-slate-950'}`}>
                          <div className="flex items-center gap-2.5">
                            <span className="tnum w-6 shrink-0 text-right text-xs font-bold text-slate-400 dark:text-slate-500">{r.nationalRank || '—'}</span>
                            <PlayerPortrait player={r} size="sm" className="!h-8 !w-8 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">{r.firstName} {r.lastName}</p>
                              <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500"><span className="font-bold text-slate-500 dark:text-slate-400">{r.position}</span> <Stars n={r.stars} /></p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {ovr.isUnlocked(r.playerId) ? (
                            <span className="tnum font-semibold text-slate-900 dark:text-white">{r.overallRating}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); ovrLockClick(r); }}
                              className="ml-auto inline-flex text-slate-400 transition hover:text-[var(--team-accent-text)] dark:text-slate-500"
                              aria-label="Reveal overall rating"
                              title="Overall hidden — click to reveal"
                            >
                              <LockIcon locked />
                            </button>
                          )}
                        </td>
                        <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">{r.positionRank || '—'}</td>
                        <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">{r.stateRank || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{formatClassYearShort(r.classYear)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{r.hometown}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{r.homeState}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">{r.pipeline || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2"><StageBadge stage={r.recruitStage} /></td>
                        <td className="tnum px-3 py-2 text-right text-slate-600 dark:text-slate-300">{r.commitScore || '—'}</td>
                        <td className="tnum px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatNil(r.baseNilValue)}</td>
                      </tr>
                    );
                  })}
                  {shown.length === 0 && (
                    <tr><td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No recruits match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>

        {/* Profile panel */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <RecruitPanel
            recruit={selected}
            canEdit={canEdit}
            onEdit={editRecruit}
            onEditRecruiting={setEditingRecruit}
            onOpenFull={openFull}
            ovrUnlocked={selected ? ovr.isUnlocked(selected.playerId) : false}
            onOvrLockClick={ovrLockClick}
            athleticUnlocked={selected ? athletic.isUnlocked(selected.playerId) : false}
            onAthleticLockClick={athleticLockClick}
            experimentalSaveEditing={experimentalSaveEditing}
            onForceCommit={setForceCommitRecruit}
          />
        </div>
      </div>

      {pendingUnlock &&
        createPortal(
          <StatUnlockModal
            recruit={pendingUnlock.recruit}
            statLabel={pendingUnlock.stat === 'ovr' ? 'overall rating' : 'athletic ratings'}
            onCancel={() => setPendingUnlock(null)}
            onUnlockOne={() => {
              (pendingUnlock.stat === 'ovr' ? ovr : athletic).unlockForRecruit(pendingUnlock.recruit.playerId);
              setPendingUnlock(null);
            }}
            onUnlockAll={() => {
              (pendingUnlock.stat === 'ovr' ? ovr : athletic).unlockForAll();
              setPendingUnlock(null);
            }}
          />,
          document.body,
        )}

      {editingRecruit &&
        id &&
        createPortal(
          <RecruitInfluenceModal
            dynastyId={id}
            recruit={editingRecruit}
            onClose={() => setEditingRecruit(null)}
            onSaved={() => {
              setEditingRecruit(null);
              window.api.db.getNationalRecruits(id, seasonId).then((rr) => setRecruits(rr));
            }}
          />,
          document.body,
        )}

      {forceCommitRecruit &&
        id &&
        createPortal(
          <ForceCommitModal
            dynastyId={id}
            recruit={forceCommitRecruit}
            onClose={() => setForceCommitRecruit(null)}
            onDone={() => window.api.db.getNationalRecruits(id, seasonId).then((rr) => setRecruits(rr))}
          />,
          document.body,
        )}
    </div>
  );
}

/** The stage options for the commitment dropdown — the decision funnel, verified enum values. */
const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Top10', label: 'Top 10' },
  { value: 'Top5', label: 'Top 5' },
  { value: 'Top3', label: 'Top 3' },
  { value: 'SoftCommitted', label: 'Committed (soft)' },
  { value: 'Signed', label: 'Signed' },
];

/**
 * Recruiting editor — Step-1 write features (verified round-trip safe): a
 * prospect's commitment stage + commit score, and each top school's interest.
 * Writes through the auto-backup path; on success the browser re-syncs.
 */
function RecruitInfluenceModal({
  dynastyId,
  recruit,
  onClose,
  onSaved,
}: {
  dynastyId: string;
  recruit: NationalRecruit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState(recruit.recruitStage);
  const [commitScore, setCommitScore] = useState(recruit.commitScore);
  // Each slot keeps its ORIGINAL team (identifies the slot on write) plus the
  // currently-chosen team + influence — swapping the team forces a different
  // school into that slot (e.g. your own program).
  const [slots, setSlots] = useState(
    () => recruit.topSchools.map((s) => ({ originalTeamIndex: s.teamIndex, teamIndex: s.teamIndex, influence: s.influence })),
  );
  const [teams, setTeams] = useState<{ teamIndex: number; displayName: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.db.getLeagueTeams(dynastyId).then((list) => {
      if (list) setTeams([...list].sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
  }, [dynastyId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  function updateSlot(originalTeamIndex: number, patch: Partial<{ teamIndex: number; influence: number }>) {
    setSlots((prev) => prev.map((s) => (s.originalTeamIndex === originalTeamIndex ? { ...s, ...patch } : s)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await window.api.editor.saveRecruitInfluence(dynastyId, recruit.playerId, {
      stage,
      commitScore,
      topSchools: slots,
    });
    if (result.success) {
      onSaved();
    } else {
      setError(result.message);
      setSaving(false);
    }
  }

  // Names for the dropdown; ensure any team currently in a slot is always selectable even if not in the league list.
  const teamName = (idx: number) =>
    teams.find((t) => t.teamIndex === idx)?.displayName ??
    recruit.topSchools.find((s) => s.teamIndex === idx)?.teamName ??
    `Team ${idx}`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div className="corner-cut relative flex max-h-[88vh] w-full max-w-lg flex-col border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 p-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <PlayerPortrait player={recruit} size="sm" className="!h-10 !w-10" />
            <div>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Edit recruiting</p>
              <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">{recruit.firstName} {recruit.lastName}</h3>
            </div>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="border border-slate-300/85 bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900">Close</button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {/* Commitment */}
          <section>
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Commitment</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-slate-400 dark:text-slate-500">Stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)} className={`${FILTER_SELECT} w-full`}>
                  {STAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  {!STAGE_OPTIONS.some((o) => o.value === stage) && <option value={stage}>{stage}</option>}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-slate-400 dark:text-slate-500">Commit score</span>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={commitScore}
                  onChange={(e) => setCommitScore(Number(e.target.value))}
                  className={`${FILTER_SELECT} w-full`}
                />
              </label>
            </div>
          </section>

          {/* Top-school interest — the team can be swapped (force a school in), influence 0–99. */}
          {slots.length > 0 && (
            <section>
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">School interest — swap a team or set interest (0–99)</p>
              <div className="mt-2 space-y-2">
                {slots.map((slot) => (
                  <div key={slot.originalTeamIndex} className="flex items-center gap-2">
                    <TeamLogo team={{ assetName: teamName(slot.teamIndex), label: teamName(slot.teamIndex) }} size="sm" className="!h-5 !w-5 shrink-0" />
                    <select
                      value={slot.teamIndex}
                      onChange={(e) => updateSlot(slot.originalTeamIndex, { teamIndex: Number(e.target.value) })}
                      className="min-w-0 flex-1 border border-slate-200/80 bg-white/80 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-white"
                      aria-label={`Top school (was ${teamName(slot.originalTeamIndex)})`}
                    >
                      {/* keep the current team selectable even if the league list hasn't loaded */}
                      {!teams.some((t) => t.teamIndex === slot.teamIndex) && (
                        <option value={slot.teamIndex}>{teamName(slot.teamIndex)}</option>
                      )}
                      {teams.map((t) => (
                        <option key={t.teamIndex} value={t.teamIndex}>{t.displayName}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={slot.influence}
                      onChange={(e) => updateSlot(slot.originalTeamIndex, { influence: Number(e.target.value) })}
                      className="w-16 shrink-0 border border-slate-200/80 bg-white/80 px-2 py-1.5 text-right text-sm text-slate-900 outline-none focus:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-white"
                      aria-label="Interest"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && <p className="border border-red-300/70 bg-red-100/70 px-3 py-2 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 p-5 dark:border-white/10">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">A backup of your save is made automatically before writing.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="bg-[var(--team-primary)] px-5 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95 disabled:opacity-60">
              {saving ? 'Saving…' : 'Save to dynasty'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** App-styled confirm before revealing a recruit's ratings — the game hides these until you scout, so this is a deliberate immersion break. */
function StatUnlockModal({
  recruit,
  statLabel,
  onCancel,
  onUnlockOne,
  onUnlockAll,
}: {
  recruit: NationalRecruit;
  statLabel: string;
  onCancel: () => void;
  onUnlockOne: () => void;
  onUnlockAll: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div className="corner-cut relative w-full max-w-md border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border border-amber-300/70 bg-amber-100/70 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            <LockIcon locked />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">Reveal {statLabel}?</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          The game keeps a prospect&apos;s {statLabel} hidden until you&apos;ve scouted them — revealing{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{recruit.firstName} {recruit.lastName}</span>
          &apos;s numbers here can take some of that discovery (and immersion) out of your dynasty. You can always lock
          them again.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onUnlockOne}
            className="w-full bg-[var(--team-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95"
          >
            Reveal only this recruit
          </button>
          <button
            type="button"
            onClick={onUnlockAll}
            className="w-full border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
          >
            Reveal all recruits
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Keep hidden
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * EXPERIMENTAL Force Commit confirmation. Shows the recruit, the destination
 * (the user's team), and an explicit warning that this writes to the save;
 * on confirm it calls the backend (which backs up, writes the committed board
 * state, and validates on reopen), then shows the result + the change log.
 */
function ForceCommitModal({
  dynastyId,
  recruit,
  onClose,
  onDone,
}: {
  dynastyId: string;
  recruit: NationalRecruit;
  onClose: () => void;
  onDone: () => void;
}) {
  const viewedTeam = useViewedTeamOptional();
  const userTeamName = viewedTeam?.userTeamName ?? 'your team';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ForceCommitResult | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function run() {
    setBusy(true);
    const r = await window.api.editor.forceCommitRecruit(dynastyId, recruit.playerId);
    setResult(r);
    setBusy(false);
    if (r.success) onDone();
  }

  const done = result !== null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div className="corner-cut relative flex max-h-[88vh] w-full max-w-md flex-col border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 p-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <PlayerPortrait player={recruit} size="sm" className="!h-10 !w-10" />
            <div>
              <p className="type-eyebrow text-amber-600 dark:text-amber-400">Experimental · Force Commit</p>
              <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
                {recruit.firstName} {recruit.lastName}
              </h3>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!done && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Position" value={recruit.position} />
                <StatTile label="Stars" value={'★'.repeat(recruit.stars) || '—'} />
                <StatTile label="Destination" value={userTeamName} />
              </div>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Force <span className="font-semibold text-slate-900 dark:text-white">{recruit.firstName} {recruit.lastName}</span>{' '}
                to commit to <span className="font-semibold text-slate-900 dark:text-white">{userTeamName}</span>?
              </p>
              <div className="border border-amber-400/50 bg-amber-50/70 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/[0.08] dark:text-amber-200">
                This directly modifies your dynasty save — it writes a real committed state (scholarship + NIL met + your
                school as the clear leader). Your save is backed up first and the write is verified on reopen; if it
                doesn&apos;t verify, the backup is restored automatically. Whether the commit survives an in-game season is
                still being confirmed.
              </div>
            </>
          )}

          {done && result && (
            <>
              <div
                className={`border px-3 py-2.5 text-sm ${
                  result.success
                    ? 'border-emerald-300/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'border-red-300/70 bg-red-50/70 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
                }`}
              >
                {result.message}
              </div>
              {result.changedFields && result.changedFields.length > 0 && (
                <div>
                  <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                    Changes {result.validated ? 'written' : 'attempted'}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {result.changedFields.map((c, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-0.5 dark:border-white/5">
                        <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">{c.field}</span>
                        <span className="tnum text-right text-slate-800 dark:text-slate-200">
                          {c.before} <span className="text-slate-400">→</span> {c.after}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 p-5 dark:border-white/10">
          {!done ? (
            <>
              <button
                type="button"
                onClick={() => !busy && onClose()}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="border border-amber-500/60 bg-amber-500/[0.12] px-5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/[0.22] disabled:opacity-60 dark:text-amber-300"
              >
                {busy ? 'Committing…' : 'Force Commit'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="bg-[var(--team-primary)] px-5 py-2 text-sm font-semibold text-[var(--team-on-primary)] transition hover:brightness-95"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
