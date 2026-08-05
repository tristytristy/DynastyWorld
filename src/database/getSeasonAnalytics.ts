import { offenseYards } from '../shared/teamYards';
import { isGamePlayed } from '../shared/gameStatus';
import { getCurrentSeason, getDynastyById, getSeasonById, getSnapshot } from './helpers';
import { getTeamGameStats } from './getTeamGameStats';
import type { GameData } from '../extractors/extract-schedule';
import type {
  SeasonAnalytics,
  SeasonFinding,
  SeasonGamePoint,
  SeasonIdentityMetric,
  TeamGameStat,
} from '../shared/types';

/**
 * Season Lab's aggregation — one selected season, explained.
 *
 * Every number here is read from a snapshot or derived by arithmetic over one.
 * Nothing is modelled or estimated: no EPA, no success rate, no drive data,
 * because the save doesn't carry play-by-play. Provenance for each field is in
 * docs/planning/ANALYTICS_PHASE0_AUDIT.md.
 *
 * Two behaviours worth knowing before changing anything here:
 *
 *  • **Quarter scores are regulation only.** Across all 944 league games, 47 had
 *    quarter sums that disagreed with the final score, and every one of those 47
 *    was tied after regulation — they went to overtime, and OT points land only
 *    in the final. So a quarter row will NOT sum to the game's margin in an OT
 *    game, and that is disclosed rather than silently wrong.
 *
 *  • **`has_full_data` does not mean "analysable".** It reads 1 even for a season
 *    with zero games and no schedule snapshot, so games played and the presence
 *    of a schedule decide `partial` vs `complete`. The flag is used for exactly
 *    one thing: telling a backfilled history-only season (which will never gain
 *    a schedule) apart from a preseason one (which will).
 */

/** Metrics where a smaller number is the better outcome. */
export const LOWER_IS_BETTER = new Set(['pointsAllowed', 'yardsAllowed', 'penaltyYards']);

export interface LeagueAggregate {
  games: number;
  points: number;
  pointsAllowed: number;
  yards: number;
  yardsAllowed: number;
  thirdDownConv: number;
  thirdDownAtt: number;
  sacks: number;
  turnovers: number;
  takeaways: number;
  penaltyYards: number;
}

export const emptyAggregate = (): LeagueAggregate => ({
  games: 0,
  points: 0,
  pointsAllowed: 0,
  yards: 0,
  yardsAllowed: 0,
  thirdDownConv: 0,
  thirdDownAtt: 0,
  sacks: 0,
  turnovers: 0,
  takeaways: 0,
  penaltyYards: 0,
});

/**
 * Percentile of `value` within `population`, as "percent of teams this beats".
 * Returns null for an empty population rather than a misleading 0 or 50.
 */
export function percentileOf(population: number[], value: number, lowerIsBetter: boolean): number | null {
  const values = population.filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  const beaten = values.filter((v) => (lowerIsBetter ? v > value : v < value)).length;
  return Math.round((100 * beaten) / values.length);
}

/** 1-based rank, best first. Null for an empty population. */
export function rankOf(population: number[], value: number, lowerIsBetter: boolean): number | null {
  const values = population.filter((v) => Number.isFinite(v));
  if (values.length === 0) return null;
  const better = values.filter((v) => (lowerIsBetter ? v < value : v > value)).length;
  return better + 1;
}

/**
 * Builds the per-game points for the journey and quarter exhibits.
 * `quarters` maps gameId → the raw snapshot game, for the quarter scores that
 * getTeamGameStats doesn't carry.
 */
