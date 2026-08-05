/**
 * Is this the same player, one season to the next?
 *
 * THE SAVE RECYCLES PLAYER IDS. When someone graduates, transfers or is drafted,
 * EA hands his id slot to an incoming recruit. So `id` answers "which row" within
 * ONE season — where it is genuinely unique and safe — but it does NOT answer
 * "which person" across seasons, which is what a career view is asking.
 *
 * Measured on two real multi-season dynasties (2026→2027 and 2026→2028):
 *
 *   Auburn:  1,527 of 13,830 ids shared between seasons belong to a DIFFERENT
 *            person by the later season  (11.0%)
 *   UCLA:    1,964 of 15,308  (12.8%)
 *
 * Roughly one in eight. The symptom that surfaced it: an incoming freshman with
 * a career OVR chart running back to 2026 and a "first recorded game vs
 * Charlotte" he never played — the previous occupant of his id, inherited whole.
 *
 * THE RULE: same id, AND (the name matches OR the origin matches).
 *
 * Both halves are earned, not guessed. Across 25,647 genuine same-person links
 * in those dynasties:
 *
 *   - hometown/state never changed:  0 drift
 *   - height never changed:          0 drift
 *
 * ...so origin costs nothing to require. And of the ~3,500 recycled ids, only
 * five happened to share a hometown, of which exactly one also shared a height
 * (a Lubbock, Texas pair at 72in). One false link in ~3,500, against a rule that
 * is otherwise wrong one time in eight.
 *
 * WHY NOT NAME ALONE, which was 100% precise on this data? Because renaming a
 * player is a supported feature of the editor, and a name-only rule would sever
 * his career the moment you used it. Origin is the anchor a rename cannot move —
 * hometown is not editable at all, so a rename leaves it matching and the career
 * holds together.
 *
 * WHY NOT ORIGIN ALONE? It admits those five big-city coincidences, and the name
 * is the stronger signal in the ordinary case. Requiring EITHER means each
 * covers the other's failure: an edited name falls back to origin, and a
 * coincidental origin is rejected by the name.
 *
 * The remaining hole is deliberate and small: editing a player's name AND his
 * height together breaks the link. Height is editable, hometown is not. Even
 * then nothing is lost — season snapshots are immutable, every per-season view
 * still reads correctly, and restoring either field restores the link, because
 * this is evaluated at read time and never stored.
 */

/** The fields identity needs. Structural, so any roster-ish row satisfies it. */
export interface PlayerIdentityFields {
  id: number;
  firstName: string;
  lastName: string;
  /** Optional so older snapshots, which predate these fields, degrade to a name match. */
  hometown?: string | null;
  homeState?: string | null;
  heightInches?: number | null;
}

function sameName(a: PlayerIdentityFields, b: PlayerIdentityFields): boolean {
  return a.firstName === b.firstName && a.lastName === b.lastName;
}

/**
 * Hometown + state + height — the part of a player the editor cannot rewrite
 * (hometown isn't an editable field at all).
 *
 * Returns false when ANY component is missing rather than treating absent as
 * equal: two players who both lack a hometown are not thereby the same player,
 * and a snapshot written before these fields existed should fall back to the
 * name test instead of silently matching everyone.
 */
function sameOrigin(a: PlayerIdentityFields, b: PlayerIdentityFields): boolean {
  if (!a.hometown || !b.hometown || !a.homeState || !b.homeState) return false;
  if (a.heightInches == null || b.heightInches == null) return false;
  return a.hometown === b.hometown && a.homeState === b.homeState && a.heightInches === b.heightInches;
}

/**
 * Same person across seasons?
 *
 * WITHIN a single season, prefer a plain `id` comparison — ids are unique there
 * and this would only add work. Use this when a lookup spans seasons.
 */
export function isSamePlayer(a: PlayerIdentityFields | null | undefined, b: PlayerIdentityFields | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  return sameName(a, b) || sameOrigin(a, b);
}

/** Find the row in another season that is the same person as `reference`. */
export function findSamePlayer<T extends PlayerIdentityFields>(
  candidates: readonly T[] | null | undefined,
  reference: PlayerIdentityFields | null | undefined,
): T | undefined {
  if (!candidates || !reference) return undefined;
  return candidates.find((candidate) => isSamePlayer(candidate, reference));
}
