import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PlayerDeparture, TeamTransfers, TransferEntry } from '../../shared/types';
import { PageMasthead } from '../components/common/PageMasthead';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PlayerPortrait } from '../components/common/PlayerPortrait';
import { TeamLink, resolveTeamIndex } from '../components/common/TeamLink';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { usePlayerModal } from '../data/PlayerModalProvider';

/** NFL declarations + graduations (players who left the LEAGUE, not to another school). */
function DeparturesCard({ departures, teamAssetName }: { departures: PlayerDeparture[]; teamAssetName?: string | null }) {
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Left the program</h3>
        <span className="tnum border border-slate-300/70 px-2.5 py-0.5 text-sm font-semibold text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {departures.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        NFL declarations (projected round only — the game doesn&apos;t simulate the draft) and graduating seniors.
      </p>
      {departures.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
          None recorded — sync at the offseason &quot;Players Leaving&quot; step to capture this.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {departures.map((d) => (
            <div
              key={d.playerId}
              className="flex items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-3 py-2.5 dark:border-slate-800 dark:bg-white/5"
            >
              <PlayerPortrait player={d} size="sm" className="!h-9 !w-9" teamAssetName={teamAssetName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {d.firstName} {d.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {d.position} · {d.overallRating} OVR
                </p>
              </div>
              {d.type === 'nfl' ? (
                <span className="shrink-0 border border-amber-300/70 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:text-amber-300">
                  NFL{d.projectedRound ? ` · Proj. Rd ${d.projectedRound}` : ''}
                </span>
              ) : (
                <span className="shrink-0 border border-slate-300/70 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Graduated
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

function TransferRow({
  entry,
  direction,
  reason,
  onOpen,
}: {
  entry: TransferEntry;
  direction: 'in' | 'out';
  reason?: string;
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
        {reason ? (
          <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{reason}</p>
        ) : null}
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
  reasonByPlayer,
  onOpen,
}: {
  title: string;
  accent: string;
  entries: TransferEntry[];
  direction: 'in' | 'out';
  reasonByPlayer?: Map<number, string>;
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
            <TransferRow
              key={`${e.playerId}-${e.seasonYear}`}
              entry={e}
              direction={direction}
              reason={reasonByPlayer?.get(e.playerId)}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

export function Transfers() {
  const { id } = useParams<{ id: string }>();
  const { viewedTeamIndex, leagueTeams, userTeamName } = useViewedTeam();
  const { selectedSeasonId } = useSelectedSeason();
  const { openPlayerModal } = usePlayerModal();
  const [data, setData] = useState<TeamTransfers | null | undefined>(undefined);
  const [departures, setDepartures] = useState<PlayerDeparture[]>([]);

  const focusTeamName = useMemo(
    () =>
      viewedTeamIndex === null
        ? userTeamName
        : (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? null),
    [viewedTeamIndex, leagueTeams, userTeamName],
  );
  const focusTeamIndex = viewedTeamIndex ?? resolveTeamIndex(focusTeamName ?? '', leagueTeams);

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

  // Departures (NFL declarations / graduations) + transfer reasons for the
  // selected season — only present once synced at the offseason "Players Leaving" step.
  useEffect(() => {
    setDepartures([]);
    if (!id || focusTeamIndex === null) return;
    let cancelled = false;
    window.api.db.getDepartures(id, focusTeamIndex, selectedSeasonId).then((result) => {
      if (!cancelled) setDepartures(result ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [id, focusTeamIndex, selectedSeasonId]);

  const reasonByPlayer = useMemo(
    () =>
      new Map<number, string>(
        departures.filter((d) => d.type === 'transfer' && d.reason).map((d) => [d.playerId, d.reason as string]),
      ),
    [departures],
  );
  const leftTheLeague = useMemo(() => departures.filter((d) => d.type !== 'transfer'), [departures]);

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
      <PageMasthead
        eyebrow="Transfer Portal"
        title={focusTeamName ?? 'Transfer Portal'}
        description="Detected by comparing each season's full league roster to the last — players who changed schools between seasons. Only this app keeps the per-season league history that makes this possible."
        mark={{ kind: 'logo', teamAssetName: focusTeamName ?? '' }}
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
            reasonByPlayer={reasonByPlayer}
            onOpen={openPlayer}
          />
        </div>
      )}

      {leftTheLeague.length > 0 ? <DeparturesCard departures={leftTheLeague} /> : null}
    </div>
  );
}
