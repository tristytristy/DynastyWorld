import { useEffect, useState } from 'react';
import { CardBookModal } from '../components/common/CardBookModal';
import { ScandalsModal } from '../components/common/ScandalsModal';
import { Link, useParams } from 'react-router-dom';
import { CoachCard, EditButton, coachKey, spaceCamelCase, type CoachResume, type UnitStats } from '../components/common/CoachCard';
import { CoachPortrait } from '../components/common/CoachPortrait';
import { TeamLogo } from '../components/common/TeamLogo';
import { TeamLink } from '../components/common/TeamLink';
import { useEditorModal } from '../data/EditorModalProvider';
import { useSelectedSeason } from '../data/SelectedSeasonProvider';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { StatTile } from '../components/ui/StatTile';
import { getBowlLogoPath, getConferenceChampionshipTrophyPath, getTrophyImagePath } from '../lib/trophyAssetMapping';
import type {
  Coach,
  CoachingTree,
  CoachOverview,
  ProgramHistoryOverview,
  ScheduleOverview,
  SeasonOverview,
} from '../../shared/types';
import type { TeamStatsData } from '../../extractors/extract-team-stats';

/** "'26" / "'26–'28" for a coach's tenure span. */
function yearsSpan(a: number, b: number): string {
  const y = (n: number) => `'${String(n).slice(-2)}`;
  return a === b ? y(a) : `${y(a)}–${y(b)}`;
}

