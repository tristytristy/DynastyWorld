import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoachPortrait } from '../../components/common/CoachPortrait';
import { TeamLogo } from '../../components/common/TeamLogo';
import { EditButton, coachKey, spaceCamelCase } from '../../components/common/CoachCard';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useSelectedSeason } from '../../data/SelectedSeasonProvider';
import { useCachedFetch, useCoachHubReady, useSeasonCoaches } from './coachData';
import { TONE_CLASS, jobSecurityEvaluation, jobSecurityLabel, jobSecurityTone, ordinal, recordLine, tenureYearFrom } from './coachMetrics';
import { bestWin, pulseSentence, recentForm, scoringMargin, unitSnapshot, type FormGame } from './coachOverviewMetrics';
import type { NationalTeamStatRow, ProgramHistoryOverview, ScheduleOverview } from '../../../shared/types';

/**
 * Coach Overview — the command centre. One question: how am I doing right now?
 *
 * WHAT IS DELIBERATELY NOT HERE: the full career record, the staff grid, the
 * coaching tree, the season-by-season résumé. Each has a destination now, and
 * Overview teases them at most one card deep. The old page tried to be all five
 * at once and was 788 lines of scroll for it.
 *
 * LOADING SHAPE: the shell has already resolved identity, so this page paints
 * from `overview` + `coaches` immediately and every card below fills in as its
 * own request lands — nothing here blocks the hero. The national table is the
 * expensive one (it walks the whole league to compute ranks), so it arrives
 * last and the snapshot card simply appears when it does.
 */
