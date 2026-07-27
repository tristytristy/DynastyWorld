import { getSeasonsByDynasty, getSnapshot } from './helpers';
import type { CoachData } from '../extractors/extract-coaches';
import type { TeamData } from '../extractors/extract-teams';
import type { CoachingTree, CoachingTreeEntry } from '../shared/types';

/** Generated coordinators can share PresentationId 0 — not a trackable identity. */
const UNTRACKABLE_ID = 0;

interface StaffStint {
  name: string;
  portraitAssetName: string | null;
  positions: Set<string>;
  firstYear: number;
  lastYear: number;
}
interface Sighting {
  seasonYear: number;
  teamIndex: number;
  teamName: string | null;
  position: string;
  name: string;
  portraitAssetName: string | null;
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
  const staff = new Map<number, StaffStint>();
  // Every coach's most-recent sighting anywhere in the league.
  const latest = new Map<number, Sighting>();

  let rootCoachName: string | null = null;
  let rootTeamName: string | null = null;

  for (const season of seasons) {
    const coaches = getSnapshot<CoachData[]>(season.id, 'coaches') ?? [];
    const teams = getSnapshot<TeamData[]>(season.id, 'teams') ?? [];
    const nameByIndex = new Map(teams.map((t) => [t.teamIndex, t.displayName]));

    for (const c of coaches) {
      const pid = c.presentationId;
      if (pid === UNTRACKABLE_ID || !c.lastName) continue;
      const teamName = nameByIndex.get(c.teamIndex) ?? null;

      // Most-recent sighting anywhere (seasons iterate oldest→newest, so just overwrite).
      latest.set(pid, {
        seasonYear: season.seasonYear,
        teamIndex: c.teamIndex,
        teamName,
        position: c.position,
        name: `${c.firstName} ${c.lastName}`.trim(),
        portraitAssetName: c.portraitAssetName,
      });

      // On the user's staff this season? (exclude the user coach themselves)
      if (c.teamIndex === season.userTeamId && pid !== season.userCoachId) {
        const existing = staff.get(pid);
        if (existing) {
          existing.positions.add(c.position);
          existing.firstYear = Math.min(existing.firstYear, season.seasonYear);
          existing.lastYear = Math.max(existing.lastYear, season.seasonYear);
        } else {
          staff.set(pid, {
            name: `${c.firstName} ${c.lastName}`.trim(),
            portraitAssetName: c.portraitAssetName,
            positions: new Set([c.position]),
            firstYear: season.seasonYear,
            lastYear: season.seasonYear,
          });
        }
      }

      // Root = the user coach on the latest season.
      if (season.id === latestSeason.id && pid === season.userCoachId) {
        rootCoachName = `${c.firstName} ${c.lastName}`.trim();
        rootTeamName = teamName;
      }
    }
  }

  const entries: CoachingTreeEntry[] = [];
  for (const [pid, stint] of staff) {
    const now = latest.get(pid);
    if (!now) continue;
    // A "branch" is a former staffer whose most-recent team isn't your current one.
    if (now.teamIndex === currentUserTeamId) continue;
    entries.push({
      presentationId: pid,
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
