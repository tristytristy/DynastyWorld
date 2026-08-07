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
import type { CoachLeaderboards, CoachLeaderboard, CoachLeaderboardRow } from '../shared/types';

/**
 * TOP 25 IN EVERY CATEGORY, over a career under this coach.
 *
 * Each player's seasons are folded into ONE line first, then ranked — so a
 * four-year starter appears once with four years added together, not four
 * times. That is what makes these boards a shortlist of *players* rather than
 * of seasons, which is what the Hall wants from them.
 *
 * Built from SEASON lines for the same reason getCoachStatistics is: a career
 * line carries years under other coaches at other schools, and crediting those
 * here would rank someone for football this coach never saw.
 *
 * A player is identified by PresentationId, which is stable across seasons, so
 * folding is just a keyed sum. Name and position come from the LAST season he
 * appears in — players change position and get renamed, and the most recent
 * reading is the one that matches how the user thinks of him now.
 */

const TOP_N = 10;

/**
 * Rate stats need a floor or they are meaningless: a backup who threw one
 * completion sits at 100% above every real quarterback.
 */
const MIN_ATTEMPTS_FOR_RATE = 100;

interface Folded {
  playerId: number;
  name: string;
  position: string | null;
  /** The school he last played for under this coach — see the row mapping. */
  teamName: string | null;
  /** His last roster row, so the Hall can draw a hover card without a second fetch. */
  roster: RosterPlayerData | null;
  /** The season that roster row came from — the hover card labels itself with it. */
  rosterSeasonYear: number | null;
  /**
   * And its season id, which the player modal needs to resolve him at all: a
   * leaderboard is full of players who have since graduated, and looking one up
   * against the CURRENT season finds nobody.
   */
  rosterSeasonId: number | null;
  firstSeason: number;
  lastSeason: number;
  seasons: number;
  off: OffensiveStatLine | null;
  def: DefensiveStatLine | null;
  ol: OLineStatLine | null;
}

type AnyLine = OffensiveStatLine | DefensiveStatLine | OLineStatLine;

function isOffense(line: AnyLine): line is OffensiveStatLine {
  return 'passYards' in line;
}
function isOLine(line: AnyLine): line is OLineStatLine {
  return 'pancakes' in line;
}

/**
 * Adds every numeric field of `from` into `into`, creating it on first sight.
 *
 * Cast internally rather than constraining T to Record<string, number>: the
 * stat-line interfaces are all-number but carry no index signature, and adding
 * one to them would weaken every other use. The cast is contained here, and the
 * shapes really are flat number maps — nothing nested to get wrong.
 */
function accumulate<T extends object>(into: T | null, from: T): T {
  if (!into) return { ...from };
  const out = { ...into } as Record<string, number>;
  const src = from as unknown as Record<string, number>;
  for (const key of Object.keys(src)) out[key] = (out[key] ?? 0) + src[key];
  return out as unknown as T;
}

/** One board. `value` is what ranks; `detail` is the context line under the number. */
interface Spec {
  key: string;
  label: string;
  /** Which of the Hall's three formations this board belongs beneath. */
  group: 'offense' | 'defense' | 'specialists';
  unit: string;
  value: (p: Folded) => number;
  detail?: (p: Folded) => string | null;
  /** Rate stats rank only among players who cleared the floor. */
  eligible?: (p: Folded) => boolean;
}

const SPECS: Spec[] = [
  // Offense, in the 3x3 the Hall lays them out in: passing, rushing, receiving.
  { key: 'passYards', group: 'offense', label: 'Passing Yards', unit: 'yds', value: (p) => p.off?.passYards ?? 0 },
  { key: 'passTDs', group: 'offense', label: 'Passing TD', unit: '', value: (p) => p.off?.passTDs ?? 0 },
  {
    key: 'passPct', group: 'offense', label: 'Passing %', unit: '%',
    value: (p) => (p.off && p.off.passAttempts > 0 ? (p.off.passCompletions / p.off.passAttempts) * 100 : 0),
    eligible: (p) => (p.off?.passAttempts ?? 0) >= MIN_ATTEMPTS_FOR_RATE,
  },
  { key: 'rushAttempts', group: 'offense', label: 'Rush ATT', unit: '', value: (p) => p.off?.rushAttempts ?? 0 },
  { key: 'rushYards', group: 'offense', label: 'Rush YDS', unit: 'yds', value: (p) => p.off?.rushYards ?? 0 },
  { key: 'rushTDs', group: 'offense', label: 'Rush TD', unit: '', value: (p) => p.off?.rushTDs ?? 0 },
  { key: 'receptions', group: 'offense', label: 'Receptions', unit: '', value: (p) => p.off?.receptions ?? 0 },
  { key: 'receivingYards', group: 'offense', label: 'Rec Yards', unit: 'yds', value: (p) => p.off?.receivingYards ?? 0 },
  { key: 'receivingTDs', group: 'offense', label: 'Rec TDs', unit: '', value: (p) => p.off?.receivingTDs ?? 0 },

  // Defense, in its 2x2.
  { key: 'tackles', group: 'defense', label: 'Tackles', unit: '', value: (p) => p.def?.tackles ?? 0 },
  { key: 'sacks', group: 'defense', label: 'Sacks', unit: '', value: (p) => p.def?.sacks ?? 0 },
  { key: 'interceptions', group: 'defense', label: 'Interceptions', unit: '', value: (p) => p.def?.interceptions ?? 0 },
  /*
    Both halves: a pick-six and a scoop-and-score are the same achievement.
    `?? 0` on each because a snapshot predating fumbleTDs has the field missing,
    and `number + undefined` is NaN — which fails the `value > 0` filter and
    made the whole board vanish instead of showing what it did know.
  */
  { key: 'defTDs', group: 'defense', label: 'Def TD', unit: '',
    value: (p) => (p.def ? (p.def.interceptionTDs ?? 0) + (p.def.fumbleTDs ?? 0) : 0) },

  /*
    Special teams. Return duty is tracked on both the offensive and defensive
    variants — a returner is whichever side of the ball he plays the rest of the
    time — so both are summed rather than one being picked. Kicking is a
    separate save table and comes later.
  */
  { key: 'returnTDs', group: 'specialists', label: 'Return TD', unit: '',
    value: (p) =>
      (p.off ? p.off.kickReturnTDs + p.off.puntReturnTDs : 0) +
      (p.def ? p.def.kickReturnTDs + p.def.puntReturnTDs : 0) },
];