export function buildJourney(
  games: TeamGameStat[],
  rawByGameId: Map<number, GameData>,
  teamIndex: number,
): SeasonGamePoint[] {
  return games
    .filter((g) => g.played && g.teamScore !== null && g.opponentScore !== null)
    .map((g): SeasonGamePoint => {
      const raw = rawByGameId.get(g.gameId);
      const isHome = raw ? raw.homeTeamIndex === teamIndex : g.siteType === 'home';
      const teamScore = g.teamScore as number;
      const opponentScore = g.opponentScore as number;

      let quarterDifferential: number[] | null = null;
      let wentToOvertime = false;
      if (raw) {
        const ours = isHome ? raw.homeQuarterScores : raw.awayQuarterScores;
        const theirs = isHome ? raw.awayQuarterScores : raw.homeQuarterScores;
        if (Array.isArray(ours) && Array.isArray(theirs) && ours.length === theirs.length && ours.length > 0) {
          quarterDifferential = ours.map((v, i) => v - theirs[i]);
          const regulation = ours.reduce((a, b) => a + b, 0);
          const regulationAgainst = theirs.reduce((a, b) => a + b, 0);
          wentToOvertime = regulation !== teamScore || regulationAgainst !== opponentScore;
        }
      }

      return {
        gameId: g.gameId,
        week: g.week,
        opponent: g.opponent,
        opponentTeamIndex: raw ? (isHome ? raw.awayTeamIndex : raw.homeTeamIndex) : null,
        siteType: g.siteType,
        gameType: g.gameType,
        isRivalry: g.isRivalry,
        teamScore,
        opponentScore,
        margin: teamScore - opponentScore,
        result: teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T',
        quarterDifferential,
        wentToOvertime,
      };
    })
    .sort((a, b) => a.week - b.week);
}

const record = (games: SeasonGamePoint[]) => {
  const w = games.filter((g) => g.result === 'W').length;
  const l = games.filter((g) => g.result === 'L').length;
  return { w, l, text: `${w}-${l}` };
};

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const one = (n: number) => n.toFixed(1);

/**
 * Rule-based, deterministic observations. Descriptive only — these state what
 * happened, never why. Each rule declares its own minimum sample and returns
 * nothing when it isn't met, so a 2-game season can't produce a "trend".
 */
