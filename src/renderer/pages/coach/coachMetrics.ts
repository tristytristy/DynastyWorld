/**
 * Shared Coach Hub calculations — the pure half of what used to live inside the
 * single CoachHub.tsx file.
 *
 * These are here rather than in each destination because several of them are
 * needed by more than one: tenure by the hero AND the staff cards, the record
 * formatter by nearly everything, the tone palette by Overview's contract chips.
 * Duplicating any of them is what the refactor's code-quality rules forbid.
 *
 * Nothing in this file was redesigned during the split — the logic, and the
 * reasoning recorded against it, is carried over verbatim from the monolith.
 */
import { seasonOffenseYards } from '../../../shared/teamYards';
import { coachKey, spaceCamelCase, type CoachResume, type UnitStats } from '../../components/common/CoachCard';
import type { CoachOverview, ScheduleOverview } from '../../../shared/types';
import type { TeamStatsData } from '../../../extractors/extract-team-stats';

/** "'26" / "'26–'28" for a coach's tenure span. */
export function yearsSpan(a: number, b: number): string {
  const y = (n: number) => `'${String(n).slice(-2)}`;
  return a === b ? y(a) : `${y(a)}–${y(b)}`;
}

export function recordLine(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st"… */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** JobSecurityStatus enum -> a short career-status line. */
export function jobSecurityLabel(status: string): string {
  if (status === 'HotSeat') return 'On the Hot Seat';
  if (status === 'SafeForNow') return 'Safe For Now';
  return spaceCamelCase(status);
}

export type Tone = 'good' | 'ok' | 'warn' | 'bad';

/** The chip palette, shared by the AD's evaluation and the standing job-security status so the two read as one row. */
export const TONE_CLASS: Record<Tone, string> = {
  good: 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  ok: 'border-slate-300/70 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300',
  warn: 'border-amber-300/70 bg-amber-100/70 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  bad: 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
};

export function jobSecurityTone(status: string): Tone {
  if (status === 'HotSeat') return 'bad';
  if (status === 'Low') return 'warn';
  if (status === 'Safe') return 'good';
  return 'ok';
}

/** JobSecurityStatus enum → a short performance evaluation for the contract card. */
export function jobSecurityEvaluation(status: string): { label: string; tone: Tone } {
  if (status === 'Safe') return { label: 'Exceeding expectations', tone: 'good' };
  if (status === 'SafeForNow') return { label: 'Meeting expectations', tone: 'ok' };
  if (status === 'Low') return { label: 'At risk', tone: 'warn' };
  if (status === 'HotSeat') return { label: 'Critical — on the hot seat', tone: 'bad' };
  return { label: spaceCamelCase(status), tone: 'ok' };
}

/**
 * The two per-game numbers a coordinator is actually judged on, for the season
 * on screen: yards and points, on their own side of the ball.
 *
 * The offensive pair comes from the team's own season line; the defensive pair
 * is the same idea from the other direction — `defPassYards + defRushYards` is
 * what the defence GAVE UP, and points against come off the schedule, since the
 * team-stats snapshot carries yardage but not scoring. Games played is taken
 * from the finished games on the schedule rather than the record, so a
 * mid-season average divides by the games that have actually happened.
 */
export function buildUnitStats(
  teamStats: TeamStatsData | null,
  schedule: ScheduleOverview | null,
): UnitStats | null {
  if (!teamStats && !schedule) return null;
  const played = (schedule?.games ?? []).filter(
    (g) => g.teamScore !== null && g.opponentScore !== null,
  );
  const games = played.length;
  if (games === 0) return null;

  const per = (total: number) => Math.round((total / games) * 10) / 10;
  const pointsFor = played.reduce((sum, g) => sum + (g.teamScore ?? 0), 0);
  const pointsAgainst = played.reduce((sum, g) => sum + (g.opponentScore ?? 0), 0);

  return {
    offenseYardsPerGame: teamStats ? per(seasonOffenseYards(teamStats)) : null,
    pointsPerGame: per(pointsFor),
    defenseYardsPerGame: teamStats ? per(teamStats.defPassYards + teamStats.defRushYards) : null,
    pointsAgainstPerGame: per(pointsAgainst),
  };
}

/**
 * How many years into their run at this school a coach is, for the season being
 * viewed.
 *
 * NOT `seasonsWithTeam + 1`, which is what this used to be, and the reason a
 * coach read "2nd year" in both 2026 and 2027.
 *
 * WHAT THE SAVE ACTUALLY DOES, measured across a full Auburn cycle (W0 → W30 →
 * season 2 W0): `SeasonsWithTeam` counts **completed** seasons and it bumps
 * during the OFFSEASON of the season it belongs to, not at the next season's
 * start. Joel Gordon reads 0 at 2026 preseason, 1 by 2026's offseason, and still
 * 1 at 2027 preseason. So `+ 1` is correct for a season synced while it's being
 * played, and one too high for the same season synced after its offseason — and
 * the next season then repeats the number, which is exactly what was reported.
 *
 * The fix doesn't try to guess the phase (it isn't stored). It estimates the
 * coach's FIRST year here from each observation as `year - seasonsWithTeam`, and
 * takes the LATEST such estimate: an in-season observation gives the true first
 * year, a post-offseason one gives a year too early, and the maximum discards
 * the too-early answer as soon as any single in-season observation exists —
 * which one more synced season almost always provides. Tenure is then plain
 * arithmetic against the season on screen, so it always advances year over year.
 *
 * With one season, synced post-offseason, and nothing to cross-check against,
 * this is still one high — the same answer as before, never worse.
 */
export function tenureYearFor(
  resume: CoachResume | null,
  viewedSeasonYear: number,
  fallbackSeasonsWithTeam: number,
): number {
  if (!resume || resume.firstYearWithTeam === null) return fallbackSeasonsWithTeam + 1;
  return Math.max(1, viewedSeasonYear - resume.firstYearWithTeam + 1);
}

/** One synced season's worth of the two snapshots the résumé map is built from. */
export type SeasonStaffSlice = {
  seasonYear: number;
  coaches: CoachOverview | null;
  schedule: ScheduleOverview | null;
};

/** Each staff member's own win-loss record for the seasons they've actually been on this staff, keyed by coach name across every imported season. */
export function buildCoachResumeMap(seasons: SeasonStaffSlice[]): Map<string, CoachResume> {
  const map = new Map<string, CoachResume>();

  // Oldest first, so the FIRST entry a coach gets is genuinely their earliest
  // season here — that's the one whose `seasonsWithTeam` becomes the baseline.
  for (const season of [...seasons].sort((a, b) => a.seasonYear - b.seasonYear)) {
    const wins = season.schedule?.record.wins ?? 0;
    const losses = season.schedule?.record.losses ?? 0;
    const conferenceWins = season.schedule?.conferenceRecord.wins ?? 0;
    const conferenceLosses = season.schedule?.conferenceRecord.losses ?? 0;

    for (const coach of season.coaches?.staff ?? []) {
      const key = coachKey(coach);
      const existing = map.get(key);
      if (existing) {
        existing.seasons += 1;
        existing.wins += wins;
        existing.losses += losses;
        existing.conferenceWins += conferenceWins;
        existing.conferenceLosses += conferenceLosses;
        existing.firstSeason = Math.min(existing.firstSeason, season.seasonYear);
        existing.lastSeason = Math.max(existing.lastSeason, season.seasonYear);
        if (!existing.staffYears.includes(season.seasonYear)) existing.staffYears.push(season.seasonYear);
        // Latest estimate wins — see tenureYearFor for why the maximum is the
        // right pick and not, say, the earliest observation.
        existing.firstYearWithTeam = Math.max(
          existing.firstYearWithTeam ?? Number.NEGATIVE_INFINITY,
          season.seasonYear - coach.seasonsWithTeam,
        );
        if (!existing.positions.includes(coach.position)) existing.positions.push(coach.position);
      } else {
        map.set(key, {
          seasons: 1,
          wins,
          losses,
          conferenceWins,
          conferenceLosses,
          firstSeason: season.seasonYear,
          lastSeason: season.seasonYear,
          staffYears: [season.seasonYear],
          firstYearWithTeam: season.seasonYear - coach.seasonsWithTeam,
          positions: [coach.position],
        });
      }
    }
  }

  return map;
}

/**
 * Just the tenure baseline — each coach's estimated first year with this team —
 * from the per-season COACHES snapshots alone.
 *
 * Split out from buildCoachResumeMap because tenure is the only part of a résumé
 * that Overview and Career actually need, and the rest of the résumé (cumulative
 * win-loss) is what forces the per-season SCHEDULE reads: ~0.95 MB each against
 * ~0.45 MB for a coaches snapshot. Asking for tenure alone halves the cost, and
 * the estimate itself is identical — same `max(year - seasonsWithTeam)` rule,
 * for the same reason (see tenureYearFor).
 */
export function buildTenureMap(seasons: { seasonYear: number; coaches: CoachOverview | null }[]): Map<string, number> {
  const first = new Map<string, number>();
  for (const season of seasons) {
    for (const coach of season.coaches?.staff ?? []) {
      const key = coachKey(coach);
      const estimate = season.seasonYear - coach.seasonsWithTeam;
      const existing = first.get(key);
      if (existing === undefined || estimate > existing) first.set(key, estimate);
    }
  }
  return first;
}

/** Tenure year for a coach given the light map above, with the same fallback as tenureYearFor. */
export function tenureYearFrom(
  firstYearWithTeam: number | undefined,
  viewedSeasonYear: number,
  fallbackSeasonsWithTeam: number,
): number {
  if (firstYearWithTeam === undefined) return fallbackSeasonsWithTeam + 1;
  return Math.max(1, viewedSeasonYear - firstYearWithTeam + 1);
}

/**
 * The user's own position each synced season — what turns the program timeline
 * into a career résumé. Takes only the coaches half of a slice, so it works off
 * the light per-season load as well as the full one.
 */
export function buildUserPositionByYear(
  seasons: { seasonYear: number; coaches: CoachOverview | null }[],
): Map<number, string> {
  return new Map(
    seasons
      .filter((s) => s.coaches?.userCoach)
      .map((s) => [s.seasonYear, s.coaches!.userCoach!.position] as const),
  );
}
