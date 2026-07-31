import { FCS_POOL_TEAM_INDEX } from '../shared/fcsPool';
import { getDynastyById, getSeasonsByDynasty, getSnapshot } from './helpers';
import {
  EFFICIENCY_DIMENSIONS,
  LOWER_IS_BETTER,
  aggregateLeagueFromSchedule,
  derive,
  emptyAggregate,
  percentileOf,
  rankOf,
  type EfficiencyKey,
} from './getSeasonAnalytics';
import type { TeamData } from '../extractors/extract-teams';
import type { GameData } from '../extractors/extract-schedule';
import type {
  ProgramArc,
  ProgramEfficiencyRow,
  ProgramPrestigeSeason,
  ProgramUnitRow,
} from '../shared/types';

/**
 * Program Arc — the Yearly view's data layer. Season Lab explains one season;
 * this reads the same material across every season on record.
 *
 * Three sources, all already archived per season, which is why this fills in
 * retroactively for seasons synced long before the feature existed:
 *
 *  • `teams` — league-wide, so `teamPrestige` and the game's own position-group
 *    grades come with a real national rank rather than an absolute number the
 *    reader can't judge. Verified on a live archive: prestige runs 0-10 with a
 *    genuine spread across the 143 rows (28 teams at 3, only 5 at 10), and the
 *    grades are the same values behind the in-game Team Ratings screen.
 *  • `schedule` — league-wide with a per-game team stat block, aggregated by
 *    the SAME helper Season Lab uses so the two views can't disagree.
 *
 * Nothing here is modelled or estimated. A season that lacks a snapshot simply
 * doesn't contribute a point, and the UI draws the gap.
 */

/** The prestige scale the game itself uses. Probed: values 0-10 across the league. */
const PRESTIGE_MAX = 10;

const UNIT_ROWS: { key: keyof TeamData['positionGrades']; label: string; isSummary: boolean }[] = [
  { key: 'qb', label: 'QB', isSummary: false },
  { key: 'rb', label: 'RB', isSummary: false },
  { key: 'wr', label: 'WR', isSummary: false },
  { key: 'te', label: 'TE', isSummary: false },
  { key: 'ol', label: 'OL', isSummary: false },
  { key: 'dl', label: 'DL', isSummary: false },
  { key: 'lb', label: 'LB', isSummary: false },
  { key: 'db', label: 'DB', isSummary: false },
  /*
    `st` is SPECIAL TEAMS, not safeties — tested rather than assumed, because
    the two-letter label invited exactly that misreading. Across 143 teams the
    grade correlates with the best K/P on the roster (r=0.36) and no more with
    safeties (0.22) than with corners (0.21); the lowest-graded teams match
    their kicker almost exactly (Sac State ST 71 / K 71, Troy ST 72 / K 72)
    while an FCS side with a 94 safety still grades ST 73. Safeties live under
    `db`, which correlates with safeties (0.48) and corners (0.52) alike — the
    save has no separate safety grade at all. Spelled out here so nobody has to
    re-derive it from two letters.
  */
  { key: 'st', label: 'Special teams', isSummary: false },
  { key: 'offense', label: 'Offense', isSummary: true },
  { key: 'defense', label: 'Defense', isSummary: true },
  { key: 'overall', label: 'Overall', isSummary: true },
];

const isRealProgram = (t: TeamData) => t.teamIndex !== FCS_POOL_TEAM_INDEX && !!t.conferenceName;

