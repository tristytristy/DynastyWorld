/**
 * The portrait library is WebP q90 with fully normalized names (2026-07-19
 * conversion — see scripts/convert-portraits.js): exactly one file per asset,
 * `nilpp_<assetName>.webp`. PNG masters are archived at
 * D:/PROJECT/portrait-master-png (outside the app).
 *
 * Fallback for EA's name truncation: for long combined player names, the save's
 * `GenericHeadAssetName` is truncated to a fixed length with a '-' left at the
 * cutoff (e.g. `Unique_LagafuainaLesterl-_21542`), but the exported portrait
 * files DROP that dash (`Unique_LagafuainaLesterl_21542.webp`). Verified on a
 * real save: of 105 such players, 0 have a file at the dashed name and all 105
 * resolve with the dash removed. So when the asset name contains a '-', we try
 * the exact name first, then the de-dashed name — otherwise those ~0.7% of
 * players fall back to initials even though their portrait ships in the pack.
 */
export function getPlayerPortraitCandidates(assetName: string | null): string[] {
  if (!assetName) return [];
  const paths = [`cfbmedia://media/playerportrait/nilpp_${assetName}.webp`];
  const deDashed = assetName.replace(/-/g, '');
  if (deDashed !== assetName) {
    paths.push(`cfbmedia://media/playerportrait/nilpp_${deDashed}.webp`);
  }
  return paths;
}
