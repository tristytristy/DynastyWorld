import type { CSSProperties } from 'react';

/**
 * The two-corner ("angular") panel frame — top-right and bottom-left cut at 45°,
 * the app shell's own wrapper shape.
 *
 * THE POLYGON MOVED TO CSS (`.corner-cut-frame` in globals.css). It used to be
 * built here and applied as an inline clip-path, which meant the frame's angled
 * edges could never be closed: the hairline that closes a clipped diagonal has
 * to be drawn by a pseudo-element, and a pseudo-element has to live in the
 * stylesheet. Now the class owns the shape AND its two edges, and all this
 * passes is the inset.
 *
 * Renamed from `angledClip` deliberately: the class is no longer optional, so a
 * call site left behind fails to compile instead of silently rendering a plain
 * rectangle.
 *
 * Usage: `className={`${ANGLED_FRAME} …`} style={angledFrame('1.1rem')}`, or
 * drop the style to take the 1.25rem default the app-shell frame uses.
 */
export const ANGLED_FRAME = 'corner-cut-frame';

export function angledFrame(inset: string): CSSProperties {
  // React writes custom properties through fine; CSSProperties just doesn't type them.
  return { '--cut': inset } as CSSProperties;
}
