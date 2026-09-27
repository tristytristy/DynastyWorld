import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { PageHeader } from '../components/ui/PageHeader';
import { TeamLogo } from '../components/common/TeamLogo';
import type { LeagueHistoryView } from '../../shared/types';

/**
 * League History — the app's answer to the game's own "League History &
 * Records" screen (user pick, 2026-09-19). Champions year by year, most
 * titles of the dynasty era, the save's preloaded all-time program totals,
 * and — when the CFB 26 record book lives in the archive as a legacy
 * dynasty — thirty years of prior canon riding along in its own panel.
 */

function pct(wins: number, losses: number, ties: number): string {
  const games = wins + losses + ties;
  if (games === 0) return '—';
  return ((wins + ties / 2) / games).toFixed(3).replace(/^0/, '');
}

function TimelineRow({ row }: { row: LeagueHistoryView['timeline'][number] }) {
  const [showConfs, setShowConfs] = useState(false);
  const champ = row.nationalChampion;
  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0 dark:border-slate-800/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-14 shrink-0 proportional-nums text-lg font-bold tracking-tight text-slate-950 dark:text-white">
          {row.seasonYear}
        </span>
        {champ ? (
          <>
            <TeamLogo team={{ assetName: champ.teamName, label: champ.teamName }} size="sm" className="!h-6 !w-6" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{champ.teamName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {champ.wins}-{champ.losses}
              {champ.coachLastName ? ` · ${champ.coachFirstName ? `${champ.coachFirstName} ` : ''}${champ.coachLastName}` : ''}
            </span>
            {row.runnerUp && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                def. {row.runnerUp.teamName}
                {champ.score || row.runnerUp.score ? ` ${champ.score}-${row.runnerUp.score}` : ''}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">Season in progress — no champion yet</span>
        )}
        {row.heisman && (
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">🏆 Heisman: {row.heisman}</span>
        )}
      </div>
      {row.conferenceChampions.length > 0 && (
        <div className="mt-1.5 pl-14">
          <button
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            onClick={() => setShowConfs((v) => !v)}
          >
            {showConfs ? '▾' : '▸'} conference champions ({row.conferenceChampions.length})
          </button>
          {showConfs && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {row.conferenceChampions.map((c) => (
                <span
                  key={c.conferenceName}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  <TeamLogo team={{ assetName: c.winningTeamName, label: c.winningTeamName }} size="sm" className="!h-4 !w-4" />
                  <span className="font-semibold">{c.winningTeamName}</span>
                  <span className="text-slate-400 dark:text-slate-500">{c.conferenceName}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LeagueHistory() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<LeagueHistoryView | undefined>(undefined);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setView(undefined);
    window.api.db.getLeagueHistory(id).then((v) => !cancelled && setView(v));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const programs = useMemo(() => {
    if (!view) return [];
    const q = filter.trim().toLowerCase();
    return q ? view.programs.filter((p) => p.teamName.toLowerCase().includes(q)) : view.programs;
  }, [view, filter]);

  if (view === undefined) return <p className="text-slate-500 dark:text-slate-400">Opening the history books...</p>;

  const hasAnything = view.timeline.length > 0 || view.programs.length > 0;
  if (!hasAnything) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="League History" title="The history books are blank." description="Champions and all-time records appear here once a season is synced through its postseason." />
        <SurfaceCard className="text-sm text-slate-400 dark:text-slate-500">
          Sync a save to start the timeline — the all-time program table fills from your first full sync, and each
          finished season adds its champion.
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="League History"
        title="Champions, dynasties, and the all-time ledger."
        description="Every archived season's national champion, the era's title counts, and the all-time program totals the save itself keeps — real history the game preloaded, updated as your dynasty runs."
      />

      {/* champions timeline */}
      {view.timeline.length > 0 && (
        <SurfaceCard>
          <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">National champions</h3>
          <div className="mt-3">
            {view.timeline.map((row) => (
              <TimelineRow key={row.seasonYear} row={row} />
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* most titles, this era */}
      {view.titleCounts.length > 0 && (
        <SurfaceCard>
          <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">Most titles — dynasty era</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.titleCounts.slice(0, 9).map((t) => (
              <div
                key={t.teamName}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5"
              >
                <TeamLogo team={{ assetName: t.teamName, label: t.teamName }} size="sm" className="!h-8 !w-8" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t.teamName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.titles} title{t.titles === 1 ? '' : 's'} · {t.years.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* the record book rides along */}
      {view.legacy && (
        <SurfaceCard>
          <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            From the record book — {view.legacy.label}
          </h3>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            The prior era, {view.legacy.firstYear}–{view.legacy.lastYear}, imported from the master document. Its most
            decorated: {view.legacy.titleCounts.slice(0, 3).map((t) => `${t.teamName} (${t.titles})`).join(', ')}.
          </p>
          <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {view.legacy.champions.map((c) => (
              <p key={c.seasonYear} className="flex items-baseline gap-2 text-sm">
                <span className="w-10 shrink-0 proportional-nums font-bold text-slate-700 dark:text-slate-300">{c.seasonYear}</span>
                <span className="truncate">
                  <span className="font-semibold text-slate-900 dark:text-white">{c.teamName}</span>
                  {c.runnerUp && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {' '}
                      def. {c.runnerUp}
                      {c.score ? ` ${c.score}` : ''}
                    </span>
                  )}
                </span>
              </p>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* all-time program table */}
      {view.programs.length > 0 && (
        <SurfaceCard>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">All-time programs</h3>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                The save&apos;s own program résumés — preloaded with real history, current through {view.programsAsOf}.
              </p>
            </div>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Find a school…"
              className="ml-auto border border-slate-300/80 bg-transparent px-3 py-1.5 text-sm dark:border-slate-600"
            />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Program</th>
                  <th className="py-2 pr-3 text-right font-semibold">W-L-T</th>
                  <th className="py-2 pr-3 text-right font-semibold">Pct</th>
                  <th className="py-2 pr-3 text-right font-semibold" title="National championships won (appearances)">Natl</th>
                  <th className="py-2 pr-3 text-right font-semibold" title="Conference titles won">Conf</th>
                  <th className="py-2 pr-3 text-right font-semibold" title="College Football Playoff appearances">CFPs</th>
                  <th className="py-2 pr-3 text-right font-semibold" title="Bowls won (made)">Bowls</th>
                  <th className="py-2 pr-3 text-right font-semibold" title="Heisman winners">Heis</th>
                  <th className="py-2 text-right font-semibold" title="Players drafted">Draft</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p, i) => (
                  <tr key={p.teamIndex} className="border-t border-slate-100 dark:border-slate-800/60">
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right text-xs text-slate-400 dark:text-slate-500">
                          {filter ? '' : i + 1}
                        </span>
                        <TeamLogo team={{ assetName: p.teamName, label: p.teamName }} size="sm" className="!h-5 !w-5" />
                        <span className="font-semibold text-slate-900 dark:text-white">{p.teamName}</span>
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">
                      {p.wins}-{p.losses}
                      {p.ties ? `-${p.ties}` : ''}
                    </td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">{pct(p.wins, p.losses, p.ties)}</td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">
                      {p.nationalTitles}
                      {p.nationalApps > p.nationalTitles ? ` (${p.nationalApps})` : ''}
                    </td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">{p.confTitles}</td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">{p.cfpsMade}</td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">
                      {p.bowlsWon} ({p.bowlsMade})
                    </td>
                    <td className="py-1.5 pr-3 text-right proportional-nums">{p.heismans}</td>
                    <td className="py-1.5 text-right proportional-nums">{p.playersDrafted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {programs.length === 0 && (
              <p className="py-3 text-sm text-slate-400 dark:text-slate-500">No school matches that search.</p>
            )}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
