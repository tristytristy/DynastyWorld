import type { CSSProperties } from 'react';

/**
 * The clipped-corner ("angular") panel shape, as a reusable style. The clip
 * polygon was duplicated inline in app.tsx and Dashboard.tsx with different
 * corner insets; this parameterizes the inset so both keep their own size from
 * one formula. Default 1.25rem matches the app-shell frame.
 */
export function angledClip(inset = '1.25rem'): CSSProperties {
  return {
    clipPath: `polygon(0 0, calc(100% - ${inset}) 0, 100% ${inset}, 100% 100%, ${inset} 100%, 0 calc(100% - ${inset}))`,
  };
}