export function buildFindings(journey: SeasonGamePoint[], games: TeamGameStat[]): SeasonFinding[] {
  const found: SeasonFinding[] = [];
  const played = journey.length;
  if (played < 4) return found;

  const statsByGame = new Map(games.map((g) => [g.gameId, g]));

  // 1. Turnover battle — needs both kinds of game to be worth stating.
  const withTurnovers = journey.filter((g) => {
    const s = statsByGame.get(g.gameId);
    return s?.teamStats && s?.opponentStats;
  });
  if (withTurnovers.length >= 4) {
    const won: SeasonGamePoint[] = [];
    const lost: SeasonGamePoint[] = [];
    for (const g of withTurnovers) {
      const s = statsByGame.get(g.gameId)!;
      const margin = (s.teamStats!.takeaways ?? 0) - (s.teamStats!.turnovers ?? 0);
      if (margin >= 0) won.push(g);
      else lost.push(g);
    }
    if (won.length >= 2 && lost.length >= 2) {
      found.push({
        id: 'turnover-battle',
        label: 'Turnover battle',
        statement: `${record(won).text} when winning or tying the turnover battle, ${record(lost).text} when losing it.`,
        support: [
          { label: 'Won/tied it', value: `${won.length} games` },
          { label: 'Lost it', value: `${lost.length} games` },
        ],
        sampleSize: withTurnovers.length,
      });
    }
  }

  // 2. First half vs second half, from quarter data.
  const withQuarters = journey.filter((g) => g.quarterDifferential?.length === 4);
  if (withQuarters.length >= 4) {
    const firstHalf = withQuarters.reduce((a, g) => a + g.quarterDifferential![0] + g.quarterDifferential![1], 0);
    const secondHalf = withQuarters.reduce((a, g) => a + g.quarterDifferential![2] + g.quarterDifferential![3], 0);
    if (Math.abs(firstHalf - secondHalf) >= 20) {
      const stronger = secondHalf > firstHalf ? 'second' : 'first';
      found.push({
        id: 'half-split',
        label: 'Halves',
        statement: `Stronger in the ${stronger} half — ${firstHalf >= 0 ? '+' : ''}${firstHalf} first-half point differential against ${secondHalf >= 0 ? '+' : ''}${secondHalf} in the second.`,
        support: [
          { label: 'First half', value: `${firstHalf >= 0 ? '+' : ''}${firstHalf}` },
          { label: 'Second half', value: `${secondHalf >= 0 ? '+' : ''}${secondHalf}` },
        ],
        sampleSize: withQuarters.length,
      });
    }
  }

  // 3. Home vs away scoring.
  const home = journey.filter((g) => g.siteType === 'home');
  const away = journey.filter((g) => g.siteType === 'away');
  if (home.length >= 3 && away.length >= 3) {
    const homeMargin = avg(home.map((g) => g.margin));
    const awayMargin = avg(away.map((g) => g.margin));
    if (Math.abs(homeMargin - awayMargin) >= 7) {
      found.push({
        id: 'home-away',
        label: 'Home and away',
        statement: `${record(home).text} at home with a ${homeMargin >= 0 ? '+' : ''}${one(homeMargin)} margin, ${record(away).text} away at ${awayMargin >= 0 ? '+' : ''}${one(awayMargin)}.`,
        support: [
          { label: 'Home margin/game', value: `${homeMargin >= 0 ? '+' : ''}${one(homeMargin)}` },
          { label: 'Away margin/game', value: `${awayMargin >= 0 ? '+' : ''}${one(awayMargin)}` },
        ],
        sampleSize: home.length + away.length,
      });
    }
  }

  // 4. Conference vs non-conference.
  const conf = journey.filter((g) => g.gameType === 'conference');
  const nonConf = journey.filter((g) => g.gameType === 'non-conference');
  if (conf.length >= 3 && nonConf.length >= 3) {
    const confMargin = avg(conf.map((g) => g.margin));
    const nonConfMargin = avg(nonConf.map((g) => g.margin));
    if (Math.abs(confMargin - nonConfMargin) >= 7) {
      found.push({
        id: 'conference-split',
        label: 'In conference',
        statement: `${record(conf).text} in conference play at ${confMargin >= 0 ? '+' : ''}${one(confMargin)} per game, ${record(nonConf).text} out of conference at ${nonConfMargin >= 0 ? '+' : ''}${one(nonConfMargin)}.`,
        support: [
          { label: 'Conference', value: `${record(conf).text}` },
          { label: 'Non-conference', value: `${record(nonConf).text}` },
        ],
        sampleSize: conf.length + nonConf.length,
      });
    }
  }

  // 5. One-score games — a real, checkable pattern rather than a narrative.
  const oneScore = journey.filter((g) => Math.abs(g.margin) <= 8);
  if (oneScore.length >= 3) {
    const r = record(oneScore);
    found.push({
      id: 'one-score-games',
      label: 'Close games',
      statement: `${r.text} in one-score games — ${oneScore.length} of ${played} were decided by eight points or fewer.`,
      support: [
        { label: 'One-score record', value: r.text },
        { label: 'Share of season', value: `${Math.round((100 * oneScore.length) / played)}%` },
      ],
      sampleSize: oneScore.length,
    });
  }

  // 6. Closing stretch — only with enough games either side to compare.
  if (played >= 8) {
    const last = journey.slice(-4);
    const earlier = journey.slice(0, -4);
    const lastMargin = avg(last.map((g) => g.margin));
    const earlierMargin = avg(earlier.map((g) => g.margin));
    if (Math.abs(lastMargin - earlierMargin) >= 10) {
      found.push({
        id: 'closing-stretch',
        label: 'Closing stretch',
        statement: `${lastMargin > earlierMargin ? 'Finished stronger' : 'Faded late'} — ${lastMargin >= 0 ? '+' : ''}${one(lastMargin)} margin over the last four games against ${earlierMargin >= 0 ? '+' : ''}${one(earlierMargin)} before them.`,
        support: [
          { label: 'Last 4', value: `${record(last).text}` },
          { label: 'Before that', value: `${record(earlier).text}` },
        ],
        sampleSize: played,
      });
    }
  }

  // Highest-value first, capped — four findings is a read, ten is a wall.
  return found.slice(0, 4);
}

