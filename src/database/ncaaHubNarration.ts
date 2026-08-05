import { pickVariant, pickVariantFor } from '../shared/storyVariants';
import { NOTABLE_STREAK, type TeamStreak } from './ncaaHubStreaks';

/**
 * Phrase pools for the stories built in the main process (game of the week,
 * upset of the week, the upcoming watchlist, coach spotlight).
 *
 * The split this file exists to enforce: `getNcaaHub.ts` computes FACTS —
 * scores, ranks, streaks, prestige — and this file only ever chooses WORDS for
 * facts it was handed. Nothing here derives a number, and nothing here is
 * allowed to state one it wasn't given. That matters more than it would in a
 * typical app: this is an archival tool, and a storyline that misreports a
 * score is a trust bug, not a cosmetic one.
 *
 * It is also the seam for later: swapping these pools for a model call means
 * replacing the bodies below, with fact computation and rendering untouched.
 */

/** A poll rank only counts as "ranked" for prose when it's inside the Top 25 — the save ranks all 138 FBS teams, so a bare rank number means nothing on its own. */
export const RANKED_LIMIT = 25;

function rankedPrefix(rank: number | null): string {
  return rank !== null && rank <= RANKED_LIMIT ? `No. ${rank} ` : '';
}

// ---------------------------------------------------------------- streak clause

const EXTENDED_STREAK = [
  (team: string, runs: number) => `That is ${runs} straight for ${team}.`,
  (team: string, runs: number) => `${team} has now won ${runs} in a row.`,
  (_team: string, runs: number) => `The winning streak is up to ${runs}.`,
  (team: string, runs: number) => `Make it ${runs} consecutive wins for ${team}.`,
];

const SNAPPED_STREAK = [
  (_team: string, runs: number) => `It snapped a ${runs}-game losing streak.`,
  (team: string, runs: number) => `${team} ended a ${runs}-game skid.`,
  (_team: string, runs: number) => `That is the end of a ${runs}-game slide.`,
];

/**
 * The clause that acknowledges what the winner walked in carrying. `streak` is
 * the run entering the game, so an extended streak reports `length + 1` (this
 * result included) while a snapped one reports the skid at its full length.
 * Returns '' below the notable threshold rather than forcing a storyline onto
 * a team that simply won a game.
 */
function streakClause(winner: string, streak: TeamStreak | null, seed: string): string {
  if (!streak || streak.length < NOTABLE_STREAK) return '';
  if (streak.kind === 'win') return ` ${pickVariantFor(EXTENDED_STREAK, seed, 'streak')(winner, streak.length + 1)}`;
  if (streak.kind === 'loss') return ` ${pickVariantFor(SNAPPED_STREAK, seed, 'streak')(winner, streak.length)}`;
  return '';
}

// ------------------------------------------------------------ game of the week

export interface GameResultFacts {
  seed: string;
  /** Null when the game ended level — the pools below all assume a winner, so a tie takes its own path. */
  winnerName: string | null;
  loserName: string | null;
  homeTeamName: string;
  awayTeamName: string;
  winnerScore: number;
  loserScore: number;
  /** Top-25 poll rank, or null. Only ever used to prefix a team name. */
  winnerRank: number | null;
  loserRank: number | null;
  /** The winner's run entering this game, or null when it couldn't be computed. */
  winnerStreak: TeamStreak | null;
}

type ResultPhrase = (facts: GameResultFacts, winner: string, loser: string) => string;

const NAILBITER: ResultPhrase[] = [
  (f, w, l) => `${w} survived ${rankedPrefix(f.loserRank)}${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `${w} needed every snap to get past ${l}, ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `It came down to the wire: ${w} ${f.winnerScore}, ${l} ${f.loserScore}.`,
  (f, w, l) => `A ${f.winnerScore}-${f.loserScore} finish went ${w}'s way over ${l}.`,
];

const CLOSE: ResultPhrase[] = [
  (f, w, l) => `${w} held off ${rankedPrefix(f.loserRank)}${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `${w} closed out ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `${l} could not find the answer, falling ${f.loserScore}-${f.winnerScore} to ${w}.`,
  (f, w, l) => `${w} beat ${l} ${f.winnerScore}-${f.loserScore} in a game that stayed in doubt.`,
];