export function CoachOverview() {
  const { dynastyId, seasonId, overview, userCoach, career, staff, editCoach, openCardbook, openScandals } =
    useCoachHubReady();
  const { seasons } = useSelectedSeason();
  // The light all-seasons load: tenure only, no per-season schedules.
  const tenureByCoach = useSeasonCoaches();
  const cached = useCachedFetch();

  const [schedule, setSchedule] = useState<ScheduleOverview | null | undefined>(undefined);
  const [national, setNational] = useState<NationalTeamStatRow[] | null | undefined>(undefined);
  const [priorNational, setPriorNational] = useState<NationalTeamStatRow[] | null>(null);
  const [history, setHistory] = useState<ProgramHistoryOverview | null>(null);

  useEffect(() => {
    if (!dynastyId) return;
    let cancelled = false;
    setSchedule(undefined);
    cached(`schedule:${dynastyId}:${seasonId ?? 'current'}`, () => window.api.db.getSchedule(dynastyId, seasonId)).then((r) => {
      if (!cancelled) setSchedule(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, cached]);

  // The season immediately before the one on screen, for change-vs-last-year.
  // History-only seasons are skipped: they carry no per-game stats to compare.
  const priorSeasonId = useMemo(() => {
    const current = seasons.find((s) => s.id === seasonId) ?? seasons.find((s) => s.isCurrent);
    if (!current) return undefined;
    const earlier = seasons
      .filter((s) => s.hasFullData && s.seasonYear < current.seasonYear)
      .sort((a, b) => b.seasonYear - a.seasonYear);
    return earlier[0]?.id;
  }, [seasons, seasonId]);

  useEffect(() => {
    if (!dynastyId) return;
    let cancelled = false;
    setNational(undefined);
    setPriorNational(null);
    cached(`national:${dynastyId}:${seasonId ?? 'current'}`, () =>
      window.api.db.getNationalTeamStats(dynastyId, seasonId),
    ).then((r) => {
      if (!cancelled) setNational(r);
    });
    if (priorSeasonId !== undefined) {
      cached(`national:${dynastyId}:${priorSeasonId}`, () =>
        window.api.db.getNationalTeamStats(dynastyId, priorSeasonId),
      ).then((r) => {
        if (!cancelled) setPriorNational(r);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [dynastyId, seasonId, priorSeasonId, cached]);

  // The milestone is the one genuinely optional card, so it loads last and the
  // page never waits on it.
  useEffect(() => {
    if (!dynastyId) return;
    let cancelled = false;
    cached(`history:${dynastyId}`, () => window.api.db.getHistory(dynastyId)).then((r) => {
      if (!cancelled) setHistory(r);
    });
    return () => {
      cancelled = true;
    };
  }, [dynastyId, cached]);

  const tenureYear = userCoach
    ? tenureYearFrom(tenureByCoach?.get(coachKey(userCoach)), overview.seasonYear, userCoach.seasonsWithTeam)
    : null;

  const teamIndex = userCoach?.teamIndex ?? null;
  const units = unitSnapshot(national ?? null, teamIndex);
  const priorUnits = unitSnapshot(priorNational, teamIndex);

  const pulse = pulseSentence({
    teamName: overview.teamName,
    coachLastName: userCoach?.lastName ?? null,
    tenureYear,
    schedule: schedule ?? null,
  });

  const form = recentForm(schedule ?? null);
  const margin = scoringMargin(schedule ?? null);
  const signature = bestWin(schedule ?? null);
  const rank = overview.rankings.media ?? overview.rankings.cfp ?? overview.rankings.coaches;

  const coordinators = staff.filter((c) => c.position === 'OffensiveCoordinator' || c.position === 'DefensiveCoordinator');
  // "Latest" means the most recent SEASON, not the last array element — the
  // milestone list is grouped by kind, not sorted by year, so taking the tail
  // showed a 2026 playoff run while the page was displaying 2027. Ties keep
  // their original order, so the later entry of a shared year still wins.
  const latestMilestone = useMemo(() => {
    const all = history?.milestones ?? [];
    return all.reduce<(typeof all)[number] | null>(
      (best, m) => (best === null || m.seasonYear >= best.seasonYear ? m : best),
      null,
    );
  }, [history]);

  return (
    <div className="space-y-6">
      {/* ── HERO ─────────────────────────────────────────────────────────────
          Identity on the left, LIVE CONTEXT on the right. The right column used
          to be empty space with two large buttons floating in it; the record,
          rank, security and contract are what a coach actually opens this page
          for, so they take that room and the actions shrink to one quiet group. */}
      <SurfaceCard>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            {userCoach ? (
              /* HALF AGAIN THE SHARED `lg` (112px → 168px), as an override on
                 this one instance rather than a change to the size itself: `lg`
                 is the staff cards' size too, and a coordinator's headshot
                 growing 50% because the head coach's masthead wanted to would be
                 the opposite of the point. He is the main character HERE. */
              <CoachPortrait
                coach={userCoach}
                teamAssetName={overview.teamName}
                size="lg"
                className="!h-[10.5rem] !w-[10.5rem]"
              />
            ) : (
              <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="lg" />
            )}
            <div className="min-w-0">
              <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coach</p>
              {/* `group/name` so the pencil answers to THIS line rather than to
                  the whole hero — hovering anywhere in the masthead revealing an
                  edit control would be a much bigger target than the thing it
                  edits. */}
              <div className="group/name mt-1.5 flex items-center gap-2">
                <h2 className="font-display text-page-title font-bold leading-tight text-slate-950 dark:text-white">
                  {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}
                </h2>
                {userCoach && (
                  <span className="opacity-0 transition-opacity duration-fast ease-standard group-hover/name:opacity-100 focus-within:opacity-100">
                    <EditButton
                      onClick={() => editCoach(userCoach)}
                      label={`Edit ${userCoach.firstName} ${userCoach.lastName}`}
                    />
                  </span>
                )}
              </div>
              {userCoach && (
                <p className="mt-1.5 text-sm font-semibold text-[var(--team-accent-text)]">
                  {spaceCamelCase(userCoach.position)}
                </p>
              )}
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {overview.teamName}
                {tenureYear !== null ? ` · ${ordinal(tenureYear)} year` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-4">
            {/*
              CARDBOOK AND SCANDALS SIT ABOVE THE FACTS, restored after a spell
              underneath them (user direction 2026-08-03). Below the facts they
              were the last thing in a column that had already made its point,
              and they read as an afterthought stuck to the bottom edge; up here
              they sit level with the coach's name and balance it.

              EDIT COACH IS STILL NOT HERE. Editing the coach is not a
              destination, it is a correction to the record beside his name —
              so it stays the pencil, on hover, as the staff cards do it.
            */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openCardbook}
                title="Your card book — every card you've starred"
                className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
              >
                Cardbook
              </button>
              {userCoach && (
                <button
                  type="button"
                  onClick={openScandals}
                  title="Off-the-books adjustments — writes to your save"
                  className="corner-cut-sm border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 dark:border-red-500/40 dark:text-red-300"
                >
                  Scandals
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <HeroFact label="Record" value={recordLine(overview.record.wins, overview.record.losses)} />
            <HeroFact
              label="Conference"
              value={recordLine(overview.conferenceRecord.wins, overview.conferenceRecord.losses)}
            />
            <HeroFact label="Ranking" value={rank && rank > 0 ? `#${rank}` : 'Unranked'} />
            <HeroFact
              label="Contract"
              value={
                userCoach && userCoach.contractLength > 0 ? `${userCoach.contractYearsRemaining} yr` : '—'
              }
            />
            </div>
          </div>
        </div>

        {/* The generated line — only ever from confirmed values, and absent
            entirely before the first game of the season is played. */}
        {pulse && (
          <p className="mt-6 border-t border-[color:var(--section-divider)] pt-4 text-base text-slate-700 dark:text-slate-200">
            {pulse}
          </p>
        )}

        {userCoach && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                TONE_CLASS[jobSecurityEvaluation(userCoach.currentJobSecurityStatus).tone]
              }`}
            >
              {jobSecurityEvaluation(userCoach.currentJobSecurityStatus).label}
            </span>
            <span
              className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                TONE_CLASS[jobSecurityTone(userCoach.currentJobSecurityStatus)]
              }`}
            >
              {jobSecurityLabel(userCoach.currentJobSecurityStatus)}
              {userCoach.currentJobSecurityPercentage !== null ? ` · ${userCoach.currentJobSecurityPercentage}%` : ''}
            </span>
            {career && career.timesFired > 0 && (
              <span className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${TONE_CLASS.warn}`}>
                Fired {career.timesFired}×
              </span>
            )}
          </div>
        )}
      </SurfaceCard>

      {/* ── SEASON TRAJECTORY ───────────────────────────────────────────── */}
      {form.length > 0 && (
        <SurfaceCard>
          <SectionHead
            eyebrow="Season trajectory"
            title="Recent form"
            to={`/dynasty/${dynastyId}/coach/season`}
            linkLabel="Full season"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {form.map((game) => (
              <FormChip key={game.gameId} game={game} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Fact
              label="Streak"
              value={
                schedule?.currentStreak.type && schedule.currentStreak.count > 0
                  ? `${schedule.currentStreak.count} ${schedule.currentStreak.type === 'W' ? 'wins' : 'losses'}`
                  : '—'
              }
            />
            <Fact
              label="Scoring margin"
              value={margin === null ? '—' : `${margin > 0 ? '+' : ''}${margin.toFixed(1)} per game`}
            />
            {signature && (
              <Fact
                label={signature.rank ? `Best win (vs #${signature.rank})` : 'Biggest win'}
                value={`${signature.game.teamScore}-${signature.game.opponentScore} ${
                  signature.game.isHome ? 'vs' : 'at'
                } ${signature.game.opponent}`}
              />
            )}
          </div>
        </SurfaceCard>
      )}

      {/* ── PROGRAM PERFORMANCE ─────────────────────────────────────────── */}
      {units && (
        <SurfaceCard>
          <SectionHead eyebrow="Program performance" title={`${overview.seasonYear} offense and defense`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <UnitMetric
              label="Points / game"
              value={units.pointsPerGame}
              rank={units.pointsRank}
              delta={priorUnits ? units.pointsPerGame - priorUnits.pointsPerGame : null}
              higherIsBetter
            />
            <UnitMetric
              label="Points allowed / game"
              value={units.pointsAllowedPerGame}
              rank={units.pointsAllowedRank}
              delta={priorUnits ? units.pointsAllowedPerGame - priorUnits.pointsAllowedPerGame : null}
              higherIsBetter={false}
            />
            <UnitMetric
              label="Yards / game"
              value={units.yardsPerGame}
              rank={units.yardsRank}
              delta={priorUnits ? units.yardsPerGame - priorUnits.yardsPerGame : null}
              higherIsBetter
            />
            <UnitMetric
              label="Yards allowed / game"
              value={units.yardsAllowedPerGame}
              rank={units.yardsAllowedRank}
              delta={priorUnits ? units.yardsAllowedPerGame - priorUnits.yardsAllowedPerGame : null}
              higherIsBetter={false}
            />
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Ranks are among all FBS teams this season.
            {priorUnits ? ' Change is against the previous tracked season.' : ''}
          </p>
        </SurfaceCard>
      )}

      {/* ── STAFF SNAPSHOT ──────────────────────────────────────────────── */}
      {coordinators.length > 0 && (
        <SurfaceCard>
          <SectionHead
            eyebrow="Staff"
            title="Your coordinators"
            to={`/dynasty/${dynastyId}/coach/staff`}
            linkLabel="Full staff"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {coordinators.map((coach) => {
              const isOffense = coach.position === 'OffensiveCoordinator';
              return (
                <div
                  key={coach.position}
                  className="corner-cut-sm flex items-center gap-3 border border-slate-200/80 bg-slate-50/85 p-3 dark:border-slate-800 dark:bg-white/5"
                >
                  <CoachPortrait coach={coach} teamAssetName={overview.teamName} size="sm" className="!h-11 !w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {coach.firstName} {coach.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {spaceCamelCase(coach.position)} ·{' '}
                      {ordinal(
                        tenureYearFrom(tenureByCoach?.get(coachKey(coach)), overview.seasonYear, coach.seasonsWithTeam),
                      )}{' '}
                      year
                    </p>
                  </div>
                  {units && (
                    <div className="shrink-0 text-right">
                      <p className="tnum font-display text-lg font-bold text-slate-900 dark:text-white">
                        {(isOffense ? units.pointsPerGame : units.pointsAllowedPerGame).toFixed(1)}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                        {isOffense ? 'PPG' : 'PA/G'}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* ── CAREER TEASER ───────────────────────────────────────────────── */}
      {career && (
        <SurfaceCard>
          <SectionHead
            eyebrow="Career"
            title="Lifetime"
            to={`/dynasty/${dynastyId}/coach/career`}
            linkLabel="Full career"
          />
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
            <Fact label="Record" value={recordLine(career.wins, career.losses)} big />
            <Fact
              label="Win rate"
              value={
                career.wins + career.losses > 0
                  ? `${Math.round((career.wins / (career.wins + career.losses)) * 1000) / 10}%`
                  : '—'
              }
              big
            />
            <Fact label="Bowls" value={recordLine(career.bowlWins, career.bowlLosses)} big />
            <Fact label="Conference titles" value={String(career.confChampWins)} big />
            <Fact label="National titles" value={String(career.ncWins)} big />
          </div>
        </SurfaceCard>
      )}

      {/* ── LATEST MILESTONE ────────────────────────────────────────────── */}
      {latestMilestone && (
        <SurfaceCard>
          <SectionHead
            eyebrow="Latest milestone"
            title={latestMilestone.label}
            to={`/dynasty/${dynastyId}/coach/milestones`}
            linkLabel="Milestones"
          />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {latestMilestone.seasonYear} · {latestMilestone.detail}
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}


/** A big number in the hero's live-context column. */
function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p className="tnum mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Fact({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <p
        className={`tnum mt-1 font-semibold text-slate-900 dark:text-white ${
          big ? 'font-display text-xl' : 'text-sm'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  to,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  to?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">{eyebrow}</p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
      </div>
      {to && linkLabel && (
        <Link
          to={to}
          className="text-xs font-semibold text-[var(--team-accent-text)] underline-offset-4 hover:underline"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function FormChip({ game }: { game: FormGame }) {
  const won = game.result === 'W';
  return (
    <span
      title={`Week ${game.week} ${game.isHome ? 'vs' : 'at'} ${game.opponent} — ${game.teamScore}-${game.opponentScore}`}
      className={`corner-cut-sm inline-flex items-center gap-2 border px-2.5 py-1.5 text-xs ${
        won
          ? 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
      }`}
    >
      <span className="font-display font-bold">{game.result}</span>
      <span className="tnum">
        {game.teamScore}-{game.opponentScore}
      </span>
      <span className="max-w-[9rem] truncate opacity-80">
        {game.isHome ? 'vs' : 'at'} {game.opponent}
      </span>
    </span>
  );
}

/**
 * One offence/defence number with its national rank and its movement since last
 * season. Direction is interpreted PER METRIC — conceding four fewer points is
 * an improvement even though the number went down — which is exactly the trap
 * the spec calls out for unit comparisons.
 */
function UnitMetric({
  label,
  value,
  rank,
  delta,
  higherIsBetter,
}: {
  label: string;
  value: number;
  rank: number | null;
  delta: number | null;
  higherIsBetter: boolean;
}) {
  const rounded = delta === null ? null : Math.round(delta * 10) / 10;
  const improved = rounded === null || rounded === 0 ? null : higherIsBetter ? rounded > 0 : rounded < 0;
  return (
    <div className="corner-cut-sm border border-slate-200/80 bg-slate-50/85 p-4 dark:border-slate-800 dark:bg-white/5">
      <p className="type-eyebrow text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="tnum type-stat-md text-slate-950 dark:text-white">{value.toFixed(1)}</p>
        {rank !== null && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">#{rank}</span>
        )}
      </div>
      {rounded !== null && rounded !== 0 && (
        <p
          className={`tnum mt-1 text-xs font-semibold ${
            improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {rounded > 0 ? '+' : ''}
          {rounded.toFixed(1)} vs last season
        </p>
      )}
    </div>
  );
}
