/**
 * WebP library with normalized names — see playerAssetMapping.ts for the conversion notes.
 *
 * De-dash for EA's name truncation: long combined coach names carry a '-'
 * truncation marker in the save's GenericHeadAssetName that the exported files
 * drop (verified on a real save — the 2 dashed coaches have a file only at the
 * de-dashed name, none at the dashed one). Single-src here (no onError chain like
 * PlayerPortrait), and no dashed name ever matches a file, so we de-dash directly;
 * it's a no-op for the normal names.
 */
export function getCoachPortraitPath(assetName: string | null): string | null {
  if (!assetName) return null;
  return `cfbmedia://media/coaches/nilcp_${assetName.replace(/-/g, '')}.webp`;
}
