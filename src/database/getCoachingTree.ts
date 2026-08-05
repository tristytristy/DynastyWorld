import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { CoachData } from '../extractors/extract-coaches';
import type { GameData } from '../extractors/extract-schedule';
import type { TeamData } from '../extractors/extract-teams';
import type { CoachingTree, CoachingTreeEntry, CoachingTreeStop } from '../shared/types';
import { isGamePlayed } from '../shared/gameStatus';

/**
 * A coach's identity: first name, last name AND PresentationId together.
 *
 * NONE OF THE THREE IS SUFFICIENT ALONE, and each failure mode was observed in
 * a real four-season archive rather than guarded against speculatively:
 *
 * - **PresentationId alone MERGES people.** It is not unique. In the Delaware
 *   dynasty, id 256 belongs to BOTH Tony Tadeski (the user's own head coach)
 *   and Allen Bobango (Memphis OC) — two men, different ages, coexisting in all
 *   four seasons. Keying on the id made the user's head coach and a Memphis
 *   coordinator the same person.
 * - **Name alone MERGES people too.** Two different coaches named Tim Beck
 *   exist simultaneously — Colorado State's head coach (age 61) and
 *   Vanderbilt's OC (age 65).
 * - **Dropping id 0 LOSES people.** The id is a sentinel shared by every
 *   generated coach, and the previous code skipped them outright. That silently
 *   discarded 74 of 184 defensive coordinators, 53 of 166 offensive
 *   coordinators and 17 of 143 head coaches in a single season — and the count
 *   GROWS every year as the original coach pool churns (64 → 96 → 125 → 144
 *   across four seasons), so a coaching tree got emptier the longer a dynasty
 *   ran, which is exactly backwards.
 *
 * Together they separate every coach in that archive: 493 of 493 distinct keys
 * in each of the four seasons, no collisions, and the id stays constant per
 * person across seasons so a key is stable enough to follow someone from one
 * school to the next.
 *
 * RESIDUAL RISK, stated rather than hidden: two generated coaches (both id 0)
 * sharing a full name in different seasons would still merge. Age would be a
 * fourth factor but it moves year to year, so it identifies nobody across time.
 */
function coachKey(coach: { firstName: string; lastName: string; presentationId: number }): string {
  // NUL separator — a name can contain punctuation, and "A|B" vs "A" + "|B"
  // must never produce the same key.
  return [coach.firstName, coach.lastName, coach.presentationId].join(String.fromCharCode(0));
}

interface StaffStint {
  name: string;
  portraitAssetName: string | null;
  positions: Set<string>;
  firstYear: number;
  lastYear: number;
}
interface Sighting {
  /** The raw PresentationId, for the DTO — NOT an identity on its own (see coachKey). */
  presentationId: number;
  seasonYear: number;
  teamIndex: number;
  teamName: string | null;
  position: string;
  name: string;
  portraitAssetName: string | null;
}

/** One synced season in which a coach was somebody's head coach, with that team's record. */
interface HeadCoachSeason {
  seasonYear: number;
  teamIndex: number;
  wins: number;
  losses: number;
}

/**
 * A team's record for a season, from the teams snapshot's own conference and
 * non-conference splits. There is no plain `wins`/`losses` field on TeamData —
 * these four are what the save gives, and they sum to the real record (verified
 * against the user's own team: 8-1 conf + 7-0 non-conf = the 15-1 the rest of
 * the app shows for that season).
 */
function teamRecord(team: TeamData): { wins: number; losses: number } {
  return {
    wins: (team.confWins ?? 0) + (team.nonConfWins ?? 0),
    losses: (team.confLosses ?? 0) + (team.nonConfLosses ?? 0),
  };
}

