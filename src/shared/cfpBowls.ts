/**
 * Which bowl a CFP quarterfinal or semifinal actually IS.
 *
 * THE SAVE DOESN'T SAY, DIRECTLY. `SeasonGame.BowlGame` resolves for a playoff
 * game to a bracket placeholder — `Name` = "CFP Quarterfinal", `AssetName`
 * blank — and the six New Year's Six bowls are not rows in the `BowlGame` table
 * at all. That looks like a dead end and isn't: the identity is carried by
 * `SeasonGame.Stadium`, already extracted leaguewide as `neutralVenueId`,
 * because each of the six bowls is played at exactly one venue.
 *
 * WHY THIS RESOLVES AT READ TIME rather than in the extractor. Same reason
 * lib/neutralVenues.ts does it: a dynasty's past seasons can never be
 * re-synced — the save has long since moved past bowl week — so anything
 * derived only at extraction leaves every playoff already sitting in an
 * archive permanently unlabelled. `neutralVenueId` is on those old snapshots
 * already, so resolving from it here repairs history for free.
 *
 * THE IDS WERE DECODED, NOT GUESSED. Two full postseasons were read out of real
 * saves and matched against the user's own in-game bracket screenshots, which
 * name every bowl. Three of the six ids were ALREADY in neutralVenues.ts from
 * unrelated work and land on Sugar, Cotton and Peach — the correct real-world
 * bowls for those venues. That independent agreement is the check that says the
 * three added for this feature are right too.
 *
 * THE ASSIGNMENT ROTATES BY SEASON and must never be hardcoded to a round:
 *   2026  QF Peach / Rose / Fiesta / Cotton   →  SF Orange / Sugar
 *   2027  QF Sugar / Rose / Peach / Fiesta    →  SF Orange / Cotton
 *
 * Names are the STABLE ones ("Rose Bowl"), never the sponsor rebrand ("Rose Bowl
 * Game presented by Prudential"). The sponsor prefix rotates, isn't in the save
 * anywhere, and would rot silently — the same reasoning that makes the rest of
 * the app key bowls on `AssetName` rather than `Name`.
 *
 * The asset name follows the save's own convention for real bowls
 * (`Alamo_Bowl`, `Sun_Bowl`), so `getBowlLogoPath`/`getBowlTrophyPath` resolve
 * it to the existing `bowl_RoseBowl.webp` / `bowl_RoseBowlTrophy.webp` art with
 * no special-casing in the asset layer.
 */

export interface CfpBowl {
  /** Stable display name, no sponsor prefix. */
  name: string;
  /** Save-convention asset key — feeds the existing bowl logo/trophy lookups. */
  assetName: string;
}

/** The save's `BowlGame.Name` for each CFP bracket round. Verified values, not guesses. */
export const CFP_FIRST_ROUND = 'CFP First Round';
export const CFP_QUARTERFINAL = 'CFP Quarterfinal';
export const CFP_SEMIFINAL = 'CFP Semifinal';

/** The three bracket rounds that are NOT the title game (which has its own week type). */
export const CFP_ROUND_NAMES: ReadonlySet<string> = new Set([
  CFP_FIRST_ROUND,
  CFP_QUARTERFINAL,
  CFP_SEMIFINAL,
]);

const ROSE: CfpBowl = { name: 'Rose Bowl', assetName: 'Rose_Bowl' };
const SUGAR: CfpBowl = { name: 'Sugar Bowl', assetName: 'Sugar_Bowl' };
const ORANGE: CfpBowl = { name: 'Orange Bowl', assetName: 'Orange_Bowl' };
const PEACH: CfpBowl = { name: 'Peach Bowl', assetName: 'Peach_Bowl' };
const COTTON: CfpBowl = { name: 'Cotton Bowl', assetName: 'Cotton_Bowl' };
const FIESTA: CfpBowl = { name: 'Fiesta Bowl', assetName: 'Fiesta_Bowl' };

/**
 * `SeasonGame.Stadium` reference → the bowl played there.
 *
 * Ids are stable across saves (verified byte-identical in unrelated files), and
 * these six are the complete New Year's Six set — every quarterfinal and
 * semifinal in both captured postseasons resolved to one of them.
 */
const CFP_BOWL_BY_VENUE_ID: Record<string, CfpBowl> = {
  '16433:99791': SUGAR, // Caesars Superdome, New Orleans
  '16433:99792': COTTON, // AT&T Stadium, Arlington
  '16433:99847': ORANGE, // Hard Rock Stadium, Miami Gardens
  '16433:99895': PEACH, // Mercedes-Benz Stadium, Atlanta
  '16433:105959': FIESTA, // State Farm Stadium, Glendale
  '16434:85214': ROSE, // Rose Bowl, Pasadena
};

/**
 * The bowl this playoff game is, or null when it isn't one.
 *
 * SCOPED BY ROUND, AND THAT SCOPING IS LOAD-BEARING — not defensive tidiness.
 * In 2027 the Caesars Superdome hosted BOTH the Sugar Bowl quarterfinal and the
 * national championship: same venue id, same season. Resolving on the id alone
 * would label the title game "Sugar Bowl". Only the quarterfinal and semifinal
 * rounds carry a bowl identity:
 *
 * - First round is played on the higher seed's campus and carries no venue
 *   reference at all, which is how the app already tells the two apart.
 * - The national championship is at a rotating neutral site that is nobody's
 *   bowl, even when the building happens to host one.
 *
 * Returns null for an unrecognised id rather than guessing, and for a
 * quarterfinal whose venue hasn't been assigned yet — the save leaves the
 * semifinal venues empty until the quarterfinals resolve, and the game's own
 * bracket shows a generic mark there for exactly the same reason.
 */
export function resolveCfpBowl(
  bowlName: string | null | undefined,
  neutralVenueId: string | null | undefined,
): CfpBowl | null {
  if (bowlName !== CFP_QUARTERFINAL && bowlName !== CFP_SEMIFINAL) return null;
  if (!neutralVenueId) return null;
  return CFP_BOWL_BY_VENUE_ID[neutralVenueId] ?? null;
}
