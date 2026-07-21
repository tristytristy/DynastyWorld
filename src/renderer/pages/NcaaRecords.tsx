import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PageHeader } from '../components/ui/PageHeader';
import { TeamLogo } from '../components/common/TeamLogo';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import type { NcaaRecordCategory, NcaaRecordHolder } from '../../extractors/extract-ncaa-records';

function formatValue(value: number, key: NcaaRecordCategory['key']): string {
  return key === 'DefensiveSacks' && value % 1 !== 0 ? value.toFixed(1) : value.toLocaleString();
}

function HolderCell({ label, holder, statKey }: { label: string; holder: NcaaRecordHolder | null; statKey: NcaaRecordCategory['key'] }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      {holder ? (
        <>
          <p className="mt-3 proportional-nums text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {formatValue(holder.statValue, statKey)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <TeamLogo team={{ assetName: holder.teamName, label: holder.teamName }} size="sm" className="!h-5 !w-5" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {holder.firstName} {holder.lastName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {holder.position} · {holder.teamName} · {holder.calendarYear}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">No record on file.</p>
      )}
    </div>
  );
}

function RecordCategoryRow({ category }: { category: NcaaRecordCategory }) {
  return (
    <SurfaceCard>
      <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{category.label}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <HolderCell label="Career" holder={category.career} statKey={category.key} />
        <HolderCell label="Single Season" holder={category.season} statKey={category.key} />
        <HolderCell label="Single Game" holder={category.game} statKey={category.key} />
      </div>
    </SurfaceCard>
  );
}

/**
 * NCAA Record Book — national career / single-season / single-game records
 * (League.Player{Career,Season,Game}StatRecords). The game ships real FBS
 * all-time records that then update as the dynasty produces new holders. Record
 * holders are historical and not part of the current dynasty roster, so names
 * aren't clickable profiles — the team is shown with its mark.
 */
export function NcaaRecords() {
  const { id } = useParams<{ id: string }>();
  const { selectedSeasonId: seasonId } = useSelectedSeason();
  const [records, setRecords] = useState<NcaaRecordCategory[] | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRecords(undefined);
    window.api.db.getNcaaRecords(id, seasonId).then((r) => !cancelled && setRecords(r));
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  if (records === undefined) return <p className="text-slate-500 dark:text-slate-400">Loading the record book...</p>;
  if (records === null || records.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="NCAA Record Book" title="National records." description="The save's national record book." />
        <SurfaceCard className="text-sm text-slate-400 dark:text-slate-500">
          No record book found for this season — re-sync this dynasty to populate it (this data was added in a newer build).
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NCAA Record Book"
        title="National records — career, season, and single game."
        description="The FBS record book the save itself tracks. These begin as real all-time records and update whenever a player in your dynasty breaks one. Single-game records carry no opponent/score context in the save, so no matchup is shown."
      />
      <div className="space-y-4">
        {records.map((category) => (
          <RecordCategoryRow key={category.key} category={category} />
        ))}
      </div>
    </div>
  );
}