/**
 * The two records a branch shows, from the seasons this archive actually has.
 *
 * `currentRecord` is the season on the coach's most recent sighting — how the
 * job is going right now. `headCoachRecord` accumulates every synced season he
 * has been a head coach, anywhere.
 *
 * They start out IDENTICAL, which is the point: a coach in his first year has
 * one season to his name, so the renderer showing only the second when the two
 * differ produces exactly "current record now, overall once a season is behind
 * him" without needing to track that state.
 */
function headCoachRecords(
  seasons: HeadCoachSeason[],
  now: Sighting,
): { currentRecord: { wins: number; losses: number } | null; headCoachRecord: { wins: number; losses: number } | null } {
  if (now.position !== 'HeadCoach' || seasons.length === 0) {
    return { currentRecord: null, headCoachRecord: null };
  }
  const current = seasons.find((s) => s.seasonYear === now.seasonYear && s.teamIndex === now.teamIndex) ?? null;
  const total = seasons.reduce(
    (sum, s) => ({ wins: sum.wins + s.wins, losses: sum.losses + s.losses }),
    { wins: 0, losses: 0 },
  );
  return {
    currentRecord: current ? { wins: current.wins, losses: current.losses } : null,
    headCoachRecord: total,
  };
}

/** A postseason win, before it knows which season it belongs to. */
type TrophyMark = { label: string; kind: 'national' | 'bowl' };

/**
 * Who lifted something in the postseason, by team, for one season.
 *
 * Read from the league-wide `schedule` snapshot — the only place a NON-user
 * team's postseason result exists (the `championships` table is scoped to the
 * user's own dynasty). The national title game is itself a bowl, so it's
 * labelled first and the generic bowl branch is the fallback.
 */
function postseasonWinners(seasonId: number): Map<number, TrophyMark[]> {
  const byTeam = new Map<number, TrophyMark[]>();
  const games = getSnapshot<GameData[]>(seasonId, 'schedule') ?? [];
  for (const game of games) {
    if (!game.isBowlGame || !isGamePlayed(game.status)) continue;
    const winner =
      game.homeScore > game.awayScore
        ? game.homeTeamIndex
        : game.awayScore > game.homeScore
          ? game.awayTeamIndex
          : null;
    if (winner === null) continue;
    const trophy: TrophyMark = game.isNationalChampionship
      ? { label: 'National Championship', kind: 'national' }
      : { label: game.bowlName ?? 'Bowl win', kind: 'bowl' };
    const list = byTeam.get(winner) ?? [];
    list.push(trophy);
    byTeam.set(winner, list);
  }
  return byTeam;
}

/**
 * A coach's stops after leaving the user's staff, as contiguous runs at one
 * school — which is what makes this a journey rather than a current address.
 *
 * RECORDS AND TROPHIES ARE HEAD-COACH ONLY (user direction). A coordinator does
 * not own his team's results, and crediting him with them is exactly the mistake
 * the save's own career field makes.
 */
function buildJourney(
  trail: Sighting[],
  leftAfterYear: number,
  recordFor: (year: number, teamIndex: number) => { wins: number; losses: number } | null,
  trophiesFor: (year: number, teamIndex: number) => TrophyMark[],
): CoachingTreeStop[] {
  const after = trail
    .filter((s) => s.seasonYear > leftAfterYear)
    .sort((a, b) => a.seasonYear - b.seasonYear);

  const stops: CoachingTreeStop[] = [];
  for (const s of after) {
    const open = stops[stops.length - 1];
    // A new stop whenever the school changes OR the role does — a promotion from
    // coordinator to head coach at the same school is a genuine new chapter.
    if (open && open.teamIndex === s.teamIndex && open.position === s.position) {
      open.lastYear = s.seasonYear;
    } else {
      stops.push({
        teamIndex: s.teamIndex,
        teamName: s.teamName,
        position: s.position,
        firstYear: s.seasonYear,
        lastYear: s.seasonYear,
        isHeadCoach: s.position === 'HeadCoach',
        record: null,
        trophies: [],
      });
    }
  }

  for (const stop of stops) {
    if (!stop.isHeadCoach) continue;
    let wins = 0;
    let losses = 0;
    let any = false;
    for (let year = stop.firstYear; year <= stop.lastYear; year++) {
      const record = recordFor(year, stop.teamIndex);
      if (record) {
        wins += record.wins;
        losses += record.losses;
        any = true;
      }
      stop.trophies.push(...trophiesFor(year, stop.teamIndex).map((t) => ({ ...t, seasonYear: year })));
    }
    stop.record = any ? { wins, losses } : null;
  }

  return stops;
}

