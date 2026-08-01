import { useEffect, useState } from 'react';
import { SurfaceCard } from '../ui/SurfaceCard';
import { StatTile } from '../ui/StatTile';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { TeamLogo } from './TeamLogo';
import type { TeamHistorySeasonData, TeamHistoryView, TeamStatRecordData } from '../../../shared/types';

/**
 * A school's real history — every school's, not just the one being coached.
 *
 * The History page could only ever say "no titles in the tracked years" about a
 * browsed program, which was true of the two seasons the app had and useless as
 * a description of the school. The save has carried the real thing all along:
 * all-time totals, a year-by-year table, and a record book with named holders.
 *
 * Three sections because they answer three questions, and they have different
 * provenance — which the page has to be honest about:
 *
 *   Résumé      real all-time history, added to as the dynasty runs
 *   Seasons     ONLY the years this dynasty has played
 *   Record book real history that your players can take over
 */

const RECORD_LABELS: Record<string, string> = {
  PassYards: 'Passing yards',
  PassTDS: 'Passing touchdowns',
  RushYards: 'Rushing yards',
  RushTDS: 'Rushing touchdowns',
  ReceivingYards: 'Receiving yards',
  ReceivingCatches: 'Receptions',
  ReceivingTDS: 'Receiving touchdowns',
  DefensiveSacks: 'Sacks',
  DefensiveInts: 'Interceptions',
};

/** Record-book order — offence by volume, then defence. Anything unmapped sorts last. */
const RECORD_ORDER = [
  'PassYards',
  'PassTDS',
  'RushYards',
  'RushTDS',
  'ReceivingYards',
  'ReceivingCatches',
  'ReceivingTDS',
  'DefensiveSacks',
  'DefensiveInts',
];

