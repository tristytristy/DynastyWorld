import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageMasthead } from '../components/common/PageMasthead';
import { useViewedTeam } from '../data/ViewedTeamProvider';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { TeamLink } from '../components/common/TeamLink';
import { useCustomRivals } from '../data/CustomRivalsProvider';
import { canonicalKey } from '../lib/assetMapping';
import { getRivalryLogoPath, getRivalryName } from '../lib/rivalryAssetMapping';
import type { HeadToHeadOpponent } from '../../shared/types';

function seriesLine(o: HeadToHeadOpponent): string {
  return o.ties > 0 ? `${o.wins}-${o.losses}-${o.ties}` : `${o.wins}-${o.losses}`;
}

/** Green when the user is ahead in the series, red when behind, neutral when even. */
function seriesTone(o: HeadToHeadOpponent): string {
  if (o.wins > o.losses) return 'text-emerald-600 dark:text-emerald-400';
  if (o.losses > o.wins) return 'text-red-600 dark:text-red-400';
  return 'text-slate-700 dark:text-slate-200';
}

function StreakBadge({ o }: { o: HeadToHeadOpponent }) {
  if (!o.streakType || o.streakCount === 0) return null;
  const cls =
    o.streakType === 'W'
      ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : o.streakType === 'L'
        ? 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
        : 'border-slate-300/70 bg-slate-100/70 text-slate-700 dark:border-slate-600 dark:bg-white/5 dark:text-slate-300';
  return (
    <span className={`shrink-0 border px-2 py-0.5 text-xs font-bold ${cls}`}>
      {o.streakCount}{o.streakType} streak
    </span>
  );
}

function marginText(avg: number): { text: string; cls: string } {
  const rounded = avg.toFixed(1);
  if (avg > 0.05) return { text: `+${rounded}`, cls: 'text-emerald-600 dark:text-emerald-400' };
  if (avg < -0.05) return { text: rounded, cls: 'text-red-600 dark:text-red-400' };
  return { text: '±0.0', cls: 'text-slate-500 dark:text-slate-400' };
}