const EMPTY: CoachingTree = {
  rootCoachName: null,
  rootTeamName: null,
  entries: [],
  coachesProduced: 0,
  headCoachesProduced: 0,
};

/**
 * "Where your people went" — a coaching tree built entirely from the per-season
 * Wk0 coach snapshots the app already captures (every staff, every team), keyed
 * by each coach's stable PresentationId. No special carousel save needed: a
 * coach who was on YOUR staff one season and shows up on a different team a
 * later season is a branch. Returns those departed staffers with the role they
 * held under you, the years, and where they are now — head-coach promotions
 * flagged. Needs 2+ synced seasons with a coach who moved on; empty until then.
 */
export function getCoachingTree(dynastyId: string): CoachingTree {
  const seasons = getSeasonsByDynasty(dynastyId)
    .filter((s) => s.hasFullData && s.userTeamId !== null)
    .sort((a, b) => a.seasonYear - b.seasonYear);
  if (seasons.length === 0) return EMPTY;

  const latestSeason = seasons[seasons.length - 1];
  const currentUserTeamId = latestSeason.userTeamId;

  // Coaches who were ever on the user's staff (excluding the user themselves).
  const staff = new Map<string, StaffStint>();
  // Every coach's most-recent sighting anywhere in the league.
  const latest = new Map<string, Sighting>();
  // Every season any coach spent as a head coach, with that team's record.
  const headCoachSeasons = new Map<string, HeadCoachSeason[]>();
  // Every sighting of every coach, oldest first — the raw material of a journey.
  const sightings = new Map<string, Sighting[]>();
  // Postseason silverware by season and team, from the league schedule.
  const trophiesBySeason = new Map<number, Map<number, TrophyMark[]>>();
  // Every team's record, by season — the honest source for a head coach's own.
  const recordsBySeason = new Map<number, Map<number, { wins: number; losses: number }>>();

  let rootCoachName: string | null = null;
  let rootTeamName: string | null = null;

  for (const season of seasons) {
    const coaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));
    const teamByIndex = new Map(teams.map((t) => [t.teamIndex, t]));
    trophiesBySeason.set(season.seasonYear, postseasonWinners(season.id));
    recordsBySeason.set(season.seasonYear, new Map(teams.map((t) => [t.teamIndex, teamRecord(t)])));

    for (const c of coaches) {
      if (!c.lastName) continue;
      const key = coachKey(c);
      // The user's own coach is identified by id AND team — id 256 alone also
      // matches a Memphis coordinator in this very archive.
      const isUserCoach =
        c.teamIndex === season.userTeamId && c.presentationId === season.userCoachId;
      const teamName = nameByIndex.get(c.teamIndex) ?? null;

      // Most-recent sighting anywhere (seasons iterate oldest→newest, so just overwrite).
      latest.set(key, {
        presentationId: c.presentationId,
        seasonYear: season.seasonYear,
        teamIndex: c.teamIndex,
        teamName,
        position: c.position,
        name: `${c.firstName} ${c.lastName}`.trim(),
        portraitAssetName: c.portraitAssetName,
      });

      /*
        HEAD-COACHING RECORD IS OBSERVED, NOT READ OFF THE COACH.

        `Coach.careerStats` cannot be used for anybody but the user's own coach.
        Measured in this dynasty: in 2026 all three UCLA coaches — head coach AND
        both coordinators — carried an identical 15-1, the TEAM's record. In 2027
        the two coordinators had left for UCF and North Carolina, and both still
        read 31-1: UCLA's running total, for a season they had nothing to do
        with. Two different coaches at two different schools showing the same
        number is the tell. Whatever that reference resolves to for a non-user
        coach, it is not their record.

        So a head coach's record is accumulated from the record of the team he
        was actually in charge of, season by season, out of the `teams` snapshot
        this function already loads. Real, observed, and free.
      */
      if (c.position === 'HeadCoach') {
        const team = teamByIndex.get(c.teamIndex);
        if (team) {
          const record = teamRecord(team);
          const list = headCoachSeasons.get(key) ?? [];
          list.push({ seasonYear: season.seasonYear, teamIndex: c.teamIndex, ...record });
          headCoachSeasons.set(key, list);
        }
      }

      // Every sighting, not just the latest — this is what turns "where they are
      // now" into a journey with more than one stop.
      const trail = sightings.get(key) ?? [];
      trail.push({
        presentationId: c.presentationId,
        seasonYear: season.seasonYear,
        teamIndex: c.teamIndex,
        teamName,
        position: c.position,
        name: `${c.firstName} ${c.lastName}`.trim(),
        portraitAssetName: c.portraitAssetName,
      });
      sightings.set(key, trail);

      // On the user's staff this season? (exclude the user coach themselves)
      if (c.teamIndex === season.userTeamId && !isUserCoach) {
        const existing = staff.get(key);
        if (existing) {
          existing.positions.add(c.position);
          existing.firstYear = Math.min(existing.firstYear, season.seasonYear);
          existing.lastYear = Math.max(existing.lastYear, season.seasonYear);
        } else {
          staff.set(key, {
            name: `${c.firstName} ${c.lastName}`.trim(),
            portraitAssetName: c.portraitAssetName,
            positions: new Set([c.position]),
            firstYear: season.seasonYear,
            lastYear: season.seasonYear,
          });
        }
      }

      // Root = the user coach on the latest season.
      if (season.id === latestSeason.id && isUserCoach) {
        rootCoachName = `${c.firstName} ${c.lastName}`.trim();
        rootTeamName = teamName;
      }
    }
  }

  const entries: CoachingTreeEntry[] = [];
  for (const [key, stint] of staff) {
    const now = latest.get(key);
    if (!now) continue;
    // A "branch" is a former staffer whose most-recent team isn't your current one.
    if (now.teamIndex === currentUserTeamId) continue;
    entries.push({
      presentationId: now.presentationId,
      name: now.name || stint.name,
      portraitAssetName: now.portraitAssetName ?? stint.portraitAssetName,
      positionsUnderYou: [...stint.positions],
      firstYearWithYou: stint.firstYear,
      lastYearWithYou: stint.lastYear,
      nowTeamIndex: now.teamIndex,
      nowTeamName: now.teamName,
      nowPosition: now.position,
      nowSeasonYear: now.seasonYear,
      isHeadCoachNow: now.position === 'HeadCoach',
      ...headCoachRecords(headCoachSeasons.get(key) ?? [], now),
      journey: buildJourney(
        sightings.get(key) ?? [],
        stint.lastYear,
        (year, teamIndex) => recordsBySeason.get(year)?.get(teamIndex) ?? null,
        (year, teamIndex) => trophiesBySeason.get(year)?.get(teamIndex) ?? [],
      ),
    });
  }

  // Head-coach promotions first (the prestige branches), then most-recent moves.
  entries.sort(
    (a, b) =>
      Number(b.isHeadCoachNow) - Number(a.isHeadCoachNow) ||
      (b.nowSeasonYear ?? 0) - (a.nowSeasonYear ?? 0) ||
      a.name.localeCompare(b.name),
  );

  return {
    rootCoachName,
    rootTeamName,
    entries,
    coachesProduced: entries.length,
    headCoachesProduced: entries.filter((e) => e.isHeadCoachNow).length,
  };
}