export function getProgramArc(dynastyId: string): ProgramArc | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const seasons = [...getSeasonsByDynasty(dynastyId)].sort((a, b) => a.seasonYear - b.seasonYear);
  if (seasons.length === 0) return null;

  const prestige: ProgramPrestigeSeason[] = [];
  const units: ProgramUnitRow[] = UNIT_ROWS.map((u) => ({
    key: u.key,
    label: u.label,
    isSummary: u.isSummary,
    seasons: [],
  }));
  const efficiency: ProgramEfficiencyRow[] = EFFICIENCY_DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    format: d.format,
    lowerIsBetter: LOWER_IS_BETTER.has(d.key),
    seasons: [],
  }));
  const contributing: ProgramArc['seasons'] = [];

  let teamName = dynasty.teamName ?? '';

  for (const season of seasons) {
    const teamIndex = season.userTeamId;
    if (teamIndex === null || teamIndex === undefined) continue;

    const teams = getSnapshot<TeamData[]>(season.id, 'teams');
    const schedule = getSnapshot<GameData[]>(season.id, 'schedule');

    // ── Prestige + unit grades (from the league-wide teams snapshot) ──
    if (teams) {
      const pool = teams.filter(isRealProgram);
      const me = pool.find((t) => t.teamIndex === teamIndex);
      if (me) {
        teamName = me.displayName;

        const prestigePop = pool.map((t) => t.teamPrestige).filter((v) => Number.isFinite(v));
        const confPool = me.conferenceName
          ? pool.filter((t) => t.conferenceName === me.conferenceName).map((t) => t.teamPrestige)
          : [];
        const previous = prestige.length ? prestige[prestige.length - 1].value : null;

        prestige.push({
          seasonId: season.id,
          seasonYear: season.seasonYear,
          value: me.teamPrestige,
          nationalRank: rankOf(prestigePop, me.teamPrestige, false),
          nationalPercentile: percentileOf(prestigePop, me.teamPrestige, false),
          comparedTeams: prestigePop.length || null,
          conferenceRank: confPool.length ? rankOf(confPool, me.teamPrestige, false) : null,
          conferenceName: me.conferenceName ?? null,
          changeFromPrevious: previous === null ? null : me.teamPrestige - previous,
        });

        for (const row of units) {
          const key = row.key as keyof TeamData['positionGrades'];
          const value = me.positionGrades?.[key];
          if (value === undefined || !Number.isFinite(value)) continue;
          const pop = pool
            .map((t) => t.positionGrades?.[key])
            .filter((v): v is number => v !== undefined && Number.isFinite(v));
          row.seasons.push({
            seasonId: season.id,
            seasonYear: season.seasonYear,
            value,
            nationalRank: rankOf(pop, value, false),
            nationalPercentile: percentileOf(pop, value, false),
            comparedTeams: pop.length || null,
          });
        }
      }
    }

    // ── Efficiency (from the league-wide schedule snapshot) ──
    if (!schedule) continue;
    const league = aggregateLeagueFromSchedule(schedule);
    const own = league.get(teamIndex) ?? emptyAggregate();
    if (own.games === 0) continue;

    const scheduled = schedule.filter(
      (g) => g.homeTeamIndex === teamIndex || g.awayTeamIndex === teamIndex,
    ).length;
    contributing.push({
      seasonId: season.id,
      seasonYear: season.seasonYear,
      gamesPlayed: own.games,
      complete: scheduled > 0 && own.games >= scheduled,
    });

    const population = [...league.values()].filter((a) => a.games > 0).map(derive);
    const mine = derive(own);

    for (const row of efficiency) {
      const value = mine[row.key as EfficiencyKey];
      if (value === null || !Number.isFinite(value)) continue;
      const pop = population
        .map((p) => p[row.key as EfficiencyKey])
        .filter((v): v is number => v !== null && Number.isFinite(v));
      row.seasons.push({
        seasonId: season.id,
        seasonYear: season.seasonYear,
        value,
        nationalRank: rankOf(pop, value, row.lowerIsBetter),
        nationalPercentile: percentileOf(pop, value, row.lowerIsBetter),
        comparedTeams: pop.length || null,
      });
    }
  }

  // Nothing on record at all — the caller shows its own empty state rather than
  // rendering three headings over three blank panels.
  if (prestige.length === 0 && contributing.length === 0) return null;

  return {
    teamName,
    prestigeMax: PRESTIGE_MAX,
    prestige,
    units: units.filter((u) => u.seasons.length > 0),
    efficiency: efficiency.filter((e) => e.seasons.length > 0),
    seasons: contributing,
  };
}
