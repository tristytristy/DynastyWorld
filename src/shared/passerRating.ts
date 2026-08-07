/**
 * NCAA PASSER RATING (passing efficiency).
 *
 *   (8.4 × yards + 330 × TD − 200 × INT + 100 × completions) ÷ attempts
 *
 * THE SAVE DOES NOT STORE THIS. Confirmed by sweeping every table in a real
 * completed-season save for a field matching RATING/QBR/EFFIC/PASSER: the only
 * stored QB rating in the whole file is `PrologueGameStats.QBRating`, a one-row
 * table for the tutorial game. What the sweep did find is
 * `StatManager.GetPlayerPasserRating` — a function, not a column. The game
 * computes the number when it needs to show it and never writes it down, so if
 * this app wants it, this app derives it.
 *
 * It can, at every scope: PASSCOMPLETED / PASSATTEMPTS / PASSYARDS / PASSTDS /
 * PASSINTS are all present on the game, season AND career stat rows, which is
 * the entire formula. That means passer rating works on data every dynasty
 * already has — no extractor change, no re-sync.
 *
 * NOT to be confused with the save's own `gameRating` (GAMERATING), which this
 * codebase already reads. That is a 0–100 per-game performance grade carried by
 * every stat category, offense and defense alike, and it is a different
 * measurement entirely: a 22/28, 338-yard, 5-TD game scored 100 there and 238.9
 * here. (GAMERATING is also zero on every season row — it is per-game only.)
 *
 * WHERE THE NUMBERS COME FROM. The coefficients were fixed in 1979 against the
 * passing statistics of the day: 8.4 was chosen so an average passer's
 * yards-per-attempt and completion-percentage components summed to exactly 100,
 * and 330/200 were chosen so an average passer's touchdowns and interceptions
 * cancelled. Read the scale with that in mind — passing has moved a long way
 * since, so a rating of 100 is now a poor season rather than a typical one.
 *
 * UNCAPPED, unlike the NFL formula. The NFL caps each component (completion
 * percentage is clamped to 30–77.5%, and the whole thing tops out at 158.3);
 * the NCAA version clamps nothing, which is why a single brilliant game can read
 * 238.9 and the theoretical bounds are 1261.6 (every attempt a 99-yard
 * touchdown) and −731.6 (every attempt completed for a 99-yard loss). A
 * small-sample rating is therefore wild by design — see `passerRating`'s note on
 * attempts.
 *
 * Sources: https://stassen.com/football/pass-eff/ and
 * https://www.shakinthesouthland.com/football/27783/understanding-ncaa-passer-rating-what-it-is-how-it-works-and-why-it-matters
 */

/** The 1979 coefficients, named so the formula below reads as the formula. */
const YARDS_WEIGHT = 8.4;
const TOUCHDOWN_WEIGHT = 330;
const INTERCEPTION_WEIGHT = 200;
const COMPLETION_WEIGHT = 100;

/** Theoretical bounds — every attempt a 99-yard touchdown, and every attempt completed for a 99-yard loss. Documentation, not clamps: the formula caps nothing and neither does this. */
export const PASSER_RATING_MAX = 1261.6;
export const PASSER_RATING_MIN = -731.6;

/**
 * The five numbers the formula needs. Structural on purpose: `OffensiveStatLine`
 * (season/career) and `OffensiveGameLine` (per game) both satisfy it, so one
 * function serves a game log, a season table and a career total without any of
 * them importing each other.
 */
export interface PassingLine {
  passCompletions: number;
  passAttempts: number;
  passYards: number;
  passTDs: number;
  passInts: number;
}

/**
 * NCAA passer rating for a passing line, or **null when there are no attempts**.
 *
 * Null rather than 0 — a player who has never thrown does not have a bad rating,
 * he has no rating, and 0 would sort him beneath the worst quarterback in the
 * league on any leaderboard that took it at face value. Every caller has to
 * decide what to draw for "no rating", which is the point.
 *
 * A LOW ATTEMPT COUNT IS STILL A REAL ANSWER, and still a misleading one: with
 * nothing capped, one 40-yard touchdown on the only throw of a game rates 766.
 * That is arithmetically correct and journalistically useless, so any surface
 * that RANKS players by this needs a minimum-attempts rule of its own (the NCAA
 * applies one for its official leaders). Deliberately not enforced here: a
 * player's own game log should show his rating for a two-throw game, and a
 * leaderboard should not — that is a display decision, not a formula one.
 */
export function passerRating(line: PassingLine): number | null {
  if (line.passAttempts <= 0) return null;
  return (
    (YARDS_WEIGHT * line.passYards +
      TOUCHDOWN_WEIGHT * line.passTDs -
      INTERCEPTION_WEIGHT * line.passInts +
      COMPLETION_WEIGHT * line.passCompletions) /
    line.passAttempts
  );
}

/**
 * One decimal place, the convention every college box score prints it in
 * ("168.6"). Returns null for no rating so callers keep control of the empty
 * state rather than being handed a dash they have to detect.
 */
export function formatPasserRating(rating: number | null): string | null {
  return rating === null ? null : rating.toFixed(1);
}

/** Convenience for the common case — a line straight to its printed form, null when there is nothing to print. */
export function formatLinePasserRating(line: PassingLine): string | null {
  return formatPasserRating(passerRating(line));
}
