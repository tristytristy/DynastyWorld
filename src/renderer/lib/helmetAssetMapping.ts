/**
 * Team helmet asset mapping — the game's premium 3D helmet renders
 * (public/assets/helmet/{left,right}/thel_{lt,rt}helmets_<Token>_result.webp),
 * for use in matchup graphics (Game Information) and anywhere a team's helmet
 * reads better than its logo.
 *
 * The helmet <Token> is the SAME per-team token as the 3D logo filename
 * (TEAM_3D_LOGOS values, minus `.webp`) — verified 1:1 across all 143 teams
 * (every 3D-logo token has a matching helmet and vice-versa). The only 8
 * non-team helmet files are generics: `Default` plus the mascot-named
 * created-team uniforms (Cyclones/Mustangs/Orcas/Pumas/Rattlers/Renegades) and
 * the `BringGloryHome` promo — none of which correspond to a save team.
 *
 * So — exactly like the `_OD`/`_OL`/`_gold` logo variants in assetMapping.ts —
 * the helmet path is DERIVED from the shared token rather than kept in a second
 * 143-entry table that could drift. If the two sets ever diverge (a team gains
 * a helmet but no 3D logo, or vice-versa), add a small override map here,
 * mirroring TEAM_NAME_ALIASES in assetMapping.ts.
 *
 * Because this keys through `canonicalKey`, the abbreviated schedule
 * DisplayNames ("Washington St.", "UConn", "C. Carolina") resolve to the right
 * helmet just like they do for logos.
 */
import { TEAM_3D_LOGOS, canonicalKey } from './assetMapping';

/**
 * Which of the two shipped source folders to draw from:
 *  - 'left'  = left-side / default art (also the generic fallback usage)
 *  - 'right' = the mirrored right-side art
 * In a head-to-head matchup, pair one team's 'left' helmet against the other's
 * 'right' helmet so the two face into the center (BoxOut-style).
 */
export type HelmetSide = 'left' | 'right';

const HELMET_BASE_PATH = 'cfbmedia://media/helmet';
/** Generic helmet shipped for any team without dedicated art (graceful fallback). */
const DEFAULT_HELMET_TOKEN = 'Default';

function helmetUrl(side: HelmetSide, token: string): string {
  const prefix = side === 'left' ? 'lt' : 'rt';
  return `${HELMET_BASE_PATH}/${side}/thel_${prefix}helmets_${token}_result.webp`;
}

/** True when this team has dedicated helmet art (vs. falling back to Default). */
export function hasTeamHelmet(teamAssetName: string): boolean {
  return Boolean(TEAM_3D_LOGOS[canonicalKey(teamAssetName)]);
}

/**
 * Best helmet path for a team. Falls back to the generic Default helmet for
 * teams without dedicated art (mirrors getLogoPath's fallback behavior), so a
 * caller never has to guard for a missing file.
 */
export function getHelmetPath(teamAssetName: string, side: HelmetSide = 'left'): string {
  const filename = TEAM_3D_LOGOS[canonicalKey(teamAssetName)];
  const token = filename ? filename.replace(/\.webp$/i, '') : DEFAULT_HELMET_TOKEN;
  return helmetUrl(side, token);
}

/** The generic fallback helmet path, exposed for explicit placeholder use. */
export const DEFAULT_HELMET_PATH: Record<HelmetSide, string> = {
  left: helmetUrl('left', DEFAULT_HELMET_TOKEN),
  right: helmetUrl('right', DEFAULT_HELMET_TOKEN),
};
