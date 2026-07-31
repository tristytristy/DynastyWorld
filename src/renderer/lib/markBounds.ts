import {
  HELMET_BOUNDS,
  HELMET_BOUNDS_FALLBACK,
  LOGO_BOUNDS,
  LOGO_BOUNDS_FALLBACK,
  type MarkBounds,
} from './markBounds.generated';

export type { MarkBounds };

/**
 * Turns a resolved asset PATH into the key `scripts/measure-mark-bounds.js`
 * filed it under.
 *
 * Keying off the path rather than the team name is deliberate: the app already
 * resolves a team to its file through `getLogoPath`/`getHelmetPath`, alias
 * table and all, so reusing that answer means the bounds can never be looked up
 * for a different file than the one actually rendered. Keying off the team name
 * would re-implement that resolution and quietly drift from it.
 */
function keyFromPath(assetPath: string): string {
  const file = assetPath.split('/').pop() ?? assetPath;
  return file
    .replace(/\.(webp|png)$/i, '')
    .replace(/_(OD|OL|gold)$/i, '')
    .replace(/^thel_lthelmets_/i, '')
    .replace(/_result$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Where the real artwork sits inside a mark's canvas. Falls back to the median
 * for anything unmeasured — a mark the map doesn't know about renders slightly
 * off rather than not at all.
 */
export function boundsFor(assetPath: string, kind: 'logo' | 'helmet'): MarkBounds {
  const key = keyFromPath(assetPath);
  if (kind === 'helmet') return HELMET_BOUNDS[key] ?? HELMET_BOUNDS_FALLBACK;
  return LOGO_BOUNDS[key] ?? LOGO_BOUNDS_FALLBACK;
}

export interface MarkGeometry {
  /** Rendered box size in px — always LARGER than the visible art (see markBounds.generated.ts). */
  box: number;
  /** Inline style for the <img>, positioning the box so the ART lands where asked. */
  style: { width: number; height: number; left: number; top: string; transform: string };
  /** Left padding the text column needs to clear the art, in px. */
  textInset: number;
}

/**
 * Solves the placement for a mark that must FIT inside a slot — at most
 * `maxHeight` tall and `maxWidth` wide — centred in that slot horizontally and
 * on the card vertically.
 *
 * Fitting to a box rather than to a height is the whole point, and it was
 * learned the hard way: normalising on height alone made every mark 210px tall,
 * which is correct for a round emblem and absurd for a wordmark. JMU came out
 * 638px wide, UAB 689px — a 6.4x spread sideways across the league, with the
 * widest marks swallowing the card. Taking whichever of the two constraints
 * binds first is just `object-fit: contain` applied to the ARTWORK instead of
 * to its mostly-empty canvas.
 *
 * The slot is a fixed width, so the text always starts at the same x no matter
 * which team is on screen — a mark that renders narrow leaves a gap rather than
 * dragging the headline left with it.
 *
 * All the arithmetic exists because the art floats inside a much larger
 * transparent canvas: a 250px helmet needs a ~436px box, and that box starts at
 * a NEGATIVE offset to cancel the baked-in margin.
 */
export function markGeometry(
  bounds: MarkBounds,
  {
    maxHeight,
    maxWidth,
    slotLeft,
    textGap,
  }: { maxHeight: number; maxWidth: number; slotLeft: number; textGap: number },
): MarkGeometry {
  // Whichever limit is reached first decides the scale.
  const box = Math.min(maxHeight / bounds.fillH, maxWidth / bounds.fillW);
  const artWidth = bounds.fillW * box;
  // Art's own edges within the box, as px from the box's top-left.
  const artLeftInBox = (bounds.centerX - bounds.fillW / 2) * box;
  const artCenterYInBox = bounds.centerY * box;
  // Centre the artwork inside its fixed slot.
  const artLeft = slotLeft + (maxWidth - artWidth) / 2;

  return {
    box,
    style: {
      width: box,
      height: box,
      left: Math.round(artLeft - artLeftInBox),
      // 50% is half the CARD (the positioned ancestor); the translate then pulls
      // back by the art's own centre inside the box, so what ends up centred is
      // the visible artwork rather than the transparent canvas around it.
      top: '50%',
      transform: `translateY(-${Math.round(artCenterYInBox)}px)`,
    },
    textInset: Math.round(slotLeft + maxWidth + textGap),
  };
}
