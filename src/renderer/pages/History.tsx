import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { PageHeader } from '../components/ui/PageHeader';
import { TeamLogo } from '../components/common/TeamLogo';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { formatAwardLabel } from '../lib/awardFormat';
import type {
  LeagueHistoryYearEntry,
  ProgramHistoryMilestone,
  ProgramHistoryOverview,
  ProgramHistoryRecordCategory,
  ProgramHistoryRecordHolder,
} from '../../shared/types';

function formatRank(rank: number | null): string {
  return rank ? `#${rank}` : 'NR';
}

function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

function formatValue(value: number, key: ProgramHistoryRecordCategory['key']): string {
  return key === 'defensiveSacks' ? value.toFixed(value % 1 === 0 ? 0 : 1) : String(value);
}

function RecordLine({
  label,
  record,
  statKey,
}: {
  label: string;
  record: ProgramHistoryRecordHolder | null;
  statKey: ProgramHistoryRecordCategory['key'];
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      {record ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950 dark:text-white">{record.playerName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {record.position} | {record.seasonYear}
            </p>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {formatValue(record.value, statKey)}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">No record available.</p>
      )}
    </div>
  );
}

/** Full-width per spec — every record category gets its own row, never packed side-by-side just to save space. */
function RecordBookRow({ category }: { category: ProgramHistoryRecordCategory }) {
  return (
    <SurfaceCard>
      <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{category.label}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <RecordLine label="Career" record={category.careerRecord} statKey={category.key} />
        <RecordLine label="Season" record={category.seasonRecord} statKey={category.key} />
        <RecordLine label="Game" record={category.gameRecord} statKey={category.key} />
      </div>
    </SurfaceCard>
  );
}