const COMFORTABLE: ResultPhrase[] = [
  (f, w, l) => `${w} handled ${rankedPrefix(f.loserRank)}${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `${w} pulled away from ${l} for a ${f.winnerScore}-${f.loserScore} win.`,
  (f, w, l) => `${w} controlled it from there, ${f.winnerScore}-${f.loserScore} over ${l}.`,
  (f, w, l) => `${l} never got even, and ${w} took it ${f.winnerScore}-${f.loserScore}.`,
];

const BLOWOUT: ResultPhrase[] = [
  (f, w, l) => `${w} rolled ${rankedPrefix(f.loserRank)}${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `${w} buried ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, w, l) => `It was over early: ${w} ${f.winnerScore}, ${l} ${f.loserScore}.`,
  (f, w, l) => `${w} left no doubt against ${l}, ${f.winnerScore}-${f.loserScore}.`,
];

const TIED: ((facts: GameResultFacts) => string)[] = [
  (f) => `${f.awayTeamName} and ${f.homeTeamName} finished level at ${f.winnerScore}.`,
  (f) => `Neither side could separate: ${f.awayTeamName} and ${f.homeTeamName} tied ${f.winnerScore}-${f.loserScore}.`,
];

/** Margin decides the tone. A three-point escape and a 45-point demolition read nothing alike, and the old single template made them identical. */
function marginPool(margin: number): ResultPhrase[] {
  if (margin <= 3) return NAILBITER;
  if (margin <= 7) return CLOSE;
  if (margin <= 17) return COMFORTABLE;
  return BLOWOUT;
}

export function narrateGameResult(facts: GameResultFacts): string {
  if (!facts.winnerName || !facts.loserName) {
    return pickVariant(TIED, facts.seed)(facts);
  }

  const winner = `${rankedPrefix(facts.winnerRank)}${facts.winnerName}`;
  const lead = pickVariant(marginPool(facts.winnerScore - facts.loserScore), facts.seed)(
    facts,
    winner,
    facts.loserName,
  );
  return `${lead}${streakClause(facts.winnerName, facts.winnerStreak, facts.seed)}`;
}

// ------------------------------------------------------------------- the upset

export interface UpsetFacts {
  seed: string;
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  /** Full-league poll ranks (1-138), not just the Top 25 — the gap between them IS the story. */
  winnerRank: number | null;
  loserRank: number | null;
  /** How many poll spots the winner reached up: winnerRank - loserRank, always positive here. */
  rankSwing: number;
  winnerStreak: TeamStreak | null;
}

type UpsetPhrase = (facts: UpsetFacts, loser: string) => string;

/** A single-digit swing between two teams a few spots apart. Real, but not a stunner — the wording shouldn't oversell it. */
const NARROW_UPSET: UpsetPhrase[] = [
  (f, l) => `${f.winnerName} knocked off ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${f.winnerName} took down higher-ranked ${l}, ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${f.winnerName} won the one it was not supposed to, ${f.winnerScore}-${f.loserScore} over ${l}.`,
];

const CLEAR_UPSET: UpsetPhrase[] = [
  (f, l) => `${f.winnerName} upset ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${f.winnerName} went into the weekend an afterthought and beat ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${l} was the better team on paper. ${f.winnerName} won ${f.winnerScore}-${f.loserScore} anyway.`,
  (f, l) => `${f.winnerName} climbed ${f.rankSwing} poll spots' worth of opponent and beat ${l} ${f.winnerScore}-${f.loserScore}.`,
];

const STUNNER: UpsetPhrase[] = [
  (f, l) => `${f.winnerName} stunned ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `Nobody had this one: ${f.winnerName} over ${l}, ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${f.winnerName} authored the shock of the week, beating ${l} ${f.winnerScore}-${f.loserScore}.`,
  (f, l) => `${l} lost to a team ${f.rankSwing} spots below it in the poll, ${f.loserScore}-${f.winnerScore}.`,
];

export function narrateUpset(facts: UpsetFacts): string {
  const pool = facts.rankSwing <= 10 ? NARROW_UPSET : facts.rankSwing <= 30 ? CLEAR_UPSET : STUNNER;
  const loser = `${rankedPrefix(facts.loserRank)}${facts.loserName}`;
  return `${pickVariant(pool, facts.seed)(facts, loser)}${streakClause(facts.winnerName, facts.winnerStreak, facts.seed)}`;
}

// -------------------------------------------------------------- upcoming games

export interface UpcomingFacts {
  seed: string;
  homeTeamName: string;
  awayTeamName: string;
  /** Top-25 ranks only — a #96 vs #104 matchup is not a ranked matchup, and the old template called every game one. */
  homeRank: number | null;
  awayRank: number | null;
  isNationalChampionship: boolean;
  isBowlGame: boolean;
  bowlName: string | null;
  isNeutralSite: boolean;
}

const TITLE_GAME = [
  'The national title game is on deck.',
  'Everything comes down to this one.',
  'One game left, and the trophy is on it.',
];

const BOWL_GAME = [
  (name: string) => `${name} spotlight.`,
  (name: string) => `The ${name} headlines the postseason slate.`,
  (name: string) => `Bowl season rolls on with the ${name}.`,
];

const TOP_TEN_CLASH = [
  (high: number, low: number) => `A top-ten meeting: No. ${high} against No. ${low}.`,
  (high: number, low: number) => `No. ${high} and No. ${low} is the game the week is built around.`,
  (high: number, low: number) => `Two of the top ten collide, No. ${high} versus No. ${low}.`,
];

const RANKED_CLASH = [
  (high: number, low: number) => `No. ${high} and No. ${low} both have plenty to lose.`,
  (high: number, low: number) => `A ranked matchup, No. ${high} against No. ${low}.`,
  (high: number, low: number) => `Poll implications either way: No. ${high} versus No. ${low}.`,
];

const ONE_RANKED = [
  (ranked: string, rank: number, other: string) => `No. ${rank} ${ranked} has to get through ${other}.`,
  (ranked: string, rank: number, other: string) => `${other} gets its shot at No. ${rank} ${ranked}.`,
  (ranked: string, rank: number, other: string) => `A ranked side on the road to trip up: No. ${rank} ${ranked} versus ${other}.`,
];

const NEUTRAL_SITE = [
  'A neutral-site stage with no true home crowd.',
  'Neither side gets the home sideline for this one.',
  'A neutral field, and a neutral crowd, decide it.',
];

const PLAIN_MATCHUP = [
  (away: string, home: string) => `${away} travels to ${home}.`,
  (away: string, home: string) => `${home} hosts ${away} on the watchlist.`,
  (away: string, home: string) => `${away} and ${home} round out the slate worth watching.`,
];

export function narrateUpcoming(facts: UpcomingFacts): string {
  if (facts.isNationalChampionship) return pickVariant(TITLE_GAME, facts.seed);
  if (facts.isBowlGame && facts.bowlName) return pickVariant(BOWL_GAME, facts.seed)(facts.bowlName);

  const ranks = [facts.homeRank, facts.awayRank].filter((rank): rank is number => rank !== null).sort((a, b) => a - b);
  if (ranks.length === 2) {
    const pool = ranks[1] <= 10 ? TOP_TEN_CLASH : RANKED_CLASH;
    return pickVariant(pool, facts.seed)(ranks[0], ranks[1]);
  }
  if (ranks.length === 1) {
    const rankedIsHome = facts.homeRank !== null;
    return pickVariant(ONE_RANKED, facts.seed)(
      rankedIsHome ? facts.homeTeamName : facts.awayTeamName,
      ranks[0],
      rankedIsHome ? facts.awayTeamName : facts.homeTeamName,
    );
  }
  if (facts.isNeutralSite) return pickVariant(NEUTRAL_SITE, facts.seed);
  return pickVariant(PLAIN_MATCHUP, facts.seed)(facts.awayTeamName, facts.homeTeamName);
}

// ------------------------------------------------------------- coach spotlight

export interface CoachSpotlightFacts {
  seed: string;
  coachName: string;
  teamName: string;
  wins: number;
  losses: number;
  /** Top-25 rank, or null. */
  rank: number | null;
  /** The save's program prestige on its own 1-10 scale (the same number the Yearbook prints as "n/10"), or null when unset. */
  prestige: number | null;
  streak: TeamStreak | null;
  recentForm: { wins: number; losses: number; games: number };
  /** Movement in the media poll since last week: positive is a climb. Null when there's no prior poll to compare against. */
  rankMovement: number | null;
}

const OVERACHIEVING = [
  (f: CoachSpotlightFacts) => `${f.teamName} is ${f.wins}-${f.losses} out of a program the game rates ${f.prestige}/10.`,
  (f: CoachSpotlightFacts) => `Nobody expected ${f.wins}-${f.losses} from a ${f.prestige}-of-10 prestige job, but that is where ${f.teamName} sits.`,
  (f: CoachSpotlightFacts) => `${f.coachName} has ${f.teamName} at ${f.wins}-${f.losses} with only ${f.prestige}/10 prestige behind the program.`,
];

const RANKED_RUN = [
  (f: CoachSpotlightFacts) => `${f.teamName} is ${f.wins}-${f.losses} and No. ${f.rank} in the media poll.`,
  (f: CoachSpotlightFacts) => `A ${f.wins}-${f.losses} record has ${f.teamName} sitting at No. ${f.rank}.`,
  (f: CoachSpotlightFacts) => `${f.coachName}'s team is ranked No. ${f.rank} at ${f.wins}-${f.losses}.`,
];

const CLIMBING = [
  (f: CoachSpotlightFacts) => `${f.teamName} is ${f.wins}-${f.losses} and up ${f.rankMovement} spots in the poll to No. ${f.rank}.`,
  (f: CoachSpotlightFacts) => `${f.rankMovement} poll spots in a week has ${f.teamName} at No. ${f.rank}, ${f.wins}-${f.losses}.`,
];

const STEADY_BUILD = [
  (f: CoachSpotlightFacts) => `${f.teamName} has quietly reached ${f.wins}-${f.losses}.`,
  (f: CoachSpotlightFacts) => `${f.coachName} is ${f.wins}-${f.losses} with ${f.teamName} this season.`,
  (f: CoachSpotlightFacts) => `The record reads ${f.wins}-${f.losses} for ${f.teamName}.`,
];

const FORM_CLAUSE = [
  (won: number, games: number) => `They have won ${won} of their last ${games}.`,
  (won: number, games: number) => `That is ${won} wins in the last ${games} games.`,
];

const RUN_CLAUSE = [
  (runs: number) => `The winning streak stands at ${runs}.`,
  (runs: number) => `They have taken ${runs} in a row.`,
];

/**
 * Picks a lead by which fact is actually the story — a strong record at a
 * low-prestige program is a different sentence from a top-ten team doing what
 * top-ten teams do — then adds at most one supporting clause, so the card
 * stays a sentence or two rather than a stat dump.
 */
export function narrateCoachSpotlight(facts: CoachSpotlightFacts): string {
  // Prestige is a 1-10 scale, so "underdog" is the bottom half of it — an
  // 8/10 blue blood winning games is not the overachievement story, and an
  // earlier 0-100 assumption here put that sentence on Tennessee.
  const underdog = facts.prestige !== null && facts.prestige <= 5 && facts.wins > facts.losses;
  const climbing = facts.rank !== null && facts.rankMovement !== null && facts.rankMovement >= 3;

  const lead = underdog
    ? pickVariant(OVERACHIEVING, facts.seed)(facts)
    : climbing
      ? pickVariant(CLIMBING, facts.seed)(facts)
      : facts.rank !== null
        ? pickVariant(RANKED_RUN, facts.seed)(facts)
        : pickVariant(STEADY_BUILD, facts.seed)(facts);

  if (facts.streak && facts.streak.kind === 'win' && facts.streak.length >= NOTABLE_STREAK) {
    return `${lead} ${pickVariantFor(RUN_CLAUSE, facts.seed, 'run')(facts.streak.length)}`;
  }
  if (facts.recentForm.games >= 4 && facts.recentForm.wins > facts.recentForm.losses) {
    return `${lead} ${pickVariantFor(FORM_CLAUSE, facts.seed, 'form')(facts.recentForm.wins, facts.recentForm.games)}`;
  }
  return lead;
}
