import { formatAwardLabel } from '../../../lib/awardFormat';
import type { HonorRosterEntry, LeagueAward, WeeklyHonor } from '../../../../shared/types';

/**
 * One thing that happened to a player, in the one shape the timeline renders.
 *
 * WHY A MODEL AND NOT A MERGE IN JSX. Journey draws from three sources with
 * three different shapes and three different notions of "when" — a milestone
 * knows its season and week, a marquee award knows only its season, a weekly
 * honor knows both. Merging them inline meant each section sorted itself and the
 * page interleaved nothing; the user got four lists stacked up, which is what
 * the four old tabs already were. One model, one sort, one list.
 */
export interface PlayerJourneyEvent {
  /** Stable across renders — never an array index. */
  id: string;
  kind: 'milestone' | 'honor';
  seasonYear: number;
  /** Null when the source only knows the season, which most awards do. */
  week: number | null;
  title: string;
  detail: string | null;
}

/** The sub-kinds of honor, ordered by how much they matter within a season. */
const HONOR_WEIGHT = { marquee: 0, tier: 1, weekly: 2 } as const;

export interface JourneyMilestone {
  seasonYear: number;
  label: string;
  detail: string | null;
}

export interface JourneyHonorSeason {
  seasonYear: number;
  marqueeWins: LeagueAward[];
  honorTiers: HonorRosterEntry[];
  weeklyHonors: WeeklyHonor[];
}

export interface JourneyTeamAward {
  seasonYear: number;
  awardName: string;
}

/**
 * Every career event, newest first, deterministically.
 *
 * THE SORT IS TOTAL, on purpose. Season descending, then week descending
 * (weekless events sort as if week 0, i.e. last within their season), then a
 * fixed kind order, then the id. Without that final tiebreak two awards from the
 * same season would swap places between renders depending on array order, and a
 * timeline that reshuffles when you click a filter reads as broken.
 */
export function buildJourneyEvents({
  milestones,
  honorSeasons,
  teamAwards,
}: {
  milestones: JourneyMilestone[];
  honorSeasons: JourneyHonorSeason[];
  teamAwards: JourneyTeamAward[];
}): PlayerJourneyEvent[] {
  const events: (PlayerJourneyEvent & { weight: number })[] = [];

  milestones.forEach((m, i) => {
    events.push({
      id: `milestone:${m.seasonYear}:${i}:${m.label}`,
      kind: 'milestone',
      seasonYear: m.seasonYear,
      week: null,
      title: m.label,
      detail: m.detail,
      weight: 3,
    });
  });

  for (const season of honorSeasons) {
    for (const award of season.marqueeWins) {
      events.push({
        id: `award:${season.seasonYear}:${award.awardType}`,
        kind: 'honor',
        seasonYear: season.seasonYear,
        week: null,
        title: formatAwardLabel(award.awardType),
        detail: null,
        weight: HONOR_WEIGHT.marquee,
      });
    }
    for (const tier of season.honorTiers) {
      events.push({
        id: `honor:${season.seasonYear}:${tier.awardType}`,
        kind: 'honor',
        seasonYear: season.seasonYear,
        week: null,
        title: formatAwardLabel(tier.awardType),
        detail: null,
        weight: HONOR_WEIGHT.tier,
      });
    }
    for (const weekly of season.weeklyHonors) {
      events.push({
        id: `weekly:${season.seasonYear}:${weekly.week}:${weekly.awardType}`,
        kind: 'honor',
        seasonYear: season.seasonYear,
        week: weekly.week ?? null,
        title: formatAwardLabel(weekly.awardType),
        detail: weekly.week != null ? `Week ${weekly.week}` : null,
        weight: HONOR_WEIGHT.weekly,
      });
    }
  }

  for (const award of teamAwards) {
    events.push({
      id: `teamaward:${award.seasonYear}:${award.awardName}`,
      kind: 'honor',
      seasonYear: award.seasonYear,
      week: null,
      title: award.awardName,
      detail: 'Team award',
      weight: HONOR_WEIGHT.marquee,
    });
  }

  return events
    .sort(
      (a, b) =>
        b.seasonYear - a.seasonYear ||
        (b.week ?? 0) - (a.week ?? 0) ||
        a.weight - b.weight ||
        a.id.localeCompare(b.id),
    )
    .map(({ weight: _weight, ...event }) => event);
}
