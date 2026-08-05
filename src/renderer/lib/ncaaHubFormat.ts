import { pickVariant, pickVariantFor, storySeed } from '../../shared/storyVariants';
import type { NcaaHubGameFeature, NcaaHubOverview, NcaaHubTop25Entry } from '../../shared/types';

/**
 * Renderer-side prose and formatting for the NCAA Hub dashboard — the small
 * per-game lines the panels share, the rank-movement chip, and the national
 * notebook feed.
 *
 * These are the stories the page composes from data it already has, as opposed
 * to the ones the main process narrates (`database/ncaaHubNarration.ts`). Same
 * rule applies on this side: the pools choose wording for facts handed to them
 * and never derive a number. Same seeding rule too — a story is seeded off the
 * event it describes, so re-opening the page never rewrites the week.
 */

export function gameMetaLine(game: NcaaHubGameFeature): string {
  const parts = [game.date, game.dayOfWeek, game.kickoffTime !== 'TBD' ? game.kickoffTime : null, game.broadcastScope]
    .filter((part) => part && part !== 'TBD')
    .join(' - ');
  return parts || 'Kickoff TBD';
}

export function eventLabel(game: NcaaHubGameFeature): string {
  if (game.isNationalChampionship) return 'National Championship';
  if (game.isBowlGame) return game.bowlName ?? 'Bowl Game';
  return game.isNeutralSite ? 'Neutral Site' : 'Campus Matchup';
}

function gameSeed(game: NcaaHubGameFeature, seasonYear: number): string {
  return storySeed(seasonYear, game.week, game.awayTeamName, game.homeTeamName);
}

// ------------------------------------------------------------------ score line

const SCORE_LINES = [
  (winner: string, _loser: string, high: number, low: number) => `${winner} won ${high}-${low}.`,
  (winner: string, loser: string, high: number, low: number) => `${winner} ${high}, ${loser} ${low}.`,
  (winner: string, _loser: string, high: number, low: number) => `${winner} by ${high - low}, ${high}-${low}.`,
];

/**
 * The bare result, for the places that label it ("Result:") rather than tell a
 * story about it. Kept separate from the narrated summaries on purpose — a
 * labelled fact should not also carry adjectives.
 */
export function gameScoreLine(game: NcaaHubGameFeature, seasonYear: number): string | null {
  if (game.homeScore === null || game.awayScore === null) return null;

  if (game.homeScore === game.awayScore) {
    return `${game.awayTeamName} and ${game.homeTeamName} finished tied at ${game.awayScore}-${game.homeScore}.`;
  }

  const homeWon = game.homeScore > game.awayScore;
  return pickVariant(SCORE_LINES, gameSeed(game, seasonYear))(
    homeWon ? game.homeTeamName : game.awayTeamName,
    homeWon ? game.awayTeamName : game.homeTeamName,
    Math.max(game.homeScore, game.awayScore),
    Math.min(game.homeScore, game.awayScore),
  );
}

// ------------------------------------------------------------ rank movement

export interface RankMovement {
  direction: 'up' | 'down' | 'flat';
  /** Absolute number of spots, 0 when the team held station. */
  spots: number;
  /** Screen-reader/tooltip text — the chip itself is an arrow and a number. */
  label: string;
}

/**
 * A ranking row's movement chip. Reads the entry's OWN poll movement, so a
 * coaches or CFP row is never annotated with media-poll numbers. Returns null
 * when there is no honest comparison to draw — a season synced before the
 * last-week rank was captured, a week before the poll was released, or the CFP
 * (whose last-week rank mirrors its current one) — so the column stays empty
 * rather than claiming everybody held station.
 */
export function rankMovement(entry: NcaaHubTop25Entry): RankMovement | null {
  if (entry.rankMovement === null || entry.lastWeekRank === null) return null;

  const spots = Math.abs(entry.rankMovement);
  if (entry.rankMovement === 0) {
    return { direction: 'flat', spots: 0, label: `Unchanged at No. ${entry.rank}` };
  }
  const direction = entry.rankMovement > 0 ? 'up' : 'down';
  return {
    direction,
    spots,
    label: `${direction === 'up' ? 'Up' : 'Down'} ${spots} from No. ${entry.lastWeekRank} last week`,
  };
}

// ---------------------------------------------------------- national notebook

export interface NotebookItem {
  /** Short category hook, rendered as an eyebrow — the thing that turns a paragraph list into a ticker. */
  tag: string;
  text: string;
  /** The team the line is about, when there is exactly one — lets a row carry a mark and open that team. */
  teamName: string | null;
}

