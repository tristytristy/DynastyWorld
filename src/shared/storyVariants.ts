/**
 * Deterministic variant picking for the hub's generated prose.
 *
 * Every story on the NCAA Hub is recomputed from scratch on each page load —
 * nothing about a sentence is stored. So `Math.random()` here would mean the
 * same real event (same week, same final score) narrated differently every
 * time the page is opened, which reads as a broken app rather than a lively
 * one. Instead each call seeds off the EVENT: same season/week/matchup, same
 * sentence, forever, until the underlying facts change.
 *
 * djb2 is enough — this picks adjectives, not keys. What matters is that the
 * bits are well mixed (so two seeds differing by one character land in
 * different pools) and that it is pure, synchronous, and identical in the main
 * and renderer processes, which both narrate.
 */

/** djb2. Always non-negative, so callers can `% pool.length` directly. */
export function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  // >>> 0 rather than Math.abs: the XOR leaves a signed 32-bit value, and
  // Math.abs(-2147483648) is still negative.
  return hash >>> 0;
}

/**
 * Builds a seed from the parts that identify an event. Nullish parts are
 * dropped rather than stringified, so an absent optional fact doesn't silently
 * re-roll every sentence on the page the day it starts being populated.
 */
export function storySeed(...parts: (string | number | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join('~');
}

/** Same seed -> same element, always. Throws on an empty pool: a phrase pool with no phrases is a bug at the call site, not a runtime condition to absorb. */
export function pickVariant<T>(pool: readonly T[], seed: string): T {
  if (pool.length === 0) throw new Error('pickVariant: empty pool');
  return pool[hashSeed(seed) % pool.length];
}

/**
 * Picks from a second pool independently of the first. Two `pickVariant` calls
 * on one seed would correlate — a given event would always pair variant 2 of
 * the lead sentence with variant 2 of the follow-up clause — so anything that
 * composes two phrases for the same event salts the seed instead.
 */
export function pickVariantFor<T>(pool: readonly T[], seed: string, salt: string): T {
  return pickVariant(pool, `${seed}#${salt}`);
}
