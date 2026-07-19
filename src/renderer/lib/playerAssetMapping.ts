/**
 * The portrait library is WebP q90 with fully normalized names (2026-07-19
 * conversion — see scripts/convert-portraits.js): exactly one file per asset,
 * `nilpp_<assetName>.webp`, no legacy `_result`/`_result_result` suffix
 * variants. That's why this returns a single path instead of the old
 * three-candidate onError-fallback chain. PNG masters are archived at
 * D:/PROJECT/portrait-master-png (outside the app).
 */
export function getPlayerPortraitCandidates(assetName: string | null): string[] {
  if (!assetName) return [];
  return [`assets/playerportrait/nilpp_${assetName}.webp`];
}