export function getCoachLeaderboards(dynastyId: string): CoachLeaderboards | undefined {
  const coachId = activeCoachId(dynastyId);
  if (coachId === null) return undefined;

  const seasons = coachSeasons(dynastyId, coachId);
  if (seasons.length === 0) return undefined;

  const folded = new Map<number, Folded>();
  let counted = 0;

  for (const season of seasons) {
    const stats = getSnapshot<PlayerStatsData[]>(season.seasonId, 'stats');
    if (!stats || stats.length === 0) continue;
    counted++;

    const roster = getSnapshot<RosterPlayerData[]>(season.seasonId, 'roster') ?? [];
    const byId = new Map(roster.map((p) => [p.id, p]));
    const teams = getSnapshot<TeamData[]>(season.seasonId, 'teams') ?? [];
    const teamName =
      season.teamIndex === null
        ? null
        : (teams.find((t) => t.teamIndex === season.teamIndex)?.displayName ?? null);

    for (const entry of stats) {
      if (!entry.season) continue;
      const who = byId.get(entry.playerId);
      const existing = folded.get(entry.playerId);
      const base: Folded = existing ?? {
        playerId: entry.playerId,
        name: 'Unknown player',
        position: null,
        teamName: null,
        roster: null,
        rosterSeasonYear: null,
        rosterSeasonId: null,
        firstSeason: season.seasonYear,
        lastSeason: season.seasonYear,
        seasons: 0,
        off: null,
        def: null,
        ol: null,
      };

      // Newest reading wins for identity — players are renamed and move
      // position, and the school follows the same rule: a player who came with
      // the coach shows where he finished, not where he started.
      if (who) {
        base.name = `${who.firstName} ${who.lastName}`.trim();
        base.position = who.position;
        base.roster = who;
        base.rosterSeasonYear = season.seasonYear;
        base.rosterSeasonId = season.seasonId;
      }
      if (teamName) base.teamName = teamName;
      base.firstSeason = Math.min(base.firstSeason, season.seasonYear);
      base.lastSeason = Math.max(base.lastSeason, season.seasonYear);
      base.seasons += 1;

      const line = entry.season;
      if (isOLine(line)) base.ol = accumulate(base.ol, line);
      else if (isOffense(line)) base.off = accumulate(base.off, line);
      else base.def = accumulate(base.def, line);

      folded.set(entry.playerId, base);
    }
  }

  if (counted === 0) return undefined;

  const players = [...folded.values()];
  const boards: CoachLeaderboard[] = SPECS.map((spec) => {
    const rows: CoachLeaderboardRow[] = players
      .filter((p) => (spec.eligible ? spec.eligible(p) : true))
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.name,
        position: p.position,
        /*
          The school matters because a coach can move: two players on the same
          board may have produced for different programmes under the same man,
          and a bare name would quietly imply they were team-mates.
        */
        teamName: p.teamName,
        span: p.firstSeason === p.lastSeason ? `${p.firstSeason}` : `${p.firstSeason}–${p.lastSeason}`,
        value: spec.value(p),
      }))
      // A zero is "he doesn't do this", not a ranking — a board of 25 players
      // with none of the stat would be noise dressed as a leaderboard.
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);

    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      group: spec.group,
      decimals: spec.key === 'passPct' ? 1 : 0,
      minimumNote: spec.eligible ? `min ${MIN_ATTEMPTS_FOR_RATE} att` : null,
      rows,
    };
  }).filter((b) => b.rows.length > 0);

  /*
    Emitted ONCE, keyed by id, rather than embedded in every row: fourteen boards
    of ten is 140 rows and the same quarterback appears on several of them. The
    Hall needs the whole roster row to draw a hover card, and duplicating an
    18-field object per appearance would be most of the payload for none of the
    information.
  */
  const ranked = new Set(boards.flatMap((b) => b.rows.map((r) => r.playerId)));
  const rankedPlayers = [...folded.values()]
    .filter((p) => ranked.has(p.playerId) && p.roster)
    .map((p) => ({
      player: p.roster as RosterPlayerData,
      seasonYear: p.rosterSeasonYear,
      seasonId: p.rosterSeasonId,
      teamName: p.teamName,
    }));

  return { coachId, seasonsCounted: counted, boards, players: rankedPlayers };
}