function GameList({ o }: { o: HeadToHeadOpponent }) {
  return (
    <div className="mt-3 space-y-1">
      {o.games.map((g, i) => (
        <div
          key={`${g.seasonYear}-${g.week}-${i}`}
          className="flex items-center justify-between gap-3 border border-slate-200/70 bg-slate-50/70 px-2.5 py-1.5 text-sm dark:border-slate-800 dark:bg-white/5"
        >
          <span className="tnum shrink-0 text-xs font-semibold text-slate-400 dark:text-slate-500">{g.seasonYear}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {g.neutral ? 'N' : g.isHome ? 'vs' : '@'} {g.bowlName ? g.bowlName : `Wk ${g.week}`}
          </span>
          <span
            className={`shrink-0 text-xs font-bold ${g.result === 'W' ? 'text-emerald-600 dark:text-emerald-400' : g.result === 'L' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}
          >
            {g.result}
          </span>
          <span className="tnum shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {g.teamScore}-{g.opponentScore}
          </span>
        </div>
      ))}
    </div>
  );
}

function RivalCard({ o, userTeamName }: { o: HeadToHeadOpponent; userTeamName: string | null }) {
  const margin = marginText(o.avgMargin);
  /*
    THE USER'S NAME AND MARK WIN over the save's, resolved through the same two
    functions the Schedule and Game Info use. A rivalry someone named "The
    Battle for the Bell" reads that way here too, and the shield they uploaded
    for it is the shield on the card — otherwise this page would be the one
    place in the app that ignored their own rivalry.
  */
  const name = userTeamName ? getRivalryName(userTeamName, o.opponentName, o.rivalryName) : o.rivalryName;
  const logo = userTeamName ? getRivalryLogoPath(userTeamName, o.opponentName, o.isRival) : null;
  return (
    <SurfaceCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* TeamLink draws its own logo — the standalone one that used to sit
              to its left rendered the same mark twice at two sizes, the same
              duplication already fixed in the All-time series table. It carries
              the card's identity mark now, sized up to what that logo was. */}
          <h3 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
            <TeamLink
              teamIndex={o.opponentTeamIndex ?? undefined}
              teamName={o.opponentName}
              size="md"
              className="gap-3"
              logoClassName="!h-10 !w-10"
            />
          </h3>
          {name && <p className="type-eyebrow text-[var(--team-accent-text)]">{name}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {logo && <img src={logo} alt="" className="h-9 w-9 object-contain" draggable={false} />}
          <StreakBadge o={o} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`type-stat-sm ${seriesTone(o)}`}>{seriesLine(o)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">series</p>
        </div>
        <div>
          <p className={`type-stat-sm ${margin.cls}`}>{margin.text}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">avg margin</p>
        </div>
        <div>
          <p className="type-stat-sm text-slate-700 dark:text-slate-200">{o.games.length}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">meeting{o.games.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      <GameList o={o} />
    </SurfaceCard>
  );
}

export function Rivalries() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<HeadToHeadOpponent[] | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setData(undefined);
    window.api.db.getHeadToHead(id).then((r) => {
      if (!cancelled) setData(r ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Head-to-head is always the USER's series (getHeadToHead walks their own
  // schedules), so the mark follows the user's team rather than the viewed one.
  const { userTeamName } = useViewedTeam();

  /*
    A RIVAL IS EITHER THE SAVE'S OR THE USER'S, and this page has to honour
    both. `isRival` is the save's three designated slots; anything the user
    declared in the Program editor belongs in the same section, because from
    their side they are the same kind of thing.

    A DECLARED RIVAL WITH NO MEETINGS STILL APPEARS. getHeadToHead only walks
    opponents actually played, so a rivalry someone named before the two teams
    ever met would be invisible on the page named after it — the one place they
    would go looking for it. Those get a synthetic 0-0 entry: honest (there is
    no series yet), and the card still carries the name and the mark.
  */
  const { rivals: customRivals } = useCustomRivals();
  const userKey = userTeamName ? canonicalKey(userTeamName) : null;
  const mine = userKey
    ? customRivals.filter((r) => r.teamNameKey === userKey || r.opponentNameKey === userKey)
    : [];
  const customOpponentKeys = new Set(
    mine.map((r) => (r.teamNameKey === userKey ? r.opponentNameKey : r.teamNameKey)),
  );
  const isCustom = (o: HeadToHeadOpponent) => customOpponentKeys.has(canonicalKey(o.opponentName));

  const playedKeys = new Set((data ?? []).map((o) => canonicalKey(o.opponentName)));
  const unplayed: HeadToHeadOpponent[] = mine
    .map((r) => {
      const opponentName = r.teamNameKey === userKey ? r.opponentName : r.teamName;
      const opponentTeamIndex = r.teamNameKey === userKey ? r.opponentTeamIndex : r.teamIndex;
      return { opponentName, opponentTeamIndex };
    })
    .filter((r) => !playedKeys.has(canonicalKey(r.opponentName)))
    .map(({ opponentName, opponentTeamIndex }) => ({
      opponentTeamIndex,
      opponentName,
      isRival: false,
      rivalryName: null,
      wins: 0,
      losses: 0,
      ties: 0,
      avgMargin: 0,
      streakType: null,
      streakCount: 0,
      games: [],
    }));

  const rivals = [...(data ?? []).filter((o) => o.isRival || isCustom(o)), ...unplayed];
  const others = (data ?? []).filter((o) => !o.isRival && !isCustom(o));

  return (
    <div className="space-y-6">
      <PageMasthead
        eyebrow="Rivalries & Head-to-Head"
        title={userTeamName ?? 'Rivalries'}
        subtitle="Every series you've built"
        description="All-time record vs every opponent you've played across your synced seasons — series record, current streak, and average margin. Your program's designated rivals lead the way. Only this app keeps the per-season schedule history that makes this possible."
        mark={{ kind: 'helmet', teamAssetName: userTeamName ?? '' }}
      />

      {data === undefined ? (
        <p className="text-slate-500 dark:text-slate-400">Loading rivalries…</p>
      ) : /* `rivals` and not `data`: a rivalry declared before either team has
            played would otherwise hit the "no games recorded" empty state and
            vanish, which is the one outcome the synthetic entries above exist
            to prevent. */
      data.length === 0 && rivals.length === 0 ? (
        <SurfaceCard className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No games recorded yet. Sync a season with played games and your head-to-head history fills in — and grows every year.
        </SurfaceCard>
      ) : (
        <>
          {rivals.length > 0 && (
            <div>
              <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">Your rivals</p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rivals.map((o) => (
                  <RivalCard key={o.opponentTeamIndex ?? o.opponentName} o={o} userTeamName={userTeamName ?? null} />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="type-eyebrow mb-3 text-slate-400 dark:text-slate-500">All-time series</p>
            <SurfaceCard className="overflow-hidden p-0">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--team-primary)] text-[var(--team-on-primary)]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em]">Opponent</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Series</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Streak</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Avg Margin</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.14em]">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {others.map((o) => {
                      const margin = marginText(o.avgMargin);
                      return (
                        <tr key={o.opponentTeamIndex ?? o.opponentName} className="border-b border-slate-200/60 dark:border-white/5">
                          <td className="px-3 py-2">
                            {/* TeamLink draws its own logo, so the standalone one
                                that used to sit here rendered the same mark twice
                                at two sizes. */}
                            <TeamLink
                              teamIndex={o.opponentTeamIndex ?? undefined}
                              teamName={o.opponentName}
                              nameClassName="truncate"
                            />
                          </td>
                          <td className={`tnum px-3 py-2 text-right font-semibold ${seriesTone(o)}`}>{seriesLine(o)}</td>
                          <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                            {o.streakType ? `${o.streakCount}${o.streakType}` : '—'}
                          </td>
                          <td className={`tnum px-3 py-2 text-right ${margin.cls}`}>{margin.text}</td>
                          <td className="tnum px-3 py-2 text-right text-slate-500 dark:text-slate-400">{o.games.length}</td>
                        </tr>
                      );
                    })}
                    {others.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                          Only rivalry games recorded so far.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          </div>
        </>
      )}
    </div>
  );
}
