/** WebP library with normalized names — see playerAssetMapping.ts for the conversion notes. */
export function getCoachPortraitPath(assetName: string | null): string | null {
  if (!assetName) return null;
  return `assets/coaches/nilcp_${assetName}.webp`;
}
