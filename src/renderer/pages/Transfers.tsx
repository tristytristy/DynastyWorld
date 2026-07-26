import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { TeamTransfers, TransferEntry } from '../../shared/types';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { TeamLink } from '../components/common/TeamLink';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';

function TransferRow({
  entry,
  direction,
  onOpen,
}: {
  entry: TransferEntry;
  direction: 'in' | 'out';
  onOpen: (entry: TransferEntry) => void;
}) {
  // For an incoming move the "other" school is where they came FROM; for an
  // outgoing move it's where they went TO. Only the TO side carries an index.
  const otherTeam = direction === 'in' ? entry.fromTeam : entry.toTeam;
  const otherTeamIndex = direction === 'out' ? entry.toTeamIndex : undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(entry);
        }
      }}
      className="flex w-full cursor-pointer items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 text-left transition hover:border-[var(--team-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--team-primary)] dark:border-slate-800 dark:bg-white/5"
    >
      <PlayerPortrait player={entry} size="sm" className="!h-9 !w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {entry.firstName} {entry.lastName}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>{entry.position}</span>
          <span aria-hidden="true">·</span>
          <span>{direction === 'in' ? 'from' : 'to'}</span>
          <TeamLink teamIndex={otherTeamIndex} teamName={otherTeam} size="sm" logoClassName="!h-4 !w-4" nameClassName="truncate" />
        </p>
      </div>
      <span className="tnum shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{entry.seasonYear}</span>
    </div>
  );
}

function TransferColumn({
  title,
  accent,
  entries,
  direction,
  onOpen,
}: {
  title: string;
  accent: string;
  entries: TransferEntry[];
  direction: 'in' | 'out';
  onOpen: (entry: TransferEntry) => void;
}) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
        <span className={`tnum border px-2.5 py-0.5 text-sm font-semibold ${accent}`}>{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">None across the archived seasons.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((e) => (
            <TransferRow key={`${e.playerId}-${e.seasonYear}`} entry={e} direction={direction} onOpen={onOpen} />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

export function Transfers() {
  const { id } = useParams<{ id: string }>();
  const { viewedTeamIndex, leagueTeams, userTeamName } = useViewedTeam();
  const { openPlayerModal } = usePlayerModal();
  const [data, setData] = useState<TeamTransfers | null | undefined>(undefined);

  const focusTeamName = useMemo(
    () =>
      viewedTeamIndex === null
        ? userTeamName
        : (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? null),
    [viewedTeamIndex, leagueTeams, userTeamName],
  );

  useEffect(() => {
    setData(undefined);
    if (!id || !focusTeamName) return; // stay in loading until the focus team name resolves
    let cancelled = false;
    window.api.db.getTransfers(id, focusTeamName).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, focusTeamName]);

  function openPlayer(entry: TransferEntry) {
    if (!id) return;
    openPlayerModal(
      id,
      entry.playerId,
      entry.toSeasonId,
      undefined,
      {
        name: `${entry.firstName} ${entry.lastName}`,
        position: entry.position,
        teamDisplayName: entry.toTeam,
        portraitAssetName: entry.portraitAssetName,
      },
      entry.toTeamIndex,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transfer Portal"
        title={`Who came and went${focusTeamName ? ` — ${focusTeamName}` : ''}.`}
        description="Detected by comparing each season's full league roster to the last — players who changed schools between seasons. Only this app keeps the per-season league history that makes this possible."
      />

      {data === undefined ? (
        <p className="text-slate-500 dark:text-slate-400">Loading transfers...</p>
      ) : data === null ? (
        <SurfaceCard className="text-sm text-slate-400 dark:text-slate-500">No transfer data for this team yet.</SurfaceCard>
      ) : data.seasonPairsAvailable === 0 ? (
        <SurfaceCard className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Transfers show up once there are two synced seasons to compare. Sync again next season and this fills in
          automatically.
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TransferColumn
            title="Transferred in"
            accent="border-emerald-300/70 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300"
            entries={data.transfersIn}
            direction="in"
            onOpen={openPlayer}
          />
          <TransferColumn
            title="Transferred out"
            accent="border-red-300/70 text-red-700 dark:border-red-500/40 dark:text-red-300"
            entries={data.transfersOut}
            direction="out"
            onOpen={openPlayer}
          />
        </div>
      )}
    </div>
  );
}
