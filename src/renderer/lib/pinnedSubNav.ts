import { useEffect, useRef } from 'react';

/**
 * The hub sub-nav: pinned under the section bar, in every hub.
 *
 * Team Hub's row behaved this way and the other three didn't — its tabs stayed
 * put while NCAA's and Recruiting's scrolled away, so the same control answered
 * differently depending on which section you were in. This makes Team Hub's
 * behaviour the standard rather than the exception.
 *
 * Two things have to happen together, which is why they live in one hook:
 *
 *  1. the row pins beneath the section nav, at `--section-nav-h`
 *  2. it publishes `--pinned-top` — its own bottom edge — so a page BELOW it
 *     that also pins (the Statistics filter bars) stacks under it instead of
 *     colliding. Cleared on unmount so a hub with no sub-nav isn't offset by a
 *     row that isn't there.
 *
 * z-[25] sits above page content (z-20) and below the section nav (z-30). The
 * order is expressed in z-index rather than left to geometry: two rows at the
 * same level let DOM order decide, and the page's own bar — rendered later —
 * wins, which is how a page bar ended up painting over the sub-nav.
 */
export const PINNED_SUB_NAV_CLASS =
  'sticky top-[var(--section-nav-h,4.4375rem)] z-[25] bg-white dark:bg-black';

export function usePinnedSubNav<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty(
        '--pinned-top',
        `calc(var(--section-nav-h, 4.4375rem) + ${el.getBoundingClientRect().height}px)`,
      );
    publish();
    // Measured, not assumed: these rows wrap at narrow widths and the tallest
    // of them carries a team switcher, so a literal would be wrong somewhere.
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--pinned-top');
    };
  }, []);

  return ref;
}
