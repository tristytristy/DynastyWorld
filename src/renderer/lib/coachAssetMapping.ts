/** WebP library with normalized names — see playerAssetMapping.ts for the conversion notes. */
export function getCoachPortraitPath(assetName: string | null): string | null {
  if (!assetName) return null;
  return `cfbmedia://media/coaches/nilcp_${assetName}.webp`;
}