function LeagueHistoryRow({ year }: { year: LeagueHistoryYearEntry }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-950 dark:text-white">{year.seasonYear}</p>
        {!year.hasFullData && (
          <span className="border border-amber-300/70 bg-amber-100/80 px-2.5 py-1 type-eyebrow text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            History Only
          </span>
        )}
      </div>
      {year.nationalChampion ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">National Champion:</span>{' '}
          {year.nationalChampion.teamName} ({formatRecord(year.nationalChampion.wins, year.nationalChampion.losses)}) —{' '}
          {year.nationalChampion.coachFirstName} {year.nationalChampion.coachLastName}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">No national championship result available.</p>
      )}
      {year.conferenceChampions.length > 0 && (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {year.conferenceChampions.map((c) => `${c.conferenceName}: ${c.winningTeamName}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

function MilestoneRow({ milestone }: { milestone: ProgramHistoryMilestone }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-950 dark:text-white">{milestone.label}</p>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{milestone.seasonYear}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{milestone.detail}</p>
    </div>
  );
}

/**
 * Program-wide national awards + the coaching lineage that ran this program.
 * These are genuine program history (who won national honors here, who has
 * coached the program), kept when the coach's *personal* lifetime resume was
 * moved out to Coach Hub — see the removed "Dynasty Resume" card (that record
 * lives on Coach Hub's Career Record panel, its real home). Only renders when
 * there's something to show.
 */
function ProgramHonors({ history }: { history: ProgramHistoryOverview }) {
  const hasAwards = history.nationalAwards.length > 0;
  const hasCoachLineage = history.coaches.length > 1;
  if (!hasAwards && !hasCoachLineage) return null;

  return (
    <SurfaceCard>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">Major National Awards</p>
      {hasAwards ? (
        <div className="mt-2 space-y-2">
          {history.nationalAwards.map((award, index) => (
            <div key={`${award.seasonYear}-${award.awardType}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-700 dark:text-slate-200">
                <span className="font-semibold text-slate-950 dark:text-white">{formatAwardLabel(award.awardType)}</span>{' '}
                — {award.playerName}
              </span>
              <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{award.seasonYear}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
          No leaguewide season awards won by this program in the archived seasons yet.
        </p>
      )}

      {hasCoachLineage && (
        <div className="mt-5 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaches Across This Archive</p>
          <div className="mt-2 space-y-2">
            {history.coaches.map((coach) => (
              <div key={coach.coachName} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                  {coach.coachName} <span className="text-xs text-slate-400 dark:text-slate-500">({coach.seasons} season{coach.seasons === 1 ? '' : 's'})</span>
                </span>
                <span className="shrink-0 font-medium text-slate-900 dark:text-white">{formatRecord(coach.wins, coach.losses)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}

export function History() {
  const { id } = useParams<{ id: string }>();
  const [history, setHistory] = useState<ProgramHistoryOverview | null | undefined>(undefined);
  const { viewedTeamIndex, leagueTeams } = useViewedTeam();
  const viewedLeagueTeamName =
    viewedTeamIndex === null ? null : (leagueTeams?.find((t) => t.teamIndex === viewedTeamIndex)?.displayName ?? null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setHistory(undefined);
    window.api.db.getHistory(id).then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (history === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading program history...</p>;
  }

  if (history === null || !id) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Program history not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Program History"
        title={
          viewedLeagueTeamName
            ? `${viewedLeagueTeamName} — championships on record.`
            : `The program story and record book for ${history.teamName}.`
        }
        description={
          viewedLeagueTeamName
            ? 'From the league history the save itself tracks — national and conference titles by year. The full record book and timeline are tracked for your own program only.'
            : "The program's history, with or without you as the coach — school records from the save's own book, plus the timeline, milestones, and league titles that accumulate across the archive."
        }
      />

      {viewedLeagueTeamName && (
        <SurfaceCard>
          <div className="flex items-center gap-3">
            <TeamLogo team={{ assetName: viewedLeagueTeamName, label: viewedLeagueTeamName }} size="md" />
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">Titles in tracked league history</p>
          </div>
          <div className="mt-3 space-y-2">
            {history.leagueHistory
              .map((year) => {
                const national = year.nationalChampion?.teamName === viewedLeagueTeamName;
                const conf = year.conferenceChampions.find((c) => c.winningTeamName === viewedLeagueTeamName);
                if (!national && !conf) return null;
                return (
                  <div key={year.seasonYear} className="flex items-center gap-3 border border-slate-200/80 bg-slate-50/85 px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-white/5">
                    <span className="type-stat-sm text-slate-950 dark:text-white">{year.seasonYear}</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {national ? 'National Champions' : `${conf?.conferenceName ?? 'Conference'} Champions`}
                    </span>
                  </div>
                );
              })
              .filter(Boolean)}
            {history.leagueHistory.every(
              (year) =>
                year.nationalChampion?.teamName !== viewedLeagueTeamName &&
                !year.conferenceChampions.some((c) => c.winningTeamName === viewedLeagueTeamName),
            ) && (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No national or conference titles for this program in the tracked years.
              </p>
            )}
          </div>
        </SurfaceCard>
      )}

      <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 px-5 py-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        All-time school title counts are not exposed by the readable dynasty save yet, so title totals on this page are
        shown as dynasty-era results only.
      </div>

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          Historical Summary
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label="Program Record" value={formatRecord(history.dynastyWins, history.dynastyLosses)} />
          <StatTile
            label="Schools Coached"
            value={String(history.schoolsCoached.length)}
          />
          <StatTile label="Conference Titles" value={String(history.dynastyConferenceTitles)} />
          <StatTile label="National Titles" value={String(history.dynastyNationalTitles)} />
          <StatTile label="Bowl Appearances" value={String(history.dynastyBowlAppearances)} />
          <StatTile label="Playoff Appearances" value={String(history.dynastyPlayoffAppearances)} />
          <StatTile label="10-Win Seasons" value={String(history.dynastyTenWinSeasons)} />
        </div>
        {history.schoolsCoached.length > 1 && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Schools: {history.schoolsCoached.join(' -> ')}
          </p>
        )}
      </div>

      <ProgramHonors history={history} />

      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          School Record Book
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Verified team records from the save itself.
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          The game&apos;s own single-game record book tracks the player, position, year, and value only — it doesn&apos;t
          carry opponent, week, or final-score context, so game records below can&apos;t show a matchup.
        </p>
        <div className="mt-4 space-y-4">
          {history.records.map((category) => (
            <RecordBookRow key={category.key} category={category} />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SurfaceCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Dynasty Timeline
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Every season in the archive, newest first.
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50/85 text-slate-500 dark:bg-white/5 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3 text-left type-eyebrow">Season</th>
                  <th className="px-4 py-3 text-left type-eyebrow">Record</th>
                  <th className="px-4 py-3 text-left type-eyebrow">Conf</th>
                  <th className="px-4 py-3 text-left type-eyebrow">Coach</th>
                  <th className="px-4 py-3 text-left type-eyebrow">AP</th>
                  <th className="px-4 py-3 text-left type-eyebrow">Coaches</th>
                  <th className="px-4 py-3 text-left type-eyebrow">CFP</th>
                  <th className="px-4 py-3 text-left type-eyebrow">Postseason</th>
                  <th className="px-5 py-3 text-left type-eyebrow">Honors</th>
                </tr>
              </thead>
              <tbody>
                {history.seasons.map((season) => (
                  <tr
                    key={season.seasonYear}
                    className="border-t border-slate-200/80 bg-white/40 dark:border-white/5 dark:bg-transparent"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">{season.seasonYear}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {formatRecord(season.wins, season.losses)}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {formatRecord(season.conferenceWins, season.conferenceLosses)}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{season.headCoachName ?? 'Unknown'}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatRank(season.mediaRank)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatRank(season.coachesRank)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{formatRank(season.cfpRank)}</td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {season.postseasonSummary ?? season.bowlAppearance ?? 'No postseason game imported'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {season.nationalChampion && (
                          <span className="border border-amber-300/70 bg-amber-100/80 px-2.5 py-1 type-eyebrow text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            National Champs
                          </span>
                        )}
                        {season.conferenceChampion && (
                          <span className="border border-sky-300/70 bg-sky-100/80 px-2.5 py-1 type-eyebrow text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                            Conference Champs
                          </span>
                        )}
                        {season.playoffAppearance && (
                          <span className="border border-emerald-300/70 bg-emerald-100/80 px-2.5 py-1 type-eyebrow text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Playoff
                          </span>
                        )}
                        {!season.nationalChampion && !season.conferenceChampion && !season.playoffAppearance && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Dynasty Milestones
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            The biggest beats from your dynasty run.
          </h3>
          <div className="mt-4 space-y-3">
            {history.milestones.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No major milestones logged yet. Import more seasons to build the archive out.
              </p>
            ) : (
              history.milestones.map((milestone, index) => (
                <MilestoneRow key={`${milestone.seasonYear}-${milestone.label}-${index}`} milestone={milestone} />
              ))
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          League History
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          National and conference champions, every year the save remembers.
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Sourced from the save&apos;s own league-wide history — available even for seasons never individually synced
          (marked &quot;History Only&quot; above).
        </p>
        {history.leagueHistory.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No league history available yet.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.leagueHistory.map((year) => (
              <LeagueHistoryRow key={year.seasonYear} year={year} />
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