function winPct(wins: number, losses: number, ties: number): string {
  const games = wins + losses + ties;
  if (games === 0) return '—';
  return ((wins + ties / 2) / games).toFixed(3).replace(/^0/, '');
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

/** "SemiFinals_Win" / "Loss" → something a person reads. */
function humanResult(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** The furthest a team got that year, or null when the season ended in the regular season. */
function postseason(season: TeamHistorySeasonData): string | null {
  if (season.nationalResult) return `National Championship — ${humanResult(season.nationalResult)}`;
  if (season.semiFinalResult) return `Semifinal — ${humanResult(season.semiFinalResult)}`;
  if (season.quarterFinalResult) return `Quarterfinal — ${humanResult(season.quarterFinalResult)}`;
  if (season.firstRoundResult) return `First round — ${humanResult(season.firstRoundResult)}`;
  return null;
}

function RecordBook({ records }: { records: TeamStatRecordData[] }) {
  const sorted = [...records].sort((a, b) => {
    const ai = RECORD_ORDER.indexOf(a.category);
    const bi = RECORD_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">No records on file for this program.</p>;
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((record) => (
        <div
          key={record.category}
          className="border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5"
        >
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            {RECORD_LABELS[record.category] ?? record.category}
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
            {record.value.toLocaleString()}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {record.firstName} {record.lastName}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {record.position}
            {record.year > 0 ? ` · ${record.year}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProgramHistory({
  dynastyId,
  teamIndex,
  seasonId,
}: {
  dynastyId: string;
  teamIndex: number | null;
  seasonId?: number;
}) {
  const [history, setHistory] = useState<TeamHistoryView | null | undefined>(undefined);
  const [recordScope, setRecordScope] = useState<'career' | 'season'>('career');

  useEffect(() => {
    if (teamIndex === null) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    setHistory(undefined);
    window.api.db.getTeamHistory(dynastyId, teamIndex, seasonId).then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, teamIndex, seasonId]);

  if (history === undefined) return null;
  if (history === null) {
    return (
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Program history</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This season was synced before program history was captured. Sync this dynasty again and every school&apos;s
          all-time record, season history and record book appear here.
        </p>
      </SurfaceCard>
    );
  }

  const allTime = history.allTime;
  const records = recordScope === 'career' ? history.careerRecords : history.seasonRecords;
  const knob = (
    <TeamLogo
      team={{ assetName: history.teamName, label: history.teamName }}
      size="sm"
      variant="gold"
      className="h-[35px] w-[35px]"
    />
  );

  return (
    <div className="space-y-6">
      {allTime && (
        <SurfaceCard>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">All-time</p>
            {history.yearProgramStarted > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Football since {history.yearProgramStarted}
                {history.yearSchoolEstablished > 0 ? ` · school founded ${history.yearSchoolEstablished}` : ''}
              </p>
            )}
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="All-time record" value={formatRecord(allTime.wins, allTime.losses, allTime.ties)} />
            <StatTile label="Win percentage" value={winPct(allTime.wins, allTime.losses, allTime.ties)} />
            <StatTile label="At home" value={formatRecord(allTime.homeWins, allTime.homeLosses, allTime.homeTies)} />
            <StatTile label="Longest home streak" value={String(allTime.longestHomeWinStreak)} />
            <StatTile label="Bowl games" value={`${allTime.bowlsWon}-${allTime.bowlsMade - allTime.bowlsWon}`} />
            <StatTile label="New Year's Six" value={`${allTime.ny6BowlsWon} of ${allTime.ny6BowlsMade}`} />
            <StatTile label="Conference titles" value={String(allTime.conferenceChampionshipsWon)} />
            <StatTile label="National titles" value={String(allTime.nationalChampionshipsWon)} />
            <StatTile label="Playoff appearances" value={String(allTime.cfpsMade)} />
            <StatTile label="Weeks ranked" value={String(allTime.weeksRankedTop25InMediaPoll)} />
            <StatTile label="Rivalry record" value={`${allTime.rivalryWins}-${allTime.rivalryLosses}`} />
            <StatTile label="Heisman winners" value={String(allTime.heismanWinners)} />
            <StatTile label="All-Americans" value={String(allTime.allAmericans1stAnd2nd)} />
            <StatTile label="Players drafted" value={String(allTime.playersDrafted)} />
            <StatTile label="Top-5 classes" value={String(allTime.top5RecruitingClasses)} />
            <StatTile label="Top-25 classes" value={String(allTime.top25RecruitingClasses)} />
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard>
        <CollapsibleSection
          title="Record book"
          eyebrow
          right={
            <ToggleSwitch<'career' | 'season'>
              value={recordScope}
              onChange={setRecordScope}
              left={{ value: 'career', label: 'CAREER' }}
              right={{ value: 'season', label: 'SEASON' }}
              ariaLabel="Career or single-season records"
              knob={knob}
            />
          }
        >
          <RecordBook records={records} />
        </CollapsibleSection>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden p-0">
        <div className="px-5 pt-5">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Season by season</p>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {/* Unlike the two sections above, this one starts when your dynasty does — the save itemises seasons
                from that point forward, so it fills in as you play rather than reaching back. */}
            Every season since this dynasty began. The all-time totals and record book above cover the program&apos;s
            whole history.
          </p>
        </div>
        {history.seasons.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500">
            No completed seasons yet — the first one lands when this year finishes.
          </p>
        ) : (
          <div className="mt-4 max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                <tr>
                  {['Year', 'Coach', 'Record', 'Conference', 'Finish', 'Final rank', 'Postseason'].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.seasons.map((season) => {
                  const result = postseason(season);
                  return (
                    <tr
                      key={season.year}
                      className="border-b border-slate-200/70 last:border-b-0 dark:border-slate-800/70"
                    >
                      <td className="tnum whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                        {season.year}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {season.coachName || '—'}
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-slate-800 dark:text-slate-100">
                        {formatRecord(season.wins, season.losses, season.ties)}
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {season.conferenceName
                          ? `${formatRecord(season.conferenceWins, season.conferenceLosses, season.conferenceTies)} ${season.conferenceName}`
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {season.finalConferenceStanding > 0
                          ? `${season.isConferenceStandingTied ? 'T-' : ''}${season.finalConferenceStanding}`
                          : '—'}
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {/* The poll ranks all 138 teams, so anything past 25 finished outside it. */}
                        {season.finalMediaRank > 0 && season.finalMediaRank <= 25 ? `#${season.finalMediaRank}` : 'NR'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">
                        {result ?? (season.wonConferenceChampionship ? 'Conference champions' : '—')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
