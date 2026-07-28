/**
 * Coach polo asset mapping — the game's team coach-polo renders
 * (public/assets/coachpolos/tjer_coachpolos_<Token>_Polos_result.webp), the
 * coaching-staff counterpart to the player jerseys. Designed to overlay
 * directly on a 512x512 coach portrait so the coach appears in the polo of the
 * program he's on staff at.
 *
 * Same <Token> as the 3D logo / helmet / jersey filename, so — exactly like
 * jerseyAssetMapping — the path is DERIVED from that shared token rather than
 * kept in a second table, and the overlay is applied at RENDER time. A coach
 * who takes a new job automatically wears the new school's polo; the caller
 * just passes his CURRENT team.
 *
 * NOT a straight copy of the jersey mapper, though: the polo library covers 144
 * of the 150 jersey tokens. The six without polo art are generic/created-team
 * mascots rather than real programs, so they're excluded explicitly instead of
 * being allowed to resolve to a URL that 404s.
 */
import { TEAM_3D_LOGOS, canonicalKey } from './assetMapping';

const POLO_BASE_PATH = 'cfbmedia://media/coachpolos';

/**
 * Tokens that have a jersey but no coach polo — verified by diffing the two
 * asset folders (150 jerseys vs 144 polos). All six are generic/created-team
 * mascots, not real schools.
 */
const TOKENS_WITHOUT_POLO = new Set(['Cyclones', 'Mustangs', 'Orcas', 'Pumas', 'Rattlers', 'Renegades']);

/** True when this team has a dedicated coach polo. */
export function hasCoachPolo(teamAssetName: string | null | undefined): boolean {
  return getCoachPoloPath(teamAssetName) !== null;
}

/**
 * The polo overlay path for a team, or null when there's nothing to dress the
 * coach in (no team passed, an unmapped team, or one of the six without polo
 * art). Null means "render the portrait as-is", so callers never have to guard.
 */
export function getCoachPoloPath(teamAssetName: string | null | undefined): string | null {
  if (!teamAssetName) return null;
  const filename = TEAM_3D_LOGOS[canonicalKey(teamAssetName)];
  if (!filename) return null;
  const token = filename.replace(/\.webp$/i, '');
  if (TOKENS_WITHOUT_POLO.has(token)) return null;
  return `${POLO_BASE_PATH}/tjer_coachpolos_${token}_Polos_result.webp`;
}
