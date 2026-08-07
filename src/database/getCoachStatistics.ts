import { getSnapshot } from './helpers';
import { activeCoachId, coachSeasons } from './hallOfLegends';
import type {
  PlayerStatsData,
  OffensiveStatLine,
  DefensiveStatLine,
  OLineStatLine,
} from '../extractors/extract-stats';
import type { RosterPlayerData } from '../extractors/extract-roster';
import type { TeamData } from '../extractors/extract-teams';
import type {
  CoachStatistics,
  CoachStatTotals,
  CoachStatSeason,
  CoachStatLeader,
} from '../shared/types';

/**
 * THE COACH'S OWN CAREER NUMBERS — everything his players produced, added up.
 *
 * SEASON LINES, NEVER CAREER LINES, and that distinction is the whole design.
 * Each player carries both: `season` is what he did that year, `career` is his
 * whole life including years under other coaches and at other schools. Summing
 * career lines would credit this coach with a transfer's freshman year
 * somewhere else, and would double-count every returning starter once per
 * season he appears in. Summing SEASON lines across the seasons this coach
 * actually coached gives exactly "what happened on my watch".
 *
 * Scoped to the coach rather than the dynasty, via the same `coachSeasons` spine
 * the Hall uses — so a dynasty that changed hands doesn't hand one coach another
 * one's production. The per-season rows carry the school, so a coach who moved
 * can see the split.
 *
 * Only seasons with a `stats` snapshot count, which is the same honesty
 * constraint as everywhere else: a season nobody synced has no numbers to add,
 * and `seasonsCounted` says so rather than quietly reporting a smaller total as
 * if it were complete.
 */

const EMPTY_TOTALS: CoachStatTotals = {
  passYards: 0,
  passTDs: 0,
  passInts: 0,
  passCompletions: 0,
  passAttempts: 0,
  rushYards: 0,
  rushTDs: 0,
  rushAttempts: 0,
  receivingYards: 0,
  receivingTDs: 0,
  receptions: 0,
  tackles: 0,
  sacks: 0,
  interceptions: 0,
  forcedFumbles: 0,
  passDeflections: 0,
};

type AnyLine = OffensiveStatLine | DefensiveStatLine | OLineStatLine;

function isOffense(line: AnyLine): line is OffensiveStatLine {
  return 'passYards' in line;
}

function isOLine(line: AnyLine): line is OLineStatLine {
  return 'pancakes' in line;
}

function addLine(into: CoachStatTotals, line: AnyLine): void {
  // Linemen's four columns have no home in these offense/defense totals — they
  // are counted on the Statistics leaderboards instead, where pancakes get a
  // category of their own.
  if (isOLine(line)) return;
  if (isOffense(line)) {
    into.passYards += line.passYards;
    into.passTDs += line.passTDs;
    into.passInts += line.passInts;
    into.passCompletions += line.passCompletions;
    into.passAttempts += line.passAttempts;
    into.rushYards += line.rushYards;
    into.rushTDs += line.rushTDs;
    into.rushAttempts += line.rushAttempts;
    into.receivingYards += line.receivingYards;
    into.receivingTDs += line.receivingTDs;
    into.receptions += line.receptions;
  } else {
    into.tackles += line.tackles;
    into.sacks += line.sacks;
    into.interceptions += line.interceptions;
    into.forcedFumbles += line.forcedFumbles;
    into.passDeflections += line.passDeflections;
  }
}

/** The single best individual season under this coach, per category. */
const LEADER_SPECS: { key: keyof CoachStatTotals; label: string; unit: string }[] = [
  { key: 'passYards', label: 'Passing Yards', unit: 'yds' },
  { key: 'rushYards', label: 'Rushing Yards', unit: 'yds' },
  { key: 'receivingYards', label: 'Receiving Yards', unit: 'yds' },
  { key: 'tackles', label: 'Tackles', unit: '' },
  { key: 'sacks', label: 'Sacks', unit: '' },
  { key: 'interceptions', label: 'Interceptions', unit: '' },
];

export function getCoachStatistics(dynastyId: string): CoachStatistics | undefined {
  const coachId = activeCoachId(dynastyId);
  if (coachId === null) return undefined;

  const seasons = coachSeasons(dynastyId, coachId);
  if (seasons.length === 0) return undefined;

  const career: CoachStatTotals = { ...EMPTY_TOTALS };
  const perSeason: CoachStatSeason[] = [];
  const playersCoached = new Set<number>();
  // Best single season per category, carrying who did it and when.
  const best = new Map<keyof CoachStatTotals, CoachStatLeader>();

  for (const season of seasons) {
    const stats = getSnapshot<PlayerStatsData[]>(season.seasonId, 'stats');
    if (!stats || stats.length === 0) continue;

    const roster = getSnapshot<RosterPlayerData[]>(season.seasonId, 'roster') ?? [];
    const nameById = new Map(
      roster.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`.trim(), position: p.position }]),
    );
    const teams = getSnapshot<TeamData[]>(season.seasonId, 'teams') ?? [];
    const teamName =
      season.teamIndex === null
        ? null
        : (teams.find((t) => t.teamIndex === season.teamIndex)?.displayName ?? null);

    const totals: CoachStatTotals = { ...EMPTY_TOTALS };
    for (const entry of stats) {
      if (!entry.season) continue;
      playersCoached.add(entry.playerId);
      addLine(totals, entry.season);
      addLine(career, entry.season);

      // Leaders are measured on the SEASON line for the same reason the totals
      // are: a career high set elsewhere was never this coach's to claim.
      const one: CoachStatTotals = { ...EMPTY_TOTALS };
      addLine(one, entry.season);
      for (const spec of LEADER_SPECS) {
        const value = one[spec.key];
        if (value <= 0) continue;
        const held = best.get(spec.key);
        if (held && held.value >= value) continue;
        const who = nameById.get(entry.playerId);
        best.set(spec.key, {
          category: spec.label,
          unit: spec.unit,
          value,
          playerName: who?.name ?? 'Unknown player',
          position: who?.position ?? null,
          seasonYear: season.seasonYear,
          teamName,
        });
      }
    }

    perSeason.push({
      seasonYear: season.seasonYear,
      teamName,
      totals,
    });
  }

  if (perSeason.length === 0) return undefined;

  return {
    coachId,
    seasonsCounted: perSeason.length,
    seasonsCoached: seasons.length,
    playersCoached: playersCoached.size,
    firstSeason: perSeason[0].seasonYear,
    lastSeason: perSeason[perSeason.length - 1].seasonYear,
    career,
    seasons: [...perSeason].reverse(),
    leaders: LEADER_SPECS.map((spec) => best.get(spec.key)).filter(
      (l): l is CoachStatLeader => l !== undefined,
    ),
  };
}