/**
 * Per-team season totals, aggregated from every played game in a LEAGUE-WIDE
 * schedule snapshot. Shared by Season Lab (one season's national percentiles)
 * and Program Arc (the same percentiles for every season), so a team's own
 * numbers and the national population they're measured against can never come
 * from two different code paths and drift apart.
 *
 * Teams with no played games are simply absent rather than present as zeroes —
 * counting an unplayed team as 0 points/game would drag every percentile.
 */
export function aggregateLeagueFromSchedule(schedule: GameData[]): Map<number, LeagueAggregate> {
  const league = new Map<number, LeagueAggregate>();
  for (const g of schedule) {
    if (!isGamePlayed(g.status)) continue;
    for (const side of ['home', 'away'] as const) {
      const idx = side === 'home' ? g.homeTeamIndex : g.awayTeamIndex;
      if (idx === null || idx === undefined) continue;
      const stats = side === 'home' ? g.homeTeamStats : g.awayTeamStats;
      const oppStats = side === 'home' ? g.awayTeamStats : g.homeTeamStats;
      const points = side === 'home' ? g.homeScore : g.awayScore;
      const against = side === 'home' ? g.awayScore : g.homeScore;
      const a = league.get(idx) ?? emptyAggregate();
      a.games += 1;
      a.points += points ?? 0;
      a.pointsAllowed += against ?? 0;
      if (stats) {
        a.yards += stats ? offenseYards(stats) : 0;
        a.thirdDownConv += stats.thirdDownConversions ?? 0;
        a.thirdDownAtt += stats.thirdDownAttempts ?? 0;
        a.sacks += stats.sacks ?? 0;
        a.turnovers += stats.turnovers ?? 0;
        a.takeaways += stats.takeaways ?? 0;
        a.penaltyYards += stats.penaltyYards ?? 0;
      }
      if (oppStats) a.yardsAllowed += offenseYards(oppStats);
      league.set(idx, a);
    }
  }
  return league;
}

/** Season totals → the per-game / percentage rates everything is compared on. */
export const derive = (a: LeagueAggregate) => ({
  scoring: a.games ? a.points / a.games : null,
  pointsAllowed: a.games ? a.pointsAllowed / a.games : null,
  totalOffense: a.games ? a.yards / a.games : null,
  yardsAllowed: a.games ? a.yardsAllowed / a.games : null,
  thirdDown: a.thirdDownAtt ? (100 * a.thirdDownConv) / a.thirdDownAtt : null,
  turnoverMargin: a.games ? (a.takeaways - a.turnovers) / a.games : null,
  sacks: a.games ? a.sacks / a.games : null,
  penaltyYards: a.games ? a.penaltyYards / a.games : null,
});

export type EfficiencyKey = keyof ReturnType<typeof derive>;

/**
 * The measured dimensions, defined ONCE so "Third down" means precisely the
 * same thing in the Season view and the Yearly view. Red-zone rate and time of
 * possession are deliberately absent: the season `teamStats` snapshot has them
 * but only for the user's team, so they could never carry a national rank.
 */
export const EFFICIENCY_DIMENSIONS: {
  key: EfficiencyKey;
  label: string;
  format: SeasonIdentityMetric['format'];
}[] = [
  { key: 'scoring', label: 'Scoring', format: 'perGame' },
  { key: 'pointsAllowed', label: 'Points allowed', format: 'perGame' },
  { key: 'totalOffense', label: 'Total offense', format: 'perGame' },
  { key: 'yardsAllowed', label: 'Yards allowed', format: 'perGame' },
  { key: 'thirdDown', label: 'Third down', format: 'percent' },
  { key: 'turnoverMargin', label: 'Turnover margin', format: 'plusMinus' },
  { key: 'sacks', label: 'Sacks', format: 'perGame' },
  { key: 'penaltyYards', label: 'Penalty yards', format: 'perGame' },
];

