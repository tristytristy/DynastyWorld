import { CoachPortrait } from '../../components/common/CoachPortrait';
import { TeamLogo } from '../../components/common/TeamLogo';
import { TeamLink } from '../../components/common/TeamLink';
import { spaceCamelCase } from '../../components/common/CoachCard';
import { StatTile } from '../../components/ui/StatTile';
import { yearsSpan } from './coachMetrics';
import type { CoachingTree, CoachingTreeEntry, CoachingTreeStop } from '../../../shared/types';

/**
 * The coaching-tree branches — where your former staffers went, head-coach
 * promotions first.
 *
 * Lives on STAFF (user direction 2026-08-02), behind the Current/Tree switch:
 * the people who work for you and the people who used to are the same question
 * asked at two points in time, so they belong in one destination rather than
 * two tabs apart.
 */
export function CoachingTreePanel({ tree }: { tree: CoachingTree }) {
  if (tree.entries.length === 0) {
    return (
      <>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Where your people go
        </h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          As assistants leave your staff for jobs elsewhere, they&apos;ll branch out here — with the role they held under
          you and where they landed. Sync each season and your tree grows.
        </p>
      </>
    );
  }

  return (
    <>
      {/*
        EYEBROW ONLY, AND NO ROOT NODE (user direction).

        "Where your people went" restated the eyebrow directly above it in a
        longer sentence, and the boxed root underneath it — your name, your team,
        in a team-coloured frame — was the third time this screen said who you
        are: the Coach Hub's identity line already carries the name, the role,
        the school and the year a few pixels higher. Every branch below already
        reads as descending from you, which is the only job that node had.

        The counts stay. They are the one thing here that is not repeated
        anywhere else on the page.
      */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
        <div className="flex gap-3">
          <StatTile label="Coaches produced" value={String(tree.coachesProduced)} />
          <StatTile label="Now head coaches" value={String(tree.headCoachesProduced)} />
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {tree.entries.map((e) => (
          <TreeBranch key={e.presentationId} entry={e} />
        ))}
      </div>
    </>
  );
}

function TreeBranch({ entry: e }: { entry: CoachingTreeEntry }) {
  return (
    <div
      className={`flex flex-col gap-3 border-l-[3px] bg-slate-50/70 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between ${
        e.isHeadCoachNow
          ? 'border-l-amber-400 border-y border-r border-y-amber-300/40 border-r-amber-300/40 dark:border-y-amber-500/25 dark:border-r-amber-500/25'
          : 'border-l-[var(--team-primary)]/60 border-y border-r border-y-slate-200/70 border-r-slate-200/70 dark:border-y-slate-800 dark:border-r-slate-800'
      }`}
    >
      {/* Left: the coach + role under you */}
      <div className="flex min-w-0 items-center gap-3">
        <CoachPortrait
          coach={{
            firstName: e.name.split(' ')[0] ?? '',
            lastName: e.name.split(' ').slice(1).join(' '),
            portraitAssetName: e.portraitAssetName,
          }}
          size="sm"
          className="!h-10 !w-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{e.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            Your {e.positionsUnderYou.map(spaceCamelCase).join(' / ')} · {yearsSpan(e.firstYearWithYou, e.lastYearWithYou)}
          </p>
          <HeadCoachRecord entry={e} />
        </div>
      </div>

      {/* Right: the journey — every stop since they left, oldest first */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 sm:justify-end">
        {e.journey.length > 0 ? (
          e.journey.map((stop, i) => (
            <div key={`${stop.teamIndex}-${stop.firstYear}-${stop.position}`} className="flex items-center gap-2.5">
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">→</span>
              <JourneyStop stop={stop} isLast={i === e.journey.length - 1} />
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="hidden text-slate-300 dark:text-slate-600 sm:inline" aria-hidden="true">→</span>
            {e.nowTeamName && (
              <TeamLogo
                team={{ assetName: e.nowTeamName, label: e.nowTeamName }}
                size="sm"
                className="!h-6 !w-6 shrink-0"
              />
            )}
            <div className="min-w-0 text-left sm:text-right">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                <TeamLink
                  teamIndex={e.nowTeamIndex ?? undefined}
                  teamName={e.nowTeamName ?? 'Unknown'}
                  nameClassName="truncate"
                />
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {e.nowPosition ? spaceCamelCase(e.nowPosition) : 'Coach'}
                {e.nowSeasonYear ? ` · as of ${e.nowSeasonYear}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One stop on a coach's journey.
 *
 * The whole reason this is a chain rather than a destination: a coach who leaves
 * you for one job and then moves to a second has a story, and that story is part
 * of yours. Only the LAST stop carries the "Head Coach" flag — the earlier ones
 * are history, and marking them all current would read as him holding four jobs.
 */
function JourneyStop({ stop, isLast }: { stop: CoachingTreeStop; isLast: boolean }) {
  const span = stop.firstYear === stop.lastYear ? `'${String(stop.firstYear).slice(-2)}` : `'${String(stop.firstYear).slice(-2)}–'${String(stop.lastYear).slice(-2)}`;
  return (
    <div className="flex items-center gap-2">
      {stop.teamName && (
        <TeamLogo team={{ assetName: stop.teamName, label: stop.teamName }} size="sm" className="!h-6 !w-6 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
          {isLast && stop.isHeadCoach && (
            <span className="border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Head Coach
            </span>
          )}
          <TeamLink teamIndex={stop.teamIndex} teamName={stop.teamName ?? 'Unknown'} nameClassName="truncate" />
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {spaceCamelCase(stop.position)} · {span}
          {/* Records follow a HEAD COACH only — a coordinator doesn't own his
              team's results, which is precisely the mistake the save's own
              career field makes. */}
          {stop.isHeadCoach && stop.record && (
            <span className="tnum font-semibold text-slate-700 dark:text-slate-200">
              {' '}· {stop.record.wins}-{stop.record.losses}
            </span>
          )}
        </p>
        {stop.trophies.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1">
            {stop.trophies.map((t) => (
              <span
                key={`${t.seasonYear}-${t.label}`}
                title={`${t.seasonYear} ${t.label}`}
                className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  t.kind === 'national'
                    ? 'border-gold-300/60 bg-gold-300/10 text-gold-500 dark:text-gold-300'
                    : 'border-slate-300/70 bg-slate-100/70 text-slate-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                {t.kind === 'national' ? '★ Natty' : t.label} &apos;{String(t.seasonYear).slice(-2)}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A coach's total record in the big chair, across every job on his journey.
 *
 * ONLY WHEN HE HAS HELD MORE THAN ONE, because each stop already carries its own
 * record: with a single head-coaching job this line would print the same number
 * a few pixels to the right of itself. It earns its place the moment a career
 * spans two schools — which is exactly when a total starts saying something the
 * individual stops don't.
 *
 * Observed from the teams' own season records, never from `Coach.careerStats` —
 * that field is unusable for anybody but the user's own coach (see
 * getCoachingTree for the receipts).
 */
function HeadCoachRecord({ entry: e }: { entry: CoachingTreeEntry }) {
  const headCoachStops = e.journey.filter((s) => s.isHeadCoach && s.record !== null);
  const overall = e.headCoachRecord;
  if (headCoachStops.length < 2 || !overall) return null;

  return (
    <p
      className="tnum mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
      title="Across every head-coaching job, from the seasons this dynasty has synced."
    >
      {overall.wins}-{overall.losses}
      <span className="font-normal text-slate-400 dark:text-slate-500"> as a head coach</span>
    </p>
  );
}