/** The coaching-tree branches — where your former staffers went, head-coach promotions first. */
function CoachingTreeSection({ tree }: { tree: CoachingTree }) {
  if (tree.entries.length === 0) {
    return (
      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Where your people go</h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          As assistants leave your staff for jobs elsewhere, they&apos;ll branch out here — with the role they held under
          you and where they landed. Sync each season and your tree grows.
        </p>
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Coaching Tree</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Where your people went
          </h3>
        </div>
        <div className="flex gap-3">
          <StatTile label="Coaches produced" value={String(tree.coachesProduced)} />
          <StatTile label="Now head coaches" value={String(tree.headCoachesProduced)} />
        </div>
      </div>

      {/* Root node — you */}
      {tree.rootCoachName && (
        <div className="mt-4 inline-flex items-center gap-2 border border-[var(--team-primary)]/50 bg-[color:color-mix(in_srgb,var(--team-primary)_12%,transparent)] px-3 py-1.5">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{tree.rootCoachName}</span>
          {tree.rootTeamName && <span className="text-xs text-slate-500 dark:text-slate-400">· {tree.rootTeamName}</span>}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {tree.entries.map((e) => (
          <div
            key={e.presentationId}
            className={`flex flex-col gap-3 border-l-[3px] bg-slate-50/70 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between ${
              e.isHeadCoachNow
                ? 'border-l-amber-400 border-y border-r border-y-amber-300/40 border-r-amber-300/40 dark:border-y-amber-500/25 dark:border-r-amber-500/25'
                : 'border-l-[var(--team-primary)]/60 border-y border-r border-y-slate-200/70 border-r-slate-200/70 dark:border-y-slate-800 dark:border-r-slate-800'
            }`}
          >
            {/* Left: the coach + role under you */}
            <div className="flex min-w-0 items-center gap-3">
              <CoachPortrait
                coach={{ firstName: e.name.split(' ')[0] ?? '', lastName: e.name.split(' ').slice(1).join(' '), portraitAssetName: e.portraitAssetName }}
                size="sm"
                className="!h-10 !w-10 shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{e.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  Your {e.positionsUnderYou.map(spaceCamelCase).join(' / ')} · {yearsSpan(e.firstYearWithYou, e.lastYearWithYou)}
                </p>
              </div>
            </div>

            {/* Right: where they are now */}
            <div className="flex items-center gap-2.5 sm:justify-end">
              <span className="hidden text-slate-300 dark:text-slate-600 sm:inline" aria-hidden="true">→</span>
              {e.nowTeamName && (
                <TeamLogo team={{ assetName: e.nowTeamName, label: e.nowTeamName }} size="sm" className="!h-6 !w-6 shrink-0" />
              )}
              <div className="min-w-0 text-left sm:text-right">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white sm:justify-end">
                  {e.isHeadCoachNow && (
                    <span className="border border-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Head Coach
                    </span>
                  )}
                  <TeamLink teamIndex={e.nowTeamIndex ?? undefined} teamName={e.nowTeamName ?? 'Unknown'} nameClassName="truncate" />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {e.nowPosition ? spaceCamelCase(e.nowPosition) : 'Coach'}
                  {e.nowSeasonYear ? ` · as of ${e.nowSeasonYear}` : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

const nationalChampionshipTrophyPath = getTrophyImagePath({
  kind: 'national-championship',
  label: 'National Champions',
  assetKey: null,
});

/** JobSecurityStatus enum -> a short career-status line for the hero. */
function jobSecurityLabel(status: string): string {
  if (status === 'HotSeat') return 'On the Hot Seat';
  if (status === 'SafeForNow') return 'Safe For Now';
  return spaceCamelCase(status);
}

function recordLine(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st"… */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
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
function buildUnitStats(
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
    offenseYardsPerGame: teamStats ? per(teamStats.totalYards) : null,
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
function tenureYearFor(resume: CoachResume | null, viewedSeasonYear: number, fallbackSeasonsWithTeam: number): number {
  if (!resume || resume.firstYearWithTeam === null) return fallbackSeasonsWithTeam + 1;
  return Math.max(1, viewedSeasonYear - resume.firstYearWithTeam + 1);
}

/** Each staff member's own win-loss record for the seasons they've actually been on this staff, keyed by coach name across every imported season. */
function buildCoachResumeMap(
  seasons: { seasonYear: number; coaches: CoachOverview | null; schedule: ScheduleOverview | null }[],
): Map<string, CoachResume> {
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

type Tone = 'good' | 'ok' | 'warn' | 'bad';

/** The chip palette, shared by the AD's evaluation and the standing job-security status so the two read as one row. */
const TONE_CLASS: Record<Tone, string> = {
  good: 'border-emerald-300/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  ok: 'border-slate-300/70 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300',
  warn: 'border-amber-300/70 bg-amber-100/70 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  bad: 'border-red-300/70 bg-red-100/70 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300',
};

function jobSecurityTone(status: string): Tone {
  if (status === 'HotSeat') return 'bad';
  if (status === 'Low') return 'warn';
  if (status === 'Safe') return 'good';
  return 'ok';
}

/*
 * WHY THERE IS NO AD-GOAL RENDERER HERE.
 *
 * The in-game AD Expectations screen writes each goal out in full ("Have 15 or
 * fewer Turnovers on Offense this season", worth 50 coach points, passed). The
 * save gives us the verdict and not the question: each slot carries status and
 * progress plus a reference into the game's own goal catalogue — table 16483,
 * while a dynasty file's tables run 4096–6385.
 *
 * The catalogue isn't reachable from outside the game either, which was checked
 * rather than assumed (2026-07-29): CollegeFB27.exe and 14 Frostbite .cas
 * archives, the English localisation bundle among them, scanned for the goal
 * wording in ASCII and UTF-16 — no hits. Frostbite keeps those strings in
 * Oodle-compressed chunks, so reading them means parsing the .toc/.sb layout and
 * decompressing the EBX payloads.
 *
 * So the slots stay extracted (they're on the Coach record) and stay unrendered:
 * "Passed" next to nothing is a verdict on a question the page can't ask.
 */

/** JobSecurityStatus enum → a short performance evaluation for the contract card. */
function jobSecurityEvaluation(status: string): { label: string; tone: Tone } {
  if (status === 'Safe') return { label: 'Exceeding expectations', tone: 'good' };
  if (status === 'SafeForNow') return { label: 'Meeting expectations', tone: 'ok' };
  if (status === 'Low') return { label: 'At risk', tone: 'warn' };
  if (status === 'HotSeat') return { label: 'Critical — on the hot seat', tone: 'bad' };
  return { label: spaceCamelCase(status), tone: 'ok' };
}

export function CoachHub() {
  const { id } = useParams<{ id: string }>();
  const { seasons, selectedSeasonId: seasonId } = useSelectedSeason();
  const [scandalsOpen, setScandalsOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [overview, setOverview] = useState<SeasonOverview | null | undefined>(undefined);
  const [coaches, setCoaches] = useState<CoachOverview | null | undefined>(undefined);
  const [history, setHistory] = useState<ProgramHistoryOverview | null | undefined>(undefined);
  const [coachResumes, setCoachResumes] = useState<Map<string, CoachResume> | undefined>(undefined);
  // The user coach's own position each synced season — the piece the program
  // timeline lacks, and what turns it into a career résumé (following the coach
  // across school changes, HC/OC/DC year to year).
  const [userPositionByYear, setUserPositionByYear] = useState<Map<number, string>>(new Map());
  const [coachingTree, setCoachingTree] = useState<CoachingTree | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats | null>(null);
  const { openCoachEditor } = useEditorModal();

  // The coaching tree is dynasty-level (season-over-season staff diff), not per-season.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getCoachingTree(id).then((t) => {
      if (!cancelled) setCoachingTree(t);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The coordinators' per-game numbers for the season on screen: yardage comes
  // off the team-stats snapshot, scoring off the schedule (see buildUnitStats).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      window.api.db.getTeamStats(id, seasonId),
      window.api.db.getSchedule(id, seasonId),
    ]).then(([teamStats, schedule]) => {
      if (!cancelled) setUnitStats(buildUnitStats(teamStats ?? null, schedule ?? null));
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    window.api.db.getSeasonOverview(id, seasonId).then((result) => {
      if (!cancelled) setOverview(result);
    });
    window.api.db.getCoaches(id, seasonId).then((result) => {
      if (!cancelled) setCoaches(result);
    });
    window.api.db.getHistory(id).then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, seasonId]);

  useEffect(() => {
    if (!id || seasons.length === 0) return;
    let cancelled = false;
    setCoachResumes(undefined);

    Promise.all(
      seasons.map(async (season) => ({
        seasonYear: season.seasonYear,
        coaches: await window.api.db.getCoaches(id, season.id),
        schedule: await window.api.db.getSchedule(id, season.id),
      })),
    ).then((results) => {
      if (cancelled) return;
      setCoachResumes(buildCoachResumeMap(results));
      setUserPositionByYear(
        new Map(
          results
            .filter((r) => r.coaches?.userCoach)
            .map((r) => [r.seasonYear, r.coaches!.userCoach!.position] as const),
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id, seasons]);

  function refreshCoaches() {
    if (!id) return;
    window.api.db.getCoaches(id, seasonId).then(setCoaches);
  }

  function editCoach(coach: Coach) {
    if (!id) return;
    openCoachEditor({
      dynastyId: id,
      teamIndex: coach.teamIndex,
      position: coach.position,
      coachLabel: `${coach.firstName} ${coach.lastName}`,
      onSaved: refreshCoaches,
    });
  }

  if (overview === undefined || coaches === undefined || history === undefined) {
    return <p className="text-slate-500 dark:text-slate-400">Loading Coach Hub...</p>;
  }

  if (overview === null) {
    const selectedSeason = seasons.find((season) => season.id === seasonId);
    if (selectedSeason && !selectedSeason.hasFullData) {
      return <p className="text-slate-500 dark:text-slate-400">No detailed data for this season — see the note above.</p>;
    }
    return (
      <div className="space-y-4">
        <p className="text-slate-500 dark:text-slate-400">Dynasty not found.</p>
        <Link to="/" className="text-brand-600 underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // The hero centers on whoever the user actually controls — Head Coach,
  // Offensive Coordinator, or Defensive Coordinator — not always the HC.
  // "Current Coaching Staff" then shows everyone else on staff, so the user
  // is never listed twice.
  const userCoach = coaches?.userCoach ?? null;
  const staff = coaches?.staff.filter((c) => !(c.teamIndex === userCoach?.teamIndex && c.position === userCoach?.position)) ?? [];
  const career = userCoach?.careerStats ?? null;

  return (
    <div className="space-y-6">
      <SurfaceCard>
        {/* Stretch rather than center, so the Scandals button can sit on the
            masthead's bottom edge instead of floating beside the name. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-5">
            <div className="flex items-center gap-5">
              {userCoach ? (
                <CoachPortrait coach={userCoach} teamAssetName={overview.teamName} size="xl" />
              ) : (
                <TeamLogo team={{ assetName: overview.teamName, label: overview.teamName }} size="lg" />
              )}
              <div>
                <p className="type-eyebrow text-slate-400 dark:text-slate-500">
                  Coach
                </p>
                <h2 className="mt-2 font-display text-page-title font-bold text-slate-950 dark:text-white">
                  {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}
                </h2>
                {userCoach && (
                  <p className="mt-2 text-sm font-semibold text-[var(--team-accent-text)]">
                    {spaceCamelCase(userCoach.position)}
                  </p>
                )}
                {/* Same counter as the staff cards — the save's own figure sits
                    still across seasons, so this counts observed seasons from it. */}
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {userCoach
                    ? `${ordinal(
                        tenureYearFor(
                          coachResumes?.get(coachKey(userCoach)) ?? null,
                          overview.seasonYear,
                          userCoach.seasonsWithTeam,
                        ),
                      )} year as ${spaceCamelCase(userCoach.position)} with ${overview.teamName}`
                    : overview.teamName}
                </p>
                {/* Job security used to repeat here; it lives in the Contract
                    section's status chip now, beside the AD's evaluation, which
                    is the one place it means something. The fired count only
                    ever showed alongside it, so it moved there too. */}
              </div>
            </div>
          </div>

          {id && (
            /* `items-stretch`, not `items-end`: both buttons then take the
               column's width — the widest label's — instead of each sizing to
               its own text, so "Cardbook" and "Scandals" match. They already
               share padding and type size, so the heights follow. */
            <div className="flex shrink-0 flex-col items-stretch justify-end gap-2">
              {/* The card book. Not coach-gated the way Scandals is — a book of
                  your own cards is yours whoever you happen to be coaching. */}
              <button
                type="button"
                onClick={() => setCardsOpen(true)}
                title="Your card book — every card you've starred"
                className="corner-cut-sm border border-slate-300/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--team-primary)] hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
              >
                Cardbook
              </button>
              {/* User coaches only — Scandals writes to the save, and there's
                  nothing to cheat on behalf of a CPU staff. */}
              {userCoach && (
                <button
                  type="button"
                  onClick={() => setScandalsOpen(true)}
                  title="Off-the-books adjustments — writes to your save"
                  className="corner-cut-sm border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 dark:border-red-500/40 dark:text-red-300"
                >
                  Scandals
                </button>
              )}
            </div>
          )}
        </div>
      </SurfaceCard>

      {id && <ScandalsModal open={scandalsOpen} onClose={() => setScandalsOpen(false)} dynastyId={id} />}
      {id && <CardBookModal open={cardsOpen} onClose={() => setCardsOpen(false)} dynastyId={id} />}

      {userCoach && (
        <SurfaceCard>
          <div className="flex items-center justify-between gap-4">
            <p className="type-eyebrow text-slate-400 dark:text-slate-500">
              Coach Profile
            </p>
            <EditButton onClick={() => editCoach(userCoach)} label={`Edit ${userCoach.firstName} ${userCoach.lastName}`} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Age" value={String(userCoach.age)} />
            <StatTile label="Alma mater" value={userCoach.almaMaterName ?? 'Unknown'} />
            <StatTile label="Years coaching" value={String(userCoach.yearsCoaching)} />
            <StatTile label="Current position" value={spaceCamelCase(userCoach.position)} />
          </div>
        </SurfaceCard>
      )}

      {userCoach && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">Contract</p>
          {(() => {
            const evalResult = jobSecurityEvaluation(userCoach.currentJobSecurityStatus);
            return (
              <>
                {/*
                  NO AD-GOAL TILES — see the note above jobSecurityEvaluation.
                  They were built and pulled the same day, on the user's call and
                  for the right reason: three tiles reading "In Progress /
                  Passed / Failed" were verdicts on questions the page couldn't
                  show. A status that refers to nothing visible is worse than no
                  tile at all.

                  The slots are still extracted and still on the Coach record —
                  the day the goal catalogue is readable, this is a render change
                  and nothing more.
                */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatTile
                    label="Years remaining"
                    value={userCoach.contractLength > 0 ? String(userCoach.contractYearsRemaining) : '—'}
                  />
                  <StatTile
                    label="Coach points"
                    value={userCoach.coachPoints === null ? 'Not available' : String(userCoach.coachPoints)}
                  />
                </div>
                {/* The AD's evaluation and the standing status, side by side:
                    the first is how the season is going, the second is what it
                    has done to the job. */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${TONE_CLASS[evalResult.tone]}`}>
                    {evalResult.label}
                  </span>
                  <span className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${TONE_CLASS[jobSecurityTone(userCoach.currentJobSecurityStatus)]}`}>
                    {jobSecurityLabel(userCoach.currentJobSecurityStatus)}
                    {userCoach.currentJobSecurityPercentage !== null
                      ? ` · ${userCoach.currentJobSecurityPercentage}%`
                      : ''}
                  </span>
                  {/* The "Expectation · Win 7 games" chip is gone (user's call).
                      `CurrentContractExpectation` is a win-count enum, while the
                      game's own AD screen states a TIER ("Conference
                      Competitor") — so the chip sat next to the evaluation
                      claiming to be the AD's expectation while saying something
                      the AD screen never says. The field is still extracted. */}
                  {career && career.timesFired > 0 && (
                    <span className={`border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${TONE_CLASS.warn}`}>
                      Fired {career.timesFired}×
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </SurfaceCard>
      )}

      {userCoach && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Career Record
          </p>
          
          {career ? (
            <>
              <div className="mt-4 overflow-hidden rounded-xl bg-[var(--team-primary)] p-5 text-[var(--team-on-primary)]">
                <p className="text-xs uppercase tracking-[0.24em] opacity-75">Overall record</p>
                <p className="mt-2 type-stat-lg">
                  {recordLine(career.wins, career.losses)}
                </p>
                <p className="mt-1 text-sm opacity-80">
                  At {overview.teamName}: {recordLine(career.winsAtCurrentSchool, career.lossesAtCurrentSchool)}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <StatTile label="Bowl record" value={recordLine(career.bowlWins, career.bowlLosses)} />
                <StatTile label="Conf. titles" value={recordLine(career.confChampWins, career.confChampLosses)} />
                <StatTile label="National titles" value={String(career.ncWins)} />
                <StatTile label="Playoff record" value={recordLine(career.playoffWins, career.playoffLosses)} />
                <StatTile label="Rivalry record" value={recordLine(career.rivalWins, career.rivalLosses)} />
                <StatTile label="Top 25 record" value={recordLine(career.top25Wins, career.top25Losses)} />
                <StatTile label="Draft picks" value={String(career.draftPicks)} />
                <StatTile label="1st round picks" value={String(career.firstRoundDraftPicks)} />
                <StatTile label="Top-5 recruit classes" value={String(career.top5RecruitClasses)} />
                <StatTile label="Players developed to max" value={String(career.playersMaxProgressed)} />
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No career record available for this coach.</p>
          )}
        </SurfaceCard>
      )}

      <SurfaceCard>
        <p className="type-eyebrow text-slate-400 dark:text-slate-500">
          {overview.seasonYear} Coaching Staff
        </p>
        {staff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No other coaches on staff this season.</p>
        ) : (
          /*
            Columns follow the count instead of being fixed at three. A staff of
            two in a three-column grid left a third of the row empty, which read
            as a missing card rather than a design. Capped at three so a large
            staff still wraps instead of shrinking each card to nothing.
          */
          <div
            className={`mt-4 grid grid-cols-1 gap-4 ${
              staff.length >= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : staff.length === 2 ? 'md:grid-cols-2' : ''
            }`}
          >
            {staff.map((coach, index) => (
              <CoachCard
                key={`${coach.position}-${index}`}
                coach={coach}
                resume={coachResumes?.get(coachKey(coach)) ?? null}
                teamName={overview.teamName}
                tenureYear={tenureYearFor(
                  coachResumes?.get(coachKey(coach)) ?? null,
                  overview.seasonYear,
                  coach.seasonsWithTeam,
                )}
                unitStats={unitStats}
                onEdit={() => editCoach(coach)}
              />
            ))}
          </div>
        )}
      </SurfaceCard>

      {history && history.seasons.length > 0 && (
        <SurfaceCard>
          <p className="type-eyebrow text-slate-400 dark:text-slate-500">
            Career Résumé
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {userCoach ? `${userCoach.firstName} ${userCoach.lastName}` : overview.teamName}&apos;s coaching journey
          </h3>
          {(() => {
            const rs = history.seasons;
            const schools = [...new Map(rs.map((s) => [s.teamName, s.teamName])).keys()];
            const trackedWins = rs.reduce((sum, s) => sum + s.wins, 0);
            const trackedLosses = rs.reduce((sum, s) => sum + s.losses, 0);
            const natTitles = rs.filter((s) => s.nationalChampion).length;
            const confTitles = rs.filter((s) => s.conferenceChampion).length;
            return (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Seasons tracked" value={String(rs.length)} />
                  <StatTile label="Tracked record" value={recordLine(trackedWins, trackedLosses)} />
                  <StatTile label="National titles" value={String(natTitles)} />
                  <StatTile label="Conf. titles" value={String(confTitles)} />
                </div>
                {schools.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {schools.length === 1 ? 'School' : `${schools.length} schools`}:
                    </span>
                    {schools.map((school) => (
                      <span
                        key={school}
                        className="inline-flex items-center gap-1.5 border border-slate-200/80 bg-slate-50/85 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-white/5 dark:text-slate-200"
                      >
                        <TeamLogo team={{ assetName: school, label: school }} size="sm" className="!h-4 !w-4" />
                        {school}
                      </span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          <ul className="mt-4 space-y-2">
            {history.seasons.map((season) => {
              const bowlLogoPath = season.bowlAppearance ? getBowlLogoPath(season.bowlAssetName) : null;
              const confTrophyPath = season.conferenceChampion && season.conferenceChampionName
                ? getConferenceChampionshipTrophyPath(season.conferenceChampionName)
                : null;
              return (
                <li
                  key={season.seasonYear}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm dark:border-slate-800 dark:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <TeamLogo team={{ assetName: season.teamName, label: season.teamName }} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {season.seasonYear} — {season.teamName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(() => {
                          const pos = userPositionByYear.get(season.seasonYear);
                          if (!pos) return season.headCoachName ?? 'Unknown coach';
                          // If the user WAS the head coach, "HC: <self>" is redundant.
                          const showHc = pos !== 'HeadCoach' && season.headCoachName;
                          return `${spaceCamelCase(pos)}${showHc ? ` · HC: ${season.headCoachName}` : ''}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {season.nationalChampion && nationalChampionshipTrophyPath && (
                        <img
                          src={nationalChampionshipTrophyPath}
                          alt="National champions"
                          title="National champions"
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {confTrophyPath && (
                        <img
                          src={confTrophyPath}
                          alt={`${season.conferenceChampionName} champions`}
                          title={`${season.conferenceChampionName} champions`}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                      {bowlLogoPath && (
                        <img
                          src={bowlLogoPath}
                          alt={season.bowlAppearance ?? 'Bowl appearance'}
                          title={season.postseasonSummary ?? season.bowlAppearance ?? undefined}
                          className="h-6 w-6 object-contain"
                          draggable={false}
                        />
                      )}
                    </div>
                    <span className="proportional-nums font-semibold text-slate-700 dark:text-slate-200">
                      {recordLine(season.wins, season.losses)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </SurfaceCard>
      )}

      {coachingTree && <CoachingTreeSection tree={coachingTree} />}
    </div>
  );
}
