/**
 * Decodes the structure baked into "Generic" portrait asset keys — confirmed
 * real, not guessed, via two separate investigations against real save data:
 *
 * Key shape: Generic_<seq>_[P|C]_T<seq>_<LETTER>_<BUILD_TIER>_<STYLE>
 * e.g. "Generic_0641_P_T0032_D_4_1"
 *
 * - LETTER (D/H/M/T): body-build class. Cross-referenced against real
 *   players' actual Weight/Height/Position (not just eyeballed): H averages
 *   265lb and is almost entirely offensive/defensive line; T averages 191lb
 *   and is almost entirely WR/CB/K/P/S; D and M sit in between. Player-named
 *   here Heavy/Default/Muscular/Athletic per that data.
 * - BUILD_TIER (1-8): skin-tone axis, verified consistent across all four
 *   letters at the same tier (e.g. tier 7 is a Black-appearing player under
 *   every one of D/H/M/T). Bucketed into three visually-confirmed groups
 *   below rather than exposing all 8 raw tiers.
 * - STYLE (1-4): a bundled hairstyle + facial-hair "look" — visually
 *   confirmed to vary the same way across every (letter, tier) pair, but the
 *   four specific looks differ by letter, so this isn't exposed as its own
 *   filter (nothing meaningful to label it with beyond "look 1-4").
 *
 * Unique portraits (individually modeled real players) carry none of this
 * structure — they just get classified as `type: 'unique'` with no
 * build/skinTone.
 */

export type PortraitType = 'generic' | 'unique';
export type PortraitBuild = 'H' | 'D' | 'M' | 'T';
export type PortraitSkinTone = 'light' | 'tan' | 'deep';

export const BUILD_LABELS: Record<PortraitBuild, string> = {
  H: 'Heavy',
  D: 'Default',
  M: 'Muscular',
  T: 'Athletic',
};

export const SKIN_TONE_LABELS: Record<PortraitSkinTone, string> = {
  light: 'Light',
  tan: 'Tan',
  deep: 'Deep',
};

export interface PortraitMeta {
  assetName: string;
  type: PortraitType;
  build: PortraitBuild | null;
  skinTone: PortraitSkinTone | null;
}

const GENERIC_KEY_PATTERN = /^Generic_\d+_[PC]_T?\d+_([A-Z])_(\d)_(\d)$/;

function skinToneFromTier(tier: number): PortraitSkinTone {
  if (tier <= 3) return 'light';
  if (tier === 4) return 'tan';
  return 'deep';
}

/** `assetName` is the bare key with no `nilpp_`/`nilcp_` prefix or `.webp` extension. */
export function classifyPortrait(assetName: string): PortraitMeta {
  const match = assetName.match(GENERIC_KEY_PATTERN);
  if (!match) {
    return { assetName, type: 'unique', build: null, skinTone: null };
  }
  const [, letter, tierStr] = match;
  return {
    assetName,
    type: 'generic',
    build: (letter as PortraitBuild) in BUILD_LABELS ? (letter as PortraitBuild) : null,
    skinTone: skinToneFromTier(Number(tierStr)),
  };
}