const UNBEATEN_LINES = [
  (count: number, leader: string) => `${count} teams are still unbeaten, led by ${leader}.`,
  (count: number, leader: string) => `${leader} headlines the ${count} programs yet to lose.`,
  (count: number, leader: string) => `The zero is still intact in ${count} places, ${leader} first among them.`,
];

const ONE_LOSS_LINES = [
  (count: number) => `${count} one-loss programs are still very much in the title chase.`,
  (count: number) => `${count} teams carry a single blemish into the closing stretch.`,
  (count: number) => `One loss has not ended it for ${count} teams.`,
];

const RISER_LINES = [
  (team: string, spots: number, rank: number) => `${team} jumped ${spots} spots to No. ${rank}.`,
  (team: string, spots: number, rank: number) => `A ${spots}-spot climb puts ${team} at No. ${rank}.`,
  (team: string, spots: number, rank: number) => `${team} is the week's big riser, up ${spots} to No. ${rank}.`,
];

const FALLER_LINES = [
  (team: string, spots: number, rank: number) => `${team} slid ${spots} spots to No. ${rank}.`,
  (team: string, spots: number, rank: number) => `The poll dropped ${team} ${spots} places, down to No. ${rank}.`,
  (team: string, spots: number, rank: number) => `${team} paid for it in the poll, falling ${spots} to No. ${rank}.`,
];

const SLATE_LINES = [
  (away: string, home: string) => `${away} and ${home} headline the next slate.`,
  (away: string, home: string) => `${away} at ${home} is the one circled on the next board.`,
  (away: string, home: string) => `Next up, ${away} and ${home}.`,
];

const RECRUITING_LINES = [
  (team: string, rank: number) => `${team} continues to set the recruiting pace at No. ${rank}.`,
  (team: string, rank: number) => `No. ${rank} nationally, ${team} is winning the recruiting week.`,
  (team: string, rank: number) => `${team} holds the No. ${rank} class in the country.`,
];

/**
 * The national notebook as a tagged feed. Every line here comes from data the
 * dashboard already renders elsewhere — the value is the category hook in front
 * of it, which is what makes a run of sentences scan as a ticker.
 */
export function notebookItems(hub: NcaaHubOverview): NotebookItem[] {
  const seed = storySeed(hub.seasonYear, hub.upcomingWeek ?? hub.gameOfTheWeek?.week ?? 0, 'notebook');
  const items: NotebookItem[] = [];

  const undefeatedLeader = hub.undefeatedWatch[0];
  if (undefeatedLeader) {
    items.push({
      tag: 'Unbeaten',
      text: pickVariantFor(UNBEATEN_LINES, seed, 'unbeaten')(hub.undefeatedWatch.length, undefeatedLeader.teamName),
      teamName: undefeatedLeader.teamName,
    });
  }

  if (hub.oneLossWatch[0]) {
    items.push({
      tag: 'Title chase',
      text: pickVariantFor(ONE_LOSS_LINES, seed, 'oneloss')(hub.oneLossWatch.length),
      teamName: null,
    });
  }

  // Poll movement only exists once a season has a prior week to compare to, so
  // these two lines simply don't appear in a preseason snapshot.
  const movers = hub.top25.filter((entry) => entry.rankMovement !== null);
  const riser = [...movers].sort((a, b) => (b.rankMovement ?? 0) - (a.rankMovement ?? 0))[0];
  if (riser && (riser.rankMovement ?? 0) >= 3) {
    items.push({
      tag: 'Poll movement',
      text: pickVariantFor(RISER_LINES, seed, 'riser')(riser.teamName, riser.rankMovement ?? 0, riser.rank),
      teamName: riser.teamName,
    });
  }
  const faller = [...movers].sort((a, b) => (a.rankMovement ?? 0) - (b.rankMovement ?? 0))[0];
  if (faller && (faller.rankMovement ?? 0) <= -3) {
    items.push({
      tag: 'Free fall',
      text: pickVariantFor(FALLER_LINES, seed, 'faller')(
        faller.teamName,
        Math.abs(faller.rankMovement ?? 0),
        faller.rank,
      ),
      teamName: faller.teamName,
    });
  }

  const nextGame = hub.upcomingGames[0];
  if (nextGame) {
    items.push({
      tag: 'Next slate',
      text: pickVariantFor(SLATE_LINES, seed, 'slate')(nextGame.awayTeamName, nextGame.homeTeamName),
      teamName: null,
    });
  }

  const recruitingLeader = hub.recruitingBuzz[0];
  if (recruitingLeader) {
    items.push({
      tag: 'Recruiting',
      text: pickVariantFor(RECRUITING_LINES, seed, 'recruiting')(recruitingLeader.teamName, recruitingLeader.rank),
      teamName: recruitingLeader.teamName,
    });
  }

  return items;
}
