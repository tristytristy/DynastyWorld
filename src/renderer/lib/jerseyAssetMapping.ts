/**
 * Team jersey asset mapping — the game's team jersey renders
 * (public/assets/jersey/tjer_teamjerseys_<Token>_result.webp), designed to
 * overlay directly on a 512×512 player portrait so the player appears in that
 * team's uniform. Both portrait and jersey share the same fixed canvas, so the
 * overlay is a 1:1 stack (see PlayerPortrait).
 *
 * The jersey <Token> is the SAME per-team token as the 3D logo / helmet
 * filename — verified 1:1 across all 143 teams. So, exactly like the helmet
 * mapper, the path is DERIVED from the shared token rather than kept in a
 * second table. The overlay is applied at RENDER time (never baked into the
 * portrait), so a player who transfers automatically shows their new team's
 * jersey — the caller just passes the player's CURRENT team.
 */
import { TEAM_3D_LOGOS, canonicalKey } from './assetMapping';
import { programArtFor } from './programArt';

const JERSEY_BASE_PATH = 'cfbmedia://media/jersey';

/**
 * The jersey overlay path for a team, or null when there's no team to dress the
 * player in (no team passed, or a team with no dedicated jersey — e.g. an
 * FCS-region placeholder). Null means "render the portrait as-is", so callers
 * never have to guard.
 */
export function getJerseyPath(teamAssetName: string | null | undefined): string | null {
  if (!teamAssetName) return null;
  const key = canonicalKey(teamAssetName);
  // An upload wins over the shipped library — see programArt.ts.
  const uploaded = programArtFor(key, 'jersey');
  if (uploaded) return uploaded;
  const filename = TEAM_3D_LOGOS[key];
  return filename
    ? `${JERSEY_BASE_PATH}/tjer_teamjerseys_${filename.replace(/\.webp$/i, '')}_result.webp`
    : null;
}