export function getSeasonAnalytics(dynastyId: string, seasonId?: number): SeasonAnalytics | null {
  const dynasty = getDynastyById(dynastyId);
  if (!dynasty) return null;

  const season = seasonId !== undefined ? getSeasonById(seasonId) : getCurrentSeason(dynastyId);
  if (!season || season.dynastyId !== dynastyId) return null;

  const teamIndex = season.userTeamId;
  const schedule = getSnapshot<GameData[]>(season.id, 'schedule');

  const base = {
    seasonId: season.id,
    seasonYear: season.seasonYear,
    teamName: dynasty.teamName ?? '',
  };

  // No schedule snapshot. Two different reasons, and the UI must not conflate
  // them: a history-only season will NEVER gain one (it was backfilled from
  // league history), whereas a preseason capture simply hasn't played yet.
  if (!schedule || teamIndex === null || teamIndex === undefined) {
    return {
      ...base,
      state: season.hasFullData ? 'preseason' : 'history-only',
      gamesPlayed: 0,
      gamesScheduled: 0,
      summary: {
        wins: 0,
        losses: 0,
        ties: 0,
        pointsPerGame: null,
        pointsAllowedPerGame: null,
        scoringMarginPerGame: null,
        turnoverMarginPerGame: null,
      },
      journey: [],
      identity: [],
      findings: [],
      hasOvertimeGames: false,
    };
  }

  const games = getTeamGameStats(dynastyId, null, season.id) ?? [];
  const rawByGameId = new Map(schedule.map((g) => [g.gameId, g]));
  const journey = buildJourney(games, rawByGameId, teamIndex);
  const played = journey.length;

  const wins = journey.filter((g) => g.result === 'W').length;
  const losses = journey.filter((g) => g.result === 'L').length;
  const ties = journey.filter((g) => g.result === 'T').length;

  // Own per-game aggregates, from the same league-wide source used below so the
  // team's numbers and the national population can never drift apart.
  const own = emptyAggregate();
  for (const g of journey) {
    const s = games.find((x) => x.gameId === g.gameId);
    own.games += 1;
    own.points += g.teamScore;
    own.pointsAllowed += g.opponentScore;
    if (s?.teamStats) {
      own.yards += offenseYards(s.teamStats);
      own.thirdDownConv += s.teamStats.thirdDownConversions ?? 0;
      own.thirdDownAtt += s.teamStats.thirdDownAttempts ?? 0;
      own.sacks += s.teamStats.sacks ?? 0;
      own.turnovers += s.teamStats.turnovers ?? 0;
      own.takeaways += s.teamStats.takeaways ?? 0;
      own.penaltyYards += s.teamStats.penaltyYards ?? 0;
    }
    if (s?.opponentStats) own.yardsAllowed += offenseYards(s.opponentStats);
  }

  // League-wide population for percentiles, aggregated from every played game
  // in the schedule snapshot. Teams with no played games are excluded rather
  // than counted as zeroes.
  const league = aggregateLeagueFromSchedule(schedule);

  const population = [...league.values()].filter((a) => a.games > 0).map(derive);
  const mine = derive(own);

  const identity: SeasonIdentityMetric[] = played
    ? EFFICIENCY_DIMENSIONS.flatMap((d) => {
        const value = mine[d.key];
        if (value === null || !Number.isFinite(value)) return [];
        const lowerIsBetter = LOWER_IS_BETTER.has(d.key as string);
        const pop = population.map((p) => p[d.key]).filter((v): v is number => v !== null && Number.isFinite(v));
        return [
          {
            key: d.key as string,
            label: d.label,
            value,
            format: d.format,
            lowerIsBetter,
            nationalPercentile: percentileOf(pop, value, lowerIsBetter),
            nationalRank: rankOf(pop, value, lowerIsBetter),
            comparedTeams: pop.length || null,
          },
        ];
      })
    : [];

  return {
    ...base,
    state: played === 0 ? 'partial' : played >= games.length ? 'complete' : 'partial',
    gamesPlayed: played,
    gamesScheduled: games.length,
    summary: {
      wins,
      losses,
      ties,
      pointsPerGame: played ? own.points / played : null,
      pointsAllowedPerGame: played ? own.pointsAllowed / played : null,
      scoringMarginPerGame: played ? (own.points - own.pointsAllowed) / played : null,
      turnoverMarginPerGame: played ? (own.takeaways - own.turnovers) / played : null,
    },
    journey,
    identity,
    findings: buildFindings(journey, games),
    hasOvertimeGames: journey.some((g) => g.wentToOvertime),
  };
}
