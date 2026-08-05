/**
 * Which poll a displayed rank comes from.
 *
 * THE GAME'S OWN SCOREBOARD SHOWS THE CFP NUMBER once the committee has
 * released one, and the media (AP) number before that — the real broadcast
 * convention, and what a dynasty sees on screen every week. The app used to
 * show the media poll everywhere, so from roughly week 9 onward almost every
 * rank in DynastyOS quietly disagreed with the game it was describing.
 *
 * User-reported 2026-08-04 from a week-15 matchup: the in-game scoreboard read
 * "1 UCLA" and "24 USC" while Game Info showed UCLA #2 and no badge at all for
 * USC. Measured on that season's archive, the two polls disagree for 128 of 138
 * FBS teams — including three of the top four (Oklahoma CFP #1 / media #3, Ohio
 * State CFP #2 / media #1, Louisville CFP #4 / media #2) — and two teams sat
 * inside the CFP top 25 while outside the media top 25, which is exactly the
 * case that renders as no badge instead of a number.
 *
 * `0` IS "NOT RANKED / POLL NOT RELEASED", not a rank — the polls cover all 138
 * FBS teams and use zero for absent, so it must become null rather than a
 * number that would sort ahead of #1. That encoding is why this cannot be a
 * plain `??`: the CFP field is present and zero all season until the committee
 * first meets, so it has to be tested for a real value, not for existence.
 *
 * This is deliberately ONE function used by every rank surface (Game Info,
 * Scores, Schedule, program History). They each resolved ranks their own way
 * before, and History already preferred CFP as a fallback while the others
 * ignored the field entirely — so they disagreed with each other as well as
 * with the game.
 */

/** A poll ranks every FBS team; only the first 25 are "ranked" as a scoreboard means it. */
export const POLL_RANKED_CUTOFF = 25;

/**
 * The rank to show, given both polls' numbers for the same moment.
 *
 * Pass the CFP and media values from the SAME source — both captured at
 * kickoff, or both current. Mixing a captured CFP rank with a live media rank
 * would produce a number belonging to no particular week.
 */
export function displayRank(mediaRank: number | null | undefined, cfpRank: number | null | undefined): number | null {
  const cfp = cfpRank && cfpRank > 0 ? cfpRank : null;
  const media = mediaRank && mediaRank > 0 ? mediaRank : null;
  return cfp ?? media;
}

/** True when a resolved rank is inside the top 25 — the only ranks worth printing. */
export function isRanked(rank: number | null | undefined): rank is number {
  return rank !== null && rank !== undefined && rank > 0 && rank <= POLL_RANKED_CUTOFF;
}
